export async function migrateNofoFields(pool){
  await pool.query(    `ALTER TABLE nofos
      ADD COLUMN IF NOT EXISTS fiscal_year INTEGER,
      ADD COLUMN IF NOT EXISTS federal_period_start DATE,
      ADD COLUMN IF NOT EXISTS federal_period_end DATE,
      ADD COLUMN IF NOT EXISTS local_share_amount NUMERIC,
      ADD COLUMN IF NOT EXISTS state_share_amount NUMERIC,
      ADD COLUMN IF NOT EXISTS mou_amount NUMERIC,
      ADD COLUMN IF NOT EXISTS local_share_pct NUMERIC GENERATED ALWAYS AS (CASE WHEN total_funding_available IS NOT NULL AND total_funding_available <> 0 AND local_share_amount IS NOT NULL THEN local_share_amount / total_funding_available * 100 ELSE NULL END) STORED,
      ADD COLUMN IF NOT EXISTS state_share_pct NUMERIC GENERATED ALWAYS AS (CASE WHEN total_funding_available IS NOT NULL AND total_funding_available <> 0 AND state_share_amount IS NOT NULL THEN state_share_amount / total_funding_available * 100 ELSE NULL END) STORED,
      ADD COLUMN IF NOT EXISTS legacy_grant_id TEXT;`
  );
  await pool.query("ALTER TABLE nofos DROP CONSTRAINT IF EXISTS nofos_fiscal_year_check, ADD CONSTRAINT nofos_fiscal_year_check CHECK (fiscal_year IS NULL OR fiscal_year BETWEEN 1000 AND 9999)");
  await pool.query("ALTER TABLE nofos DROP CONSTRAINT IF EXISTS nofos_federal_period_order_check, ADD CONSTRAINT nofos_federal_period_order_check CHECK (federal_period_start IS NULL OR federal_period_end IS NULL OR federal_period_end >= federal_period_start)");
  await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS nofos_legacy_grant_id_unique ON nofos (legacy_grant_id) WHERE legacy_grant_id IS NOT NULL AND btrim(legacy_grant_id) <> ''");
}
