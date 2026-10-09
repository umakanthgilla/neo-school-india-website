/**
 * Finance ONE isolated credential helper. Internal provisioning only.
 * Never expose createFinancePasswordRecord as a public registration endpoint.
 * Passwords are PBKDF2-SHA256 hashed using WebCrypto; never retain plaintext.
 */
const ITERATIONS=210000;
const encoder=new TextEncoder();
const accountPattern=/^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,127}$/;
const hex=bytes=>Array.from(bytes, v=>v.toString(16).padStart(2,'0')).join('');
const decodeHex=s=>Uint8Array.from(s.match(/.{2}/g)||[],x=>parseInt(x,16));
function validatePassword(password){
 if(typeof password!=='string'||password.length<12||password.length>256)throw Error('Finance password must be 12–256 characters');
 return password;
}
async function derive(password,salt,iterations){
 const material=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
 return new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations},material,256));
}
function equal(a,b){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0;}
// A separately authorized invitation or private bootstrap tool must call this.
// No school/admin login can issue credentials through public HTTP routes.
export async function createFinancePasswordRecord({accountId,password}){
 if(typeof accountId!=='string'||!accountPattern.test(accountId))throw Error('Invalid independent finance account');
 validatePassword(password);
 const salt=crypto.getRandomValues(new Uint8Array(16));
 const digest=await derive(password,salt,ITERATIONS);
 return Object.freeze({accountId,salt:hex(salt),passwordHash:hex(digest),iterations:ITERATIONS});
}
export async function verifyFinancePassword({db,accountId,password,now=Date.now()}){
 if(typeof accountId!=='string'||!accountPattern.test(accountId)||typeof password!=='string'||password.length>256||!db)return null;
 const row=await db.prepare('SELECT account_id,salt,password_hash,iterations,active,failed_attempts,locked_until,credential_version FROM neo_fin_auth_accounts WHERE account_id=?').bind(accountId).first();
 if(!row||row.active!==1||!Number.isSafeInteger(row.iterations)||row.iterations<ITERATIONS||row.iterations>1000000||
  typeof row.salt!=='string'||!/^[0-9a-f]{32}$/.test(row.salt)||typeof row.password_hash!=='string'||!/^[0-9a-f]{64}$/.test(row.password_hash))return null;
 if(Number(row.locked_until||0)>now)return null;
 const digest=await derive(password,decodeHex(row.salt),row.iterations);
 const ok=equal(digest,decodeHex(row.password_hash));
 if(!ok){
  // Atomic failed-attempt increment, with lockout reset when the timer expires.
  // Unknown IDs also require a perimeter rate limit/WAF before launch.
  await db.prepare(`UPDATE neo_fin_auth_accounts SET
    failed_attempts=CASE WHEN locked_until IS NOT NULL AND locked_until<=? THEN 1 ELSE failed_attempts+1 END,
    locked_until=CASE WHEN (CASE WHEN locked_until IS NOT NULL AND locked_until<=? THEN 1 ELSE failed_attempts+1 END)>=5 THEN ? ELSE NULL END
    WHERE account_id=? AND credential_version=? AND active=1
      AND (locked_until IS NULL OR locked_until<=?)
      AND (failed_attempts<5 OR (locked_until IS NOT NULL AND locked_until<=?))`)
      .bind(now,now,now+15*60*1000,accountId,row.credential_version,now,now).run();
  return null;
 }
 if(!Number.isSafeInteger(row.credential_version)||row.credential_version<1)return null;
 // A password may have been correct when read, but 5 other attempts can
 // lock the account while PBKDF2 runs. Recheck lockout atomically at success.
 const result=await db.prepare(`UPDATE neo_fin_auth_accounts SET failed_attempts=0,locked_until=NULL
  WHERE account_id=? AND credential_version=? AND active=1
   AND (locked_until IS NULL OR locked_until<=?)
   AND (failed_attempts<5 OR (locked_until IS NOT NULL AND locked_until<=?))`)
  .bind(accountId,row.credential_version,now,now).run();
 if(result?.success!==true||result?.meta?.changes!==1)return null;
 return Object.freeze({accountId,credentialVersion:row.credential_version});
}
export async function activeFinanceCredential(db,accountId,credentialVersion){
 if(!db||!accountPattern.test(accountId||'')||!Number.isSafeInteger(credentialVersion)||credentialVersion<1)return false;
 const row=await db.prepare('SELECT active,credential_version,locked_until FROM neo_fin_auth_accounts WHERE account_id=?').bind(accountId).first();
 return Boolean(row?.active===1&&row.credential_version===credentialVersion&&Number(row.locked_until||0)<=Date.now());
}
