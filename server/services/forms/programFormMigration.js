export async function migrateProgramFormDefaults(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS grant_program_form_versions (
      id UUID PRIMARY KEY,
      program_id UUID NOT NULL REFERENCES grant_programs(id) ON DELETE CASCADE,
      scope_state VARCHAR(2) NOT NULL DEFAULT '',
      version INTEGER NOT NULL,
      definition JSONB NOT NULL,
      created_by TEXT NOT NULL,
      created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(program_id,scope_state,version)
    );
  `);
}
