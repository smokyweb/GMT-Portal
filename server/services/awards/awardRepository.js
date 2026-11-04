import {randomUUID} from 'node:crypto';
import {inheritedAward} from '../../../src/lib/awards/awardInheritance.js';
import {auditForm} from '../forms/formAccess.js';
export async function awardsEnabled(db) {
  return Boolean((await db.query("SELECT to_regclass(current_schema()||'.award_details') AS name")).rows[0].name);
}
export async function awardSources(db,application) {
  const nofo=application.nofo_id?(await db.query('SELECT * FROM nofos WHERE id::text=$1',[application.nofo_id])).rows[0]||{}:{};
  let program={};
  if(nofo.program_id)program=(await db.query('SELECT * FROM grant_programs WHERE id::text=$1',[nofo.program_id])).rows[0]||{};
  else {const matches=(await db.query('SELECT * FROM grant_programs WHERE code=$1 LIMIT 2',[application.program_code])).rows;if(matches.length===1)program=matches[0];}
  const organization=(await db.query('SELECT * FROM organizations WHERE id::text=$1',[application.organization_id])).rows[0]||{};
  return {nofo,program,organization,...inheritedAward(application,nofo,program,organization)};
}
function codePart(value,fallback) {
  const normalized=String(value||fallback).toUpperCase().replace(/[^A-Z0-9]+/g,'-').replace(/^-+|-+$/g,'');
  return normalized.slice(0,12)||fallback;
}
async function nextSubawardNumber(db,application,sources) {
  const state=codePart(sources.organization.state,'STATE');
  const program=codePart(sources.program.code||application.program_code,'GRANT');
  const year=String(sources.nofo.fiscal_year||new Date().getUTCFullYear()).replace(/[^0-9]/g,'').slice(-4);
  const prefix=`${state}-${program}-${year}-`;
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[String(application.nofo_id||application.id)]);
  const used=(await db.query("SELECT fields->>'subaward_number' AS number FROM award_details WHERE nofo_id=$1",[application.nofo_id||null])).rows.map(row=>row.number).filter(Boolean);
  const usedNumbers=new Set(used);
  let sequence=1;
  while(usedNumbers.has(`${prefix}${String(sequence).padStart(3,'0')}`))sequence++;
  return `${prefix}${String(sequence).padStart(3,'0')}`;
}
export async function ensureAwardSnapshot(db,application,actor) {
  let award=(await db.query('SELECT * FROM award_details WHERE application_id=$1 FOR UPDATE',[application.id])).rows[0];
  const inherited=await awardSources(db,application);
  if(award) {
    const fields={...(award.fields||{})},origins={...(award.origins||{})};
    if(application.status==='Approved'&&!fields.subaward_number) {
      fields.subaward_number=await nextSubawardNumber(db,application,inherited);
      origins.subaward_number='Generated from NOFO';
      award=(await db.query('UPDATE award_details SET fields=$2,origins=$3,updated_at=NOW() WHERE id=$1 RETURNING *',[award.id,JSON.stringify(fields),JSON.stringify(origins)])).rows[0];
    }
    return award;
  }
  if(application.status==='Approved') {
    inherited.fields.subaward_number=await nextSubawardNumber(db,application,inherited);
    inherited.origins.subaward_number='Generated from NOFO';
  } else {
    inherited.fields.subaward_number=null;
    inherited.origins.subaward_number='Awaiting application approval';
  }
  if(application.grant_number){inherited.fields.federal_award_number=application.grant_number;inherited.origins.federal_award_number=application.grant_number===inherited.nofo.grant_number?'from NOFO':'from Application';}
  award=(await db.query(`INSERT INTO award_details(id,application_id,nofo_id,fields,origins,created_by)
    VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[randomUUID(),application.id,application.nofo_id||null,JSON.stringify(inherited.fields),JSON.stringify(inherited.origins),actor.email])).rows[0];
  await auditForm(db,actor,application.id,'AwardDetailsCreated','Preserved the award identifiers, dates and amounts from the application and NOFO','Application');
  return award;
}
