-- Finance ONE dedicated personal credentials. Staging only: not deployed.
-- Provision through separately authorized invitation/bootstrap operations only.
CREATE TABLE IF NOT EXISTS neo_fin_auth_accounts (
 account_id TEXT PRIMARY KEY,
 salt TEXT NOT NULL CHECK(length(salt)=32),
 password_hash TEXT NOT NULL CHECK(length(password_hash)=64),
 iterations INTEGER NOT NULL CHECK(iterations>=210000),
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN(0,1)),
 failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK(failed_attempts>=0),
 locked_until INTEGER,
 credential_version INTEGER NOT NULL DEFAULT 1 CHECK(credential_version>=1),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS neo_fin_auth_active ON neo_fin_auth_accounts(active);
-- Password resets and account suspensions must increment credential_version.
-- Every Finance request rechecks credential_version and active in the database.
