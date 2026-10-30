import {createHash} from 'node:crypto';
import {v5 as uuidv5} from 'uuid';
import {accountError} from '../accountPolicy.js';
import {auditForm} from '../forms/formAccess.js';
import {ganProgramCodes} from './ganContextPolicy.js';
import {ganBatchRequest,ganBatchRequestHash} from './ganBatchPolicy.js';
import {ganBatchCandidates} from './ganBatchCandidates.js';
import {ganBatchActor} from './ganBatchAccess.js';
export async function createGanBatch(pool,actorId,input,ip='') {
  const request=ganBatchRequest(input),fingerprint=ganBatchRequestHash(actorId,request.input),db=await pool.connect();
  try {
    await db.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
    const {actor,nofo,state}=await ganBatchActor(db,actorId,request.input.nofoId);
    const previous=(await db.query('SELECT * FROM gan_draft_batches WHERE id=$1',[request.input.requestId])).rows[0];
    if(previous) {
      if(previous.actor_id!==actor.id||previous.request_sha256!==fingerprint)throw accountError(409,'This batch request ID already belongs to different selections');
      await db.query('COMMIT');return {id:previous.id,replayed:true,total:previous.rows.length};
    }
    const template=(await db.query('SELECT * FROM document_templates WHERE id::text=$1',[request.input.templateId])).rows[0];
    if(!template||template.is_active!==true||template.doc_type!=='Grant Award Notice'||!Number.isInteger(template.version)||template.version<1)throw accountError(409,'Choose an active GAN template with a saved version');
    const codes=ganProgramCodes(template.program_codes);
    if(codes.length&&nofo.program_code&&!codes.includes(nofo.program_code))throw accountError(409,'The template is not configured for this NOFO program');
    const grantee=request.input.granteeId?(await db.query('SELECT * FROM grantees WHERE id::text=$1',[request.input.granteeId])).rows[0]:null;
    if(request.input.granteeId&&(!grantee||grantee.is_active===false))throw accountError(409,'Choose an active grantee');
    if(grantee&&actor.role!=='isc_admin'&&(String(grantee.state_code).toUpperCase()!==state||actor.grantee_id&&actor.grantee_id!==grantee.id))throw accountError(403,'Choose your assigned state grantee');
    const candidates=await ganBatchCandidates(db,actor,nofo,state),selected=request.input.applicationIds?new Set(request.input.applicationIds):null;
    if(selected&&[...selected].some(id=>!candidates.some(row=>row.applicationId===id)))throw accountError(403,'A selected application is outside this NOFO or your assigned state');
    const selectedRows=candidates.filter(row=>!selected||selected.has(row.applicationId));
    const granteeIds=[...new Set(selectedRows.map(row=>request.input.granteeId||row.defaultGranteeId).filter(Boolean))];
    const settings=new Map((await db.query("SELECT id,to_jsonb(grantees)->>'gan_settings_revision' AS revision FROM grantees WHERE id::text=ANY($1::text[])",[granteeIds])).rows.map(row=>[row.id,row.revision==null?null:Number(row.revision)]));
    const officials={...request.selection.officialsByOrganization};
    for(const row of selectedRows)if(!Object.hasOwn(officials,row.organizationId))officials[row.organizationId]=row.defaultOfficialId||null;
    request.selection.officialsByOrganization=officials;
    const rows=selectedRows.map(row=>({...row,granteeId:request.input.granteeId||row.defaultGranteeId||null,granteeSettingsRevision:settings.get(request.input.granteeId||row.defaultGranteeId)??null,requestId:uuidv5(row.applicationId,request.input.requestId)}));
    const hash=createHash('sha256').update(template.template_body||'').digest('hex');
    await db.query("SELECT set_config('gmt.gan_action','batch-plan',true)");
    await db.query(`INSERT INTO gan_draft_batches(id,actor_id,nofo_id,request_sha256,template_id,template_version,template_sha256,nofo_revision,grantee_settings_revision,selection,rows)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,[request.input.requestId,actor.id,nofo.id,fingerprint,template.id,template.version,hash,nofo.award_metadata_revision??null,grantee?.gan_settings_revision??null,JSON.stringify(request.selection),JSON.stringify(rows)]);
    await auditForm(db,actor,request.input.requestId,'GANBatchPlanned','Planned '+rows.length+' GAN rows with template version '+template.version+(ip?' IP: '+String(ip).slice(0,100):''),'GeneratedDocument');
    await db.query('COMMIT');return {id:request.input.requestId,replayed:false,total:rows.length};
  }catch(error){await db.query('ROLLBACK');if(['40001','40P01','23505'].includes(error.code))throw accountError(409,'The batch changed concurrently. Retry the same request.');throw error;}finally{db.release();}
}
