-- Finance ONE staging only. Dedicated independent Finance-session revocation.
-- A browser sign-out revokes ONLY that login token, not other Finance devices.
CREATE TABLE IF NOT EXISTS neo_fin_session_revocations (
  account_id TEXT NOT NULL REFERENCES neo_fin_auth_accounts(account_id),
  token_id TEXT NOT NULL CHECK(length(token_id)=48 AND token_id NOT GLOB '*[^0-9a-f]*'),
  expires_at INTEGER NOT NULL CHECK(expires_at>0),
  revoked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(account_id,token_id)
);
CREATE INDEX IF NOT EXISTS neo_fin_session_revocations_expiration
 ON neo_fin_session_revocations(expires_at);
-- This record is an audit fact. Expired rows can later be removed by a
-- separate authorized retention job; nobody can restore a signed-out token.
CREATE TRIGGER IF NOT EXISTS neo_fin_session_revocations_no_update
 BEFORE UPDATE ON neo_fin_session_revocations
 BEGIN SELECT RAISE(ABORT,'Revoked Finance session immutable'); END;
