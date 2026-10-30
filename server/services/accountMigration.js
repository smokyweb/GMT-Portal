export async function migrateAccountAccess(db) {
  await db.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_version INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS password_change_required BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS scope_state VARCHAR(2);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS active_status VARCHAR(32) DEFAULT 'active';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_name TEXT;
    CREATE TABLE IF NOT EXISTS account_access_tokens (
      token_hash TEXT PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      purpose TEXT NOT NULL CHECK (purpose IN ('invite','reset')),
      expires_at TIMESTAMPTZ NOT NULL, used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS account_access_tokens_user ON account_access_tokens(user_id);
  `);
}
