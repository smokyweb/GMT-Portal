-- GMT Portal – PostgreSQL schema
-- Every table gets: id (UUID PK), created_date, updated_date

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- helper: auto-set updated_date on UPDATE
CREATE OR REPLACE FUNCTION set_updated_date()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_date = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 1. grant_programs
-- ============================================================
CREATE TABLE IF NOT EXISTS grant_programs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  code          TEXT NOT NULL CHECK (code IN ('SHSP','UASI','EMPG','HSGP','NSGP','EOC','SLCGP','Other')),
  description   TEXT,
  federal_agency TEXT,
  cfda_number   TEXT,
  is_active     BOOLEAN DEFAULT true,
  created_date  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. grantees
-- ============================================================
CREATE TABLE IF NOT EXISTS grantees (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  state_code      TEXT NOT NULL,
  agency_name     TEXT,
  contact_name    TEXT,
  contact_email   TEXT,
  contact_phone   TEXT,
  address         TEXT,
  city            TEXT,
  state           TEXT,
  zip             TEXT,
  logo_url        TEXT,
  primary_color   TEXT,
  secondary_color TEXT,
  portal_title    TEXT,
  portal_subtitle TEXT,
  is_active       BOOLEAN DEFAULT true,
  max_users       NUMERIC,
  notes           TEXT,
  grant_programs  JSONB DEFAULT '[]',
  created_date    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. organizations
-- ============================================================
CREATE TABLE IF NOT EXISTS organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('County','Municipality','Nonprofit','Tribe')),
  ein         TEXT,
  sam_uei     TEXT,
  address     TEXT,
  city        TEXT,
  state       TEXT,
  zip         TEXT,
  county      TEXT,
  is_active   BOOLEAN DEFAULT true,
  created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 4. users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT UNIQUE NOT NULL,
  full_name       TEXT,
  password_hash   TEXT NOT NULL,
  role            TEXT DEFAULT 'user' CHECK (role IN ('admin','user','reviewer','isc_admin')),
  grantee_id      TEXT,
  title           TEXT,
  department      TEXT,
  phone           TEXT,
  organization_id TEXT,
  created_date    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 5. nofos (Notices of Funding Opportunity)
-- ============================================================
CREATE TABLE IF NOT EXISTS nofos (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                 TEXT NOT NULL,
  summary               TEXT,
  program_id            TEXT,
  program_name          TEXT,
  program_code          TEXT,
  eligibility_criteria  TEXT,
  allowable_costs       TEXT,
  evaluation_criteria   TEXT,
  total_funding_available NUMERIC,
  min_award             NUMERIC,
  max_award             NUMERIC,
  open_date             DATE,
  close_date            DATE,
  status                TEXT NOT NULL CHECK (status IN ('Draft','UnderReview','Published','Closed','Archived')),
  required_documents    JSONB DEFAULT '[]',
  reviewed_by           TEXT,
  published_at          TIMESTAMPTZ,
  created_date          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 6. applications
-- ============================================================
CREATE TABLE IF NOT EXISTS applications (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nofo_id            TEXT NOT NULL,
  nofo_title         TEXT,
  organization_id    TEXT NOT NULL,
  organization_name  TEXT,
  submitted_by       TEXT,
  application_number TEXT,
  project_title      TEXT,
  project_narrative  TEXT,
  work_plan          TEXT,
  risk_assessment    TEXT,
  requested_amount   NUMERIC,
  awarded_amount     NUMERIC,
  match_amount       NUMERIC,
  total_expended     NUMERIC,
  remaining_balance  NUMERIC,
  expenditure_rate   NUMERIC,
  performance_start  DATE,
  performance_end    DATE,
  status             TEXT NOT NULL CHECK (status IN ('Draft','Submitted','PendingReview','UnderReview','RevisionRequested','Approved','Denied')),
  program_code       TEXT,
  program_name       TEXT,
  version            NUMERIC,
  submitted_at       TIMESTAMPTZ,
  revision_notes     TEXT,
  created_date       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 7. application_budgets
-- ============================================================
CREATE TABLE IF NOT EXISTS application_budgets (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id   TEXT NOT NULL,
  budget_category  TEXT NOT NULL CHECK (budget_category IN ('Personnel','Equipment','Training','Travel','Contractual','Planning','Other')),
  line_description TEXT,
  amount_requested NUMERIC,
  amount_match     NUMERIC,
  is_allowable     BOOLEAN,
  reviewer_notes   TEXT,
  created_date     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 8. application_reviews
-- ============================================================
CREATE TABLE IF NOT EXISTS application_reviews (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id   TEXT NOT NULL,
  reviewer_email   TEXT,
  reviewer_name    TEXT,
  action           TEXT NOT NULL CHECK (action IN ('Approved','Denied','RevisionRequested','NoteAdded')),
  score            NUMERIC,
  notes            TEXT,
  revision_request TEXT,
  created_date     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 9. audit_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email  TEXT,
  user_name   TEXT,
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   TEXT,
  description TEXT,
  created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 10. compliance_flags
-- ============================================================
CREATE TABLE IF NOT EXISTS compliance_flags (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id     TEXT NOT NULL,
  application_number TEXT,
  organization_name  TEXT,
  flag_type          TEXT NOT NULL CHECK (flag_type IN ('OverdueReport','MissingDocument','FinancialDiscrepancy','MatchShortfall')),
  description        TEXT,
  severity           TEXT NOT NULL CHECK (severity IN ('Low','Medium','High','Critical')),
  is_resolved        BOOLEAN DEFAULT false,
  resolved_by        TEXT,
  resolved_at        TIMESTAMPTZ,
  created_date       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 11. documents
-- ============================================================
CREATE TABLE IF NOT EXISTS documents (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  doc_type            TEXT NOT NULL CHECK (doc_type IN ('Invoice','PerformanceEvidence','Contract','BudgetJustification','MatchDocumentation','ProgressNarrative','FinalReport','Other')),
  file_url            TEXT,
  uploaded_by         TEXT,
  organization_id     TEXT,
  application_id      TEXT,
  application_number  TEXT,
  organization_name   TEXT,
  tags                JSONB DEFAULT '[]',
  version             NUMERIC,
  parent_document_id  TEXT,
  description         TEXT,
  review_status       TEXT CHECK (review_status IN ('Pending','Approved','Rejected')),
  reviewer_email      TEXT,
  reviewer_notes      TEXT,
  reviewed_at         TIMESTAMPTZ,
  is_template         BOOLEAN DEFAULT false,
  uploaded_at         TIMESTAMPTZ,
  created_date        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 12. document_templates
-- ============================================================
CREATE TABLE IF NOT EXISTS document_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  doc_type        TEXT NOT NULL CHECK (doc_type IN ('Grant Award Notice','Subrecipient Agreement','Quarterly Report Form','Final Report Form','Audit Request','Budget Modification Form','Close-Out Letter','Other')),
  description     TEXT,
  template_body   TEXT,
  file_url        TEXT,
  file_name       TEXT,
  is_active       BOOLEAN DEFAULT true,
  created_by_name TEXT,
  created_date    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 13. funding_requests
-- ============================================================
CREATE TABLE IF NOT EXISTS funding_requests (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id           TEXT NOT NULL,
  application_number       TEXT,
  organization_id          TEXT,
  organization_name        TEXT,
  submitted_by             TEXT,
  request_number           TEXT,
  request_type             TEXT NOT NULL CHECK (request_type IN ('Reimbursement','Advance','Modification')),
  period_start             DATE,
  period_end               DATE,
  amount_requested         NUMERIC,
  amount_approved          NUMERIC,
  match_documented         NUMERIC,
  expenditure_rate         NUMERIC,
  remaining_balance        NUMERIC,
  modification_type        TEXT CHECK (modification_type IN ('Budget Modification','Scope of Work Change','Period of Performance Extension','Key Personnel Change','Other')),
  modification_justification TEXT,
  scope_of_work_current    TEXT,
  scope_of_work_proposed   TEXT,
  budget_modification_notes TEXT,
  status                   TEXT NOT NULL CHECK (status IN ('Submitted','UnderReview','AdditionalInfoRequested','Approved','Denied')),
  reviewer_notes           TEXT,
  modification_notes       TEXT,
  program_code             TEXT,
  created_date             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 14. funding_request_line_items
-- ============================================================
CREATE TABLE IF NOT EXISTS funding_request_line_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funding_request_id TEXT NOT NULL,
  budget_category    TEXT NOT NULL CHECK (budget_category IN ('Personnel','Equipment','Training','Travel','Contractual','Planning','Other')),
  description        TEXT,
  amount             NUMERIC,
  is_allowable       BOOLEAN,
  reviewer_notes     TEXT,
  created_date       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 15. generated_documents
-- ============================================================
CREATE TABLE IF NOT EXISTS generated_documents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id       TEXT NOT NULL,
  template_name     TEXT,
  doc_type          TEXT,
  application_id    TEXT NOT NULL,
  application_number TEXT,
  organization_id   TEXT,
  organization_name TEXT,
  populated_body    TEXT,
  file_url          TEXT,
  file_name         TEXT,
  sent_by           TEXT,
  sent_at           TIMESTAMPTZ,
  status            TEXT NOT NULL DEFAULT 'Sent' CHECK (status IN ('Sent','Reviewed','Signed','Rejected')),
  subrecipient_notes TEXT,
  signed_at         TIMESTAMPTZ,
  signed_by         TEXT,
  created_date      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 16. messages
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id           TEXT NOT NULL,
  application_number       TEXT,
  organization_name        TEXT,
  thread_id                TEXT,
  parent_id                TEXT,
  sender_email             TEXT NOT NULL,
  sender_name              TEXT,
  sender_role              TEXT,
  body                     TEXT NOT NULL,
  topic                    TEXT CHECK (topic IN ('General','Budget','Compliance','Documentation','Timeline','Other')),
  is_read_by_admin         BOOLEAN DEFAULT false,
  is_read_by_subrecipient  BOOLEAN DEFAULT false,
  created_date             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 17. milestones
-- ============================================================
CREATE TABLE IF NOT EXISTS milestones (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id     TEXT NOT NULL,
  application_number TEXT,
  organization_name  TEXT,
  organization_id    TEXT,
  program_code       TEXT,
  title              TEXT NOT NULL,
  description        TEXT,
  milestone_type     TEXT CHECK (milestone_type IN ('ProjectKickoff','MidTermReview','FinalReport','BudgetReview','SiteVisit','QuarterlyCheck','CloseOut','Custom')),
  due_date           DATE NOT NULL,
  completed_date     DATE,
  status             TEXT NOT NULL CHECK (status IN ('Upcoming','InProgress','Completed','Overdue','Waived')),
  assigned_to        TEXT,
  reminder_sent      BOOLEAN DEFAULT false,
  notes              TEXT,
  created_date       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 18. notifications
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email  TEXT NOT NULL,
  title       TEXT NOT NULL,
  message     TEXT NOT NULL,
  type        TEXT,
  entity_type TEXT,
  entity_id   TEXT,
  is_read     BOOLEAN DEFAULT false,
  link        TEXT,
  created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 19. progress_reports
-- ============================================================
CREATE TABLE IF NOT EXISTS progress_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id     TEXT NOT NULL,
  application_id  TEXT NOT NULL,
  submitted_by    TEXT,
  narrative       TEXT,
  expenditure_ytd NUMERIC,
  match_ytd       NUMERIC,
  objectives_met  TEXT,
  challenges      TEXT,
  status          TEXT NOT NULL CHECK (status IN ('Submitted','UnderReview','Approved','Denied','RevisionRequested')),
  reviewer_id     TEXT,
  reviewer_notes  TEXT,
  submitted_at    TIMESTAMPTZ,
  created_date    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 20. report_schedules
-- ============================================================
CREATE TABLE IF NOT EXISTS report_schedules (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id     TEXT NOT NULL,
  application_number TEXT,
  organization_name  TEXT,
  program_code       TEXT,
  report_type        TEXT NOT NULL CHECK (report_type IN ('Quarterly','Annual','Final')),
  period_start       DATE,
  period_end         DATE,
  due_date           DATE,
  status             TEXT NOT NULL CHECK (status IN ('Pending','Submitted','Overdue','Approved','Denied')),
  created_date       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 21. saved_reports
-- ============================================================
CREATE TABLE IF NOT EXISTS saved_reports (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_name        TEXT NOT NULL,
  organization_id    TEXT,
  data_source        TEXT NOT NULL,
  selected_fields    JSONB DEFAULT '[]',
  filters            JSONB DEFAULT '[]',
  filter_logic       TEXT DEFAULT 'AND' CHECK (filter_logic IN ('AND','OR')),
  group_by           JSONB DEFAULT '[]',
  sort_rules         JSONB DEFAULT '[]',
  is_template        BOOLEAN DEFAULT false,
  last_run_at        TIMESTAMPTZ,
  last_run_row_count NUMERIC,
  created_date       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 22. template_versions
-- ============================================================
CREATE TABLE IF NOT EXISTS template_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     TEXT NOT NULL,
  template_name   TEXT,
  version_number  NUMERIC NOT NULL,
  name            TEXT,
  doc_type        TEXT,
  description     TEXT,
  template_body   TEXT,
  file_url        TEXT,
  file_name       TEXT,
  saved_by        TEXT,
  change_note     TEXT,
  created_date    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 23. workflow_rules
-- ============================================================
CREATE TABLE IF NOT EXISTS workflow_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  trigger         TEXT NOT NULL CHECK (trigger IN ('Document Uploaded','Application Status Changed','Compliance Flag Created','Compliance Flag Resolved','Funding Request Submitted','Funding Request Approved','Report Due Date Passed','Milestone Due Date Passed','Application Submitted')),
  condition       TEXT,
  action_type     TEXT NOT NULL CHECK (action_type IN ('Send Email Notification','Transition Application Status','Create Compliance Flag','Send Email to Admins','Send Email to Subrecipient')),
  action_detail   TEXT,
  target_status   TEXT CHECK (target_status IN ('Draft','Submitted','PendingReview','UnderReview','RevisionRequested','Approved','Denied')),
  email_subject   TEXT,
  email_body      TEXT,
  entity          TEXT,
  is_active       BOOLEAN DEFAULT true,
  created_by_name TEXT,
  created_date    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- updated_date triggers for all tables
-- ============================================================
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'grant_programs','grantees','organizations','users','nofos',
      'applications','application_budgets','application_reviews',
      'audit_logs','compliance_flags','documents','document_templates',
      'funding_requests','funding_request_line_items','generated_documents',
      'messages','milestones','notifications','progress_reports',
      'report_schedules','saved_reports','template_versions','workflow_rules'
    ])
  LOOP
    EXECUTE format(
      'CREATE OR REPLACE TRIGGER trg_%s_updated
       BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION set_updated_date()',
      tbl, tbl
    );
  END LOOP;
END;
$$;

-- ============================================================
-- Indexes for common filter/sort patterns
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_applications_org     ON applications(organization_id);
CREATE INDEX IF NOT EXISTS idx_applications_status  ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_nofo    ON applications(nofo_id);
CREATE INDEX IF NOT EXISTS idx_app_budgets_app      ON application_budgets(application_id);
CREATE INDEX IF NOT EXISTS idx_app_reviews_app      ON application_reviews(application_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity    ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_compliance_app       ON compliance_flags(application_id);
CREATE INDEX IF NOT EXISTS idx_documents_app        ON documents(application_id);
CREATE INDEX IF NOT EXISTS idx_documents_org        ON documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_funding_req_app      ON funding_requests(application_id);
CREATE INDEX IF NOT EXISTS idx_fr_line_items_fr     ON funding_request_line_items(funding_request_id);
CREATE INDEX IF NOT EXISTS idx_gen_docs_app         ON generated_documents(application_id);
CREATE INDEX IF NOT EXISTS idx_messages_app         ON messages(application_id);
CREATE INDEX IF NOT EXISTS idx_messages_thread      ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_milestones_app       ON milestones(application_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user   ON notifications(user_email);
CREATE INDEX IF NOT EXISTS idx_progress_reports_app ON progress_reports(application_id);
CREATE INDEX IF NOT EXISTS idx_report_sched_app     ON report_schedules(application_id);
CREATE INDEX IF NOT EXISTS idx_template_ver_tpl     ON template_versions(template_id);
