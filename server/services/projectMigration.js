export async function migrateProjects(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      application_id TEXT NOT NULL,
      legacy_project_id TEXT,
      title TEXT,
      project_narrative TEXT,
      work_plan TEXT,
      project_type TEXT,
      funding_type TEXT CHECK (funding_type IN ('Pass-Through','Retained')),
      ij_title TEXT,
      ij_funding_priority TEXT,
      ij_number TEXT,
      ij_core_capability TEXT,
      national_priority_area TEXT,
      letpa_eligible BOOLEAN,
      shareable BOOLEAN,
      deployable BOOLEAN,
      is_active BOOLEAN NOT NULL DEFAULT true,
      project_zip TEXT CHECK (project_zip IS NULL OR project_zip ~ '^[0-9]{5}$'),
      awarded_amount NUMERIC,
      is_legacy_backfill BOOLEAN NOT NULL DEFAULT false,
      created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE grant_programs ADD COLUMN IF NOT EXISTS project_field_config JSONB NOT NULL DEFAULT '{}'::jsonb;
    ALTER TABLE grant_programs DROP CONSTRAINT IF EXISTS grant_programs_code_check;
    ALTER TABLE grant_programs ADD CONSTRAINT grant_programs_code_check CHECK (code IN ('SHSP','UASI','EMPG','HSGP','NSGP','EOC','EOCGP','NE-NSGP','NSGP-NSS','SLCGP','BRIC','Other'));
    INSERT INTO grant_programs(name,code,description,is_active,project_field_config)
      SELECT 'Emergency Operations Center Grant Program','EOCGP','SPARS import program; follows EOC application behavior.',true,'{}'::jsonb
      WHERE NOT EXISTS (SELECT 1 FROM grant_programs WHERE code='EOCGP');
    INSERT INTO grant_programs(name,code,description,is_active,project_field_config)
      SELECT 'Nebraska Nonprofit Security Grant Program','NE-NSGP','SPARS import program; follows NSGP application behavior.',true,'{}'::jsonb
      WHERE NOT EXISTS (SELECT 1 FROM grant_programs WHERE code='NE-NSGP');
    INSERT INTO grant_programs(name,code,description,is_active,project_field_config)
      SELECT 'NSGP Nonprofit Security Supplemental','NSGP-NSS','SPARS import program; follows NSGP application behavior.',true,'{}'::jsonb
      WHERE NOT EXISTS (SELECT 1 FROM grant_programs WHERE code='NSGP-NSS');
    ALTER TABLE nofos ADD COLUMN IF NOT EXISTS project_field_config JSONB NOT NULL DEFAULT '{}'::jsonb;
    ALTER TABLE nofos ADD COLUMN IF NOT EXISTS project_investments JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE nofos ADD COLUMN IF NOT EXISTS national_priority_areas JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE application_budgets ADD COLUMN IF NOT EXISTS project_id TEXT;
    ALTER TABLE application_budgets ADD COLUMN IF NOT EXISTS ael_number TEXT;
    ALTER TABLE application_budgets ADD COLUMN IF NOT EXISTS ael_category TEXT;
    ALTER TABLE application_budgets ADD COLUMN IF NOT EXISTS vulnerability_addressed TEXT;
    ALTER TABLE applications ADD COLUMN IF NOT EXISTS legacy_subaward_id TEXT;
    ALTER TABLE applications ADD COLUMN IF NOT EXISTS original_award_amount NUMERIC;
    ALTER TABLE funding_requests ADD COLUMN IF NOT EXISTS project_id TEXT;
    ALTER TABLE funding_requests ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
    ALTER TABLE funding_request_line_items ADD COLUMN IF NOT EXISTS project_id TEXT;
    ALTER TABLE funding_request_line_items ADD COLUMN IF NOT EXISTS legacy_expenditure_id TEXT;
    ALTER TABLE funding_request_line_items ADD COLUMN IF NOT EXISTS amount_match NUMERIC NOT NULL DEFAULT 0 CHECK (amount_match >= 0);
    CREATE UNIQUE INDEX IF NOT EXISTS funding_line_legacy_expenditure_unique ON funding_request_line_items(legacy_expenditure_id) WHERE legacy_expenditure_id IS NOT NULL AND btrim(legacy_expenditure_id) <> '';
    CREATE UNIQUE INDEX IF NOT EXISTS applications_legacy_subaward_id_unique ON applications(legacy_subaward_id) WHERE legacy_subaward_id IS NOT NULL AND btrim(legacy_subaward_id) <> '';
    ALTER TABLE progress_reports ADD COLUMN IF NOT EXISTS project_id TEXT;
    ALTER TABLE progress_reports ADD COLUMN IF NOT EXISTS change_request_number NUMERIC;
    ALTER TABLE progress_reports ADD COLUMN IF NOT EXISTS review_number NUMERIC;
    ALTER TABLE progress_reports ADD COLUMN IF NOT EXISTS complete_number NUMERIC;
    ALTER TABLE progress_reports ADD COLUMN IF NOT EXISTS on_order_number NUMERIC;
    ALTER TABLE progress_reports ADD COLUMN IF NOT EXISTS needs_poe_number NUMERIC;
    ALTER TABLE progress_reports ADD COLUMN IF NOT EXISTS invoiced_number NUMERIC;
    ALTER TABLE progress_reports ADD COLUMN IF NOT EXISTS uncommitted_number NUMERIC;
    DO $$ BEGIN
      IF to_regclass(current_schema()||'.review_comments') IS NOT NULL THEN
        ALTER TABLE review_comments ADD COLUMN IF NOT EXISTS project_id TEXT;
      END IF;
    END $$;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS project_id TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS projects_legacy_project_id_unique
      ON projects (legacy_project_id)
      WHERE legacy_project_id IS NOT NULL AND btrim(legacy_project_id) <> '';
    INSERT INTO projects(application_id,title,project_narrative,work_plan,awarded_amount,is_legacy_backfill)
      SELECT a.id,NULLIF(a.project_title,''),a.project_narrative,a.work_plan,a.awarded_amount,true
      FROM applications a
      WHERE NOT EXISTS (SELECT 1 FROM projects p WHERE p.application_id=a.id::text);
    UPDATE application_budgets b SET project_id=p.id::text
      FROM projects p WHERE p.application_id=b.application_id AND b.project_id IS NULL;
    CREATE INDEX IF NOT EXISTS idx_projects_application ON projects(application_id);
    CREATE INDEX IF NOT EXISTS idx_app_budgets_project ON application_budgets(project_id);
    CREATE INDEX IF NOT EXISTS idx_funding_requests_project ON funding_requests(project_id);
    CREATE INDEX IF NOT EXISTS idx_funding_lines_project ON funding_request_line_items(project_id);
    CREATE INDEX IF NOT EXISTS idx_progress_reports_project ON progress_reports(project_id);
  `);
}
