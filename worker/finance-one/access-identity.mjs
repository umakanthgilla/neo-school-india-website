/** Optional Access authentication. Access admission never grants Finance membership. */
const enc=new TextEncoder();
const cache=new Map();
function decode(part){
 if(!/^[A-Za-z0-9_-]+$/.test(part))throw Error('Invalid assertion');
 const bytes=Uint8Array.from(atob(part.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-part.length%4)%4)),c=>c.charCodeAt(0));
 if(btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')!==part)throw Error('Invalid assertion');
 return bytes;
}
export function accessConfiguration(env){
 const issuer=env?.FINANCE_ONE_ACCESS_ISSUER,audience=env?.FINANCE_ONE_ACCESS_AUDIENCE;
 if(typeof issuer!=='string'||!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer)||
    typeof audience!=='string'||!/^[a-f0-9]{64}$/.test(audience))throw Error('Access configuration unavailable');
 const raw=env.FINANCE_ONE_ACCESS_IDENTITIES;
 if(typeof raw!=='string'||raw.length>16384)throw Error('Access identities unavailable');
 const identities=JSON.parse(raw);
 if(!Array.isArray(identities)||!identities.length||identities.length>100)throw Error('Access identities unavailable');
 const subjects=new Set(),accounts=new Set();
 for(const row of identities){
  if(typeof row?.subject!=='string'||!row.subject||row.subject.length>128||
    typeof row.accountId!=='string'||!/^fin:[A-Za-z0-9:_-]{1,124}$/.test(row.accountId)||
    subjects.has(row.subject)||accounts.has(row.accountId))throw Error('Ambiguous Access identity');
  subjects.add(row.subject);accounts.add(row.accountId);
 }
 return {issuer,audience,identities};
}
export async function verifyAccessIdentity(request,config,{fetcher=fetch,now=Date.now()}={}){
 const token=request.headers.get('Cf-Access-Jwt-Assertion');
 if(!token||token.length>16384)throw Error('Invalid assertion');
 const parts=token.split('.');if(parts.length!==3)throw Error('Invalid assertion');
 const header=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(decode(parts[0])));
 const claims=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(decode(parts[1])));
 if(header.alg!=='RS256'||typeof header.kid!=='string'||header.kid.length>256||header.crit!==undefined||header.jku!==undefined||header.jwk!==undefined)throw Error('Invalid assertion');
 const seconds=Math.floor(now/1000);
 if(claims.iss!==config.issuer||claims.type!=='app'||!Array.isArray(claims.aud)||!claims.aud.includes(config.audience)||
  !Number.isSafeInteger(claims.exp)||claims.exp<seconds+60||!Number.isSafeInteger(claims.iat)||claims.iat>seconds||claims.iat>=claims.exp||
  (claims.nbf!==undefined&&(!Number.isSafeInteger(claims.nbf)||claims.nbf>seconds))||
  typeof claims.sub!=='string'||!claims.sub||claims.sub.length>128)throw Error('Invalid assertion');
 // The endpoint is derived only from operator configuration, never token headers.
 let entry=cache.get(config.issuer);
 if(!entry||entry.until<=now||entry.fetcher!==fetcher){
  const response=await fetcher(config.issuer+'/cdn-cgi/access/certs',{redirect:'error',signal:AbortSignal.timeout(5000)});
  if(!response.ok||!response.body)throw Error('Access keys unavailable');
  const reader=response.body.getReader();let chunks=[],size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>65536){await reader.cancel();throw Error('Access keys too large');}chunks.push(value);}}
  finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  const result=JSON.parse(new TextDecoder().decode(bytes));
  if(!Array.isArray(result.keys)||result.keys.length>20)throw Error('Access keys unavailable');
  entry={keys:result.keys,until:now+300000,fetcher};
  cache.clear();cache.set(config.issuer,entry);
 }
 const matches=entry.keys.filter(k=>k.kid===header.kid&&k.kty==='RSA'&&(!k.alg||k.alg==='RS256')&&(!k.use||k.use==='sig'));
 if(matches.length!==1)throw Error('Access key unavailable');
 const key=await crypto.subtle.importKey('jwk',matches[0],{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
 if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decode(parts[2]),enc.encode(parts[0]+'.'+parts[1])))throw Error('Invalid assertion');
 const identity=config.identities.find(row=>row.subject===claims.sub);
 if(!identity)throw Error('Unlinked Access identity');
 return {accountId:identity.accountId,expiresAt:claims.exp*1000};
}
