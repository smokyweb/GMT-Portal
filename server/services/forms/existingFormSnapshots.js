import {randomUUID} from 'node:crypto';
import {transaction} from '../accountRepository.js';
import {auditForm} from './formAccess.js';
import {legacyForm} from '../../../src/lib/forms/legacyForm.js';
export async function pinExistingApplications(db,nofo,actor,definition=legacyForm(nofo),programDefaultId=null) {
  let version;
  if(nofo.current_form_version_id)version=(await db.query('SELECT * FROM nofo_form_versions WHERE id=$1 FOR UPDATE',[nofo.current_form_version_id])).rows[0];
  if(!version) {
    const number=Number((await db.query('SELECT COALESCE(MAX(version),0)+1 AS next FROM nofo_form_versions WHERE nofo_id=$1',[nofo.id])).rows[0].next);
    version=(await db.query(`INSERT INTO nofo_form_versions(id,nofo_id,version,definition,created_by,locked_at,program_default_version_id)
      VALUES($1,$2,$3,$4,$5,NOW(),$6) RETURNING *`,[randomUUID(),nofo.id,number,JSON.stringify(definition),actor.email,programDefaultId])).rows[0];
    await db.query('UPDATE nofos SET current_form_version_id=$2 WHERE id=$1',[nofo.id,version.id]);
  } else if(!version.locked_at)version=(await db.query('UPDATE nofo_form_versions SET locked_at=NOW() WHERE id=$1 RETURNING *',[version.id])).rows[0];
  const result=await db.query('UPDATE applications SET form_version_id=$2 WHERE nofo_id=$1 AND form_version_id IS NULL',[nofo.id,version.id]);
  return {version,count:result.rowCount};
}
export async function migrateExistingFormSnapshots(pool) {
  await pool.query('CREATE TABLE IF NOT EXISTS gmt_form_migrations(name TEXT PRIMARY KEY,applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
  await transaction(pool,async db=>{
    await db.query("SELECT pg_advisory_xact_lock(hashtext(current_schema()||':legacy-form-snapshots'))");
    if((await db.query("SELECT name FROM gmt_form_migrations WHERE name='legacy-form-snapshots-v1'")).rows.length)return;
    const nofos=(await db.query(`SELECT * FROM nofos n WHERE EXISTS(SELECT 1 FROM applications a WHERE a.nofo_id=n.id::text AND a.form_version_id IS NULL)
      ORDER BY n.id FOR UPDATE`)).rows;
    const actor={email:'system:gmt-form-migration',full_name:'GMT form migration'};
    for(const nofo of nofos) {
      const result=await pinExistingApplications(db,nofo,actor);
      await auditForm(db,actor,nofo.id,'LegacyApplicationFormPinned','Preserved '+result.count+' preexisting application(s) on legacy form version '+result.version.version);
    }
    await db.query("INSERT INTO gmt_form_migrations(name) VALUES('legacy-form-snapshots-v1')");
  });
}
