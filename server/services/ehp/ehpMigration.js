export async function migrateEhp(db) {
  await db.query(`
    ALTER TABLE funding_requests DROP CONSTRAINT IF EXISTS funding_requests_status_check;
    ALTER TABLE funding_requests ADD CONSTRAINT funding_requests_status_check CHECK(status IN ('Draft','Submitted','UnderReview','AdditionalInfoRequested','Approved','Denied','Complete','Vouchered','Build'));
    ALTER TABLE applications ADD COLUMN IF NOT EXISTS ehp_manual_required BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE applications ADD COLUMN IF NOT EXISTS ehp_review_revision INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE application_budgets ADD COLUMN IF NOT EXISTS ehp_affected BOOLEAN;
    ALTER TABLE funding_request_line_items ADD COLUMN IF NOT EXISTS application_budget_id UUID REFERENCES application_budgets(id);
    ALTER TABLE funding_request_line_items ADD COLUMN IF NOT EXISTS ehp_affected BOOLEAN;
    ALTER TABLE funding_request_line_items ADD COLUMN IF NOT EXISTS ael_number TEXT;
    ALTER TABLE funding_request_line_items ADD COLUMN IF NOT EXISTS ael_category TEXT;
    ALTER TABLE funding_request_line_items ADD COLUMN IF NOT EXISTS vendor TEXT;
    ALTER TABLE funding_request_line_items ADD COLUMN IF NOT EXISTS invoice_number TEXT;
    ALTER TABLE funding_request_line_items ADD COLUMN IF NOT EXISTS invoice_date DATE;
    ALTER TABLE funding_request_line_items ADD COLUMN IF NOT EXISTS expenditure_name TEXT;
    ALTER TABLE funding_request_line_items ADD COLUMN IF NOT EXISTS quantity NUMERIC;
    ALTER TABLE funding_request_line_items ADD COLUMN IF NOT EXISTS unit_cost NUMERIC;
    ALTER TABLE funding_request_line_items ADD COLUMN IF NOT EXISTS amount_requested NUMERIC;
    ALTER TABLE funding_request_line_items ADD COLUMN IF NOT EXISTS amount_approved NUMERIC;
    ALTER TABLE funding_request_line_items ADD COLUMN IF NOT EXISTS amount_paid NUMERIC;
    ALTER TABLE funding_request_line_items ADD COLUMN IF NOT EXISTS amount_subgrantee NUMERIC NOT NULL DEFAULT 0 CHECK (amount_subgrantee >= 0);
    CREATE TABLE IF NOT EXISTS ehp_decisions (
      id UUID PRIMARY KEY,application_id UUID NOT NULL REFERENCES applications(id),
      decision TEXT NOT NULL,approval_reference TEXT,approval_date DATE,notes TEXT NOT NULL DEFAULT '',
      recorded_by TEXT NOT NULL,recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),revision INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ehp_decisions_application ON ehp_decisions(application_id,revision);
  `);
}
