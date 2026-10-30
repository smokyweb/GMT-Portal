import {migrateExistingFormSnapshots} from './existingFormSnapshots.js';
import {migrateProgramFormDefaults} from './programFormMigration.js';
export async function migrateNofoForms(db) {
  await migrateProgramFormDefaults(db);
  await db.query(`
    CREATE TABLE IF NOT EXISTS nofo_form_versions (
      id UUID PRIMARY KEY,
      nofo_id UUID NOT NULL REFERENCES nofos(id) ON DELETE CASCADE,
      version INTEGER NOT NULL,
      revision INTEGER NOT NULL DEFAULT 1,
      definition JSONB NOT NULL,
      locked_at TIMESTAMPTZ,
      created_by TEXT NOT NULL,
      created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(nofo_id,version)
    );
    ALTER TABLE nofo_form_versions ADD COLUMN IF NOT EXISTS program_default_version_id UUID REFERENCES grant_program_form_versions(id);
    ALTER TABLE nofos ADD COLUMN IF NOT EXISTS current_form_version_id UUID REFERENCES nofo_form_versions(id);
    ALTER TABLE applications ADD COLUMN IF NOT EXISTS form_version_id UUID REFERENCES nofo_form_versions(id);
    ALTER TABLE applications ADD COLUMN IF NOT EXISTS form_values JSONB NOT NULL DEFAULT '{}';
    CREATE INDEX IF NOT EXISTS applications_form_version ON applications(form_version_id);
  `);
  await migrateExistingFormSnapshots(db);
}
