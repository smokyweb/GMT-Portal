import {NOFO_AWARD_FIELDS} from '../../../src/lib/awards/awardFields.js';
import {transaction} from '../accountRepository.js';
import {ensureAwardSnapshot} from './awardRepository.js';
export async function migrateAwards(pool) {
  const type=field=>field.type==='date'?'DATE':field.type==='boolean'?'BOOLEAN':field.type==='year'?'INTEGER':['money','percent'].includes(field.type)?'NUMERIC':'TEXT';
  for(const field of NOFO_AWARD_FIELDS)await pool.query('ALTER TABLE nofos ADD COLUMN IF NOT EXISTS '+field.key+' '+type(field));
  await pool.query(`
    ALTER TABLE nofos ADD COLUMN IF NOT EXISTS award_metadata_revision INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE grant_programs ADD COLUMN IF NOT EXISTS ma_limit_percent NUMERIC CHECK(ma_limit_percent BETWEEN 0 AND 100);
    CREATE TABLE IF NOT EXISTS award_details (
      id UUID PRIMARY KEY,application_id UUID NOT NULL UNIQUE REFERENCES applications(id),
      nofo_id TEXT,fields JSONB NOT NULL,origins JSONB NOT NULL DEFAULT '{}',field_overrides JSONB NOT NULL DEFAULT '{}',
      revision INTEGER NOT NULL DEFAULT 0,created_by TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS award_details_subaward_number ON award_details(nofo_id,LOWER(NULLIF(fields->>'subaward_number','')));
    CREATE TABLE IF NOT EXISTS gmt_award_migrations(name TEXT PRIMARY KEY,applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
  `);
  await transaction(pool,async db=>{
    await db.query("SELECT pg_advisory_xact_lock(hashtext(current_schema()||':award-details-migration'))");
    if((await db.query("SELECT name FROM gmt_award_migrations WHERE name='initial-award-details-v1'")).rows.length)return;
    const applications=(await db.query("SELECT * FROM applications WHERE status IN ('Approved','Closed') ORDER BY id FOR UPDATE")).rows;
    for(const application of applications)await ensureAwardSnapshot(db,application,{email:'system:gmt-award-migration',full_name:'GMT award migration'});
    await db.query("INSERT INTO gmt_award_migrations(name) VALUES('initial-award-details-v1')");
  });
}
