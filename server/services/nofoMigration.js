export async function migrateNofoFields(pool){
  const columns=new Set((await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='nofos'")).rows.map(row=>row.column_name));
  await pool.query(    `ALTER TABLE nofos
      ADD COLUMN IF NOT EXISTS fiscal_year INTEGER,
      ADD COLUMN IF NOT EXISTS local_share_amount NUMERIC,
      ADD COLUMN IF NOT EXISTS state_share_amount NUMERIC,
      ADD COLUMN IF NOT EXISTS mou_amount NUMERIC,
      ADD COLUMN IF NOT EXISTS local_share_pct NUMERIC GENERATED ALWAYS AS (CASE WHEN total_funding_available IS NOT NULL AND total_funding_available <> 0 AND local_share_amount IS NOT NULL THEN local_share_amount / total_funding_available * 100 ELSE NULL END) STORED,
      ADD COLUMN IF NOT EXISTS state_share_pct NUMERIC GENERATED ALWAYS AS (CASE WHEN total_funding_available IS NOT NULL AND total_funding_available <> 0 AND state_share_amount IS NOT NULL THEN state_share_amount / total_funding_available * 100 ELSE NULL END) STORED,
      ADD COLUMN IF NOT EXISTS legacy_grant_id TEXT;`
  );
  if(columns.has('grant_year'))await pool.query('UPDATE nofos SET fiscal_year=COALESCE(fiscal_year,grant_year) WHERE grant_year IS NOT NULL');
  if(columns.has('federal_period_start')&&columns.has('federal_performance_start'))await pool.query('UPDATE nofos SET federal_performance_start=COALESCE(federal_performance_start,federal_period_start), federal_performance_end=COALESCE(federal_performance_end,federal_period_end) WHERE federal_period_start IS NOT NULL OR federal_period_end IS NOT NULL');
  await pool.query("ALTER TABLE nofos DROP COLUMN IF EXISTS grant_year, DROP COLUMN IF EXISTS federal_period_start, DROP COLUMN IF EXISTS federal_period_end");
  await pool.query("ALTER TABLE nofos DROP CONSTRAINT IF EXISTS nofos_fiscal_year_check, ADD CONSTRAINT nofos_fiscal_year_check CHECK (fiscal_year IS NULL OR fiscal_year BETWEEN 1000 AND 9999)");
  await pool.query("ALTER TABLE nofos DROP CONSTRAINT IF EXISTS nofos_federal_pop_order_check, ADD CONSTRAINT nofos_federal_pop_order_check CHECK (federal_performance_start IS NULL OR federal_performance_end IS NULL OR federal_performance_end >= federal_performance_start)");
  await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS nofos_legacy_grant_id_unique ON nofos (legacy_grant_id) WHERE legacy_grant_id IS NOT NULL AND btrim(legacy_grant_id) <> ''");
}
