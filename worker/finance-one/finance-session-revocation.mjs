/**
 * Finance ONE server-side single-token logout.
 * Never trusts a client-supplied account or token ID: only verified HMAC
 * session identity can call these helpers from the guarded Worker route.
 */
function validSession(session){
 return session&&typeof session.accountId==='string'&&session.accountId.startsWith('fin:')&&
  typeof session.tokenId==='string'&&/^[0-9a-f]{48}$/.test(session.tokenId)&&
  Number.isSafeInteger(session.expiresAt)&&session.expiresAt>0;
}
export async function isFinanceSessionRevoked(db,session){
 if(!db?.prepare||!validSession(session))throw Error('Authenticated Finance session required');
 const row=await db.prepare(`SELECT token_id FROM neo_fin_session_revocations
  WHERE account_id=? AND token_id=? LIMIT 1`).bind(session.accountId,session.tokenId).first();
 return Boolean(row);
}
export async function revokeFinanceSession(db,session){
 if(!db?.prepare||!validSession(session))throw Error('Authenticated Finance session required');
 const result=await db.prepare(`INSERT INTO neo_fin_session_revocations(account_id,token_id,expires_at)
  VALUES (?,?,?) ON CONFLICT(account_id,token_id) DO NOTHING`)
  .bind(session.accountId,session.tokenId,session.expiresAt).run();
 if(result?.success!==true||![0,1].includes(result?.meta?.changes))
  throw Error('Finance logout storage unavailable');
 return Object.freeze({revoked:true,newlyRevoked:result.meta.changes===1});
}
