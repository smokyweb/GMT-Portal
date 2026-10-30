export async function migrateEhp(db) {
  await db.query(`
    ALTER TABLE funding_requests DROP CONSTRAINT IF EXISTS funding_requests_status_check;
    ALTER TABLE funding_requests ADD CONSTRAINT funding_requests_status_check CHECK(status IN ('Draft','Submitted','UnderReview','AdditionalInfoRequested','Approved','Denied'));
    ALTER TABLE applications ADD COLUMN IF NOT EXISTS ehp_manual_required BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE applications ADD COLUMN IF NOT EXISTS ehp_review_revision INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE application_budgets ADD COLUMN IF NOT EXISTS ehp_affected BOOLEAN;
    ALTER TABLE funding_request_line_items ADD COLUMN IF NOT EXISTS application_budget_id UUID REFERENCES application_budgets(id);
    ALTER TABLE funding_request_line_items ADD COLUMN IF NOT EXISTS ehp_affected BOOLEAN;
    CREATE TABLE IF NOT EXISTS ehp_decisions (
      id UUID PRIMARY KEY,application_id UUID NOT NULL REFERENCES applications(id),
      decision TEXT NOT NULL,approval_reference TEXT,approval_date DATE,notes TEXT NOT NULL DEFAULT '',
      recorded_by TEXT NOT NULL,recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),revision INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ehp_decisions_application ON ehp_decisions(application_id,revision);
  `);
}
