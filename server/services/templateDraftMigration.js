export async function migrateTemplateDrafts(db) {
  await db.query(`
    ALTER TABLE document_templates
      ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Active';
    UPDATE document_templates SET status='Active' WHERE status IS NULL;
    ALTER TABLE document_templates DROP CONSTRAINT IF EXISTS document_templates_status_check;
    ALTER TABLE document_templates
      ADD CONSTRAINT document_templates_status_check CHECK (status IN ('Draft','Active','Archived'));
  `);
}
