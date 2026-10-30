import {randomUUID} from 'node:crypto';
import {accountError} from '../accountPolicy.js';
import {auditForm} from '../forms/formAccess.js';
import {loadGanPreview} from './ganContext.js';
import {renderGanPdfPreview} from './ganPdfPreview.js';
import {ganDraftRequest,ganDraftRequestHash,ganDraftManifest,publicGanDraft} from './ganDraftPolicy.js';
import {ganDraftAccess} from './ganDraftAccess.js';
export async function saveGanDraft(pool,actorId,applicationId,input,ip='',constraints={}) {
  const request=ganDraftRequest(input),fingerprint=ganDraftRequestHash(actorId,applicationId,request),db=await pool.connect();
  try {
    await db.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
    const {actor,application,organization}=await ganDraftAccess(db,actorId,applicationId,true);
    await db.query("SELECT pg_advisory_xact_lock(hashtext(current_schema()||':gan-draft:'||$1))",[applicationId]);
    const existing=(await db.query('SELECT * FROM generated_documents WHERE application_id=$1 AND gan_managed FOR UPDATE',[applicationId])).rows[0];
    const replay=(await db.query('SELECT * FROM gan_document_snapshots WHERE application_id=$1 AND request_id=$2',[applicationId,request.requestId])).rows[0];
    if(replay) {
      if(replay.request_sha256!==fingerprint)throw accountError(409,'This request ID was already used for different draft selections');
      if(!existing||existing.organization_id!==organization.id)throw accountError(409,'The GAN organization changed. Review its assignment.');
      await db.query('COMMIT');
      return {document:publicGanDraft({...existing,gan_snapshot:replay.snapshot,gan_template_version:replay.snapshot.template_version,gan_pdf_sha256:replay.pdf_sha256,gan_generated_at:replay.created_at},replay.revision),replayed:true};
    }
    if(constraints.nofoId&&application.nofo_id!==constraints.nofoId||constraints.organizationId&&organization.id!==constraints.organizationId)throw accountError(409,'This application moved from the batch NOFO or organization; create a reviewed new batch');
    if(existing&&!['Draft','Rejected'].includes(existing.status))throw accountError(409,'A sent GAN keeps its stored snapshot; it cannot be regenerated');
    if((existing?.gan_revision||0)!==request.expectedRevision)throw accountError(409,'The GAN draft changed. Reload before generating another version.');
    if(existing&&existing.organization_id!==organization.id)throw accountError(409,'A generated GAN keeps its original recipient organization');
    if(!existing&&(await db.query("SELECT id FROM generated_documents WHERE application_id=$1 AND doc_type='Grant Award Notice' AND NOT gan_managed LIMIT 1",[applicationId])).rows.length)throw accountError(409,'Reconcile this application’s legacy GAN before creating a managed draft');
    const preview=await loadGanPreview(db,actorId,applicationId,request.options);
    if(constraints.templateVersion!==undefined&&(preview.template.version!==constraints.templateVersion||preview.template.body_sha256!==constraints.templateSha256))throw accountError(409,'The template changed after this batch was planned; review it and start a new batch');
    if(constraints.nofoRevision!==undefined&&preview.sources.nofoRevision!==constraints.nofoRevision)throw accountError(409,'The NOFO award metadata changed after this batch was planned; review it and start a new batch');
    if(constraints.organizationSettingsRevision!==undefined&&preview.sources.organizationSettingsRevision!==constraints.organizationSettingsRevision||constraints.granteeSettingsRevision!==undefined&&preview.sources.granteeSettingsRevision!==constraints.granteeSettingsRevision)throw accountError(409,'Award-contact settings changed after this batch was planned; review them and start a new batch');
    if(!preview.ready)throw Object.assign(accountError(422,'Resolve the GAN source issues before generating a draft'),{details:preview.issues});
    const rendered=renderGanPdfPreview(preview,{programCode:preview.values.program_code,templateBody:preview.template.body,templateVersion:preview.template.version});
    if(rendered.pdf.length>8*1024*1024)throw accountError(422,'The GAN preview exceeds the supported document size');
    const manifest=ganDraftManifest(preview,rendered),id=existing?.id||randomUUID(),revision=(existing?.gan_revision||0)+1;
    await db.query("SELECT set_config('gmt.gan_action','draft',true)");
    const values=[id,preview.template.id,preview.template.name,applicationId,application.application_number,organization.id,organization.name,
      preview.body,JSON.stringify(manifest),rendered.pdf,rendered.pdf_sha256,rendered.merged_body_sha256,rendered.template_body_sha256,preview.template.version,
      preview.sources.authorizedOfficialId,preview.sources.granteeId,actor.id,revision];
    let document;
    if(existing)document=(await db.query(`UPDATE generated_documents SET template_id=$2,template_name=$3,application_id=$4,application_number=$5,
      organization_id=$6,organization_name=$7,populated_body=$8,gan_snapshot=$9,gan_pdf=$10,gan_pdf_sha256=$11,gan_body_sha256=$12,
      gan_template_sha256=$13,gan_template_version=$14,gan_authorized_official_id=$15,gan_grantee_id=$16,gan_generated_by=$17,gan_revision=$18,
      gan_generated_at=NOW(),updated_date=NOW(),status='Draft',sent_by=NULL,sent_at=NULL,signed_by=NULL,signed_at=NULL,subrecipient_notes=NULL WHERE id=$1 RETURNING *`,values)).rows[0];
    else document=(await db.query(`INSERT INTO generated_documents(id,template_id,template_name,application_id,application_number,organization_id,organization_name,
      populated_body,gan_snapshot,gan_pdf,gan_pdf_sha256,gan_body_sha256,gan_template_sha256,gan_template_version,gan_authorized_official_id,gan_grantee_id,
      gan_generated_by,gan_revision,gan_generated_at,doc_type,status,gan_managed)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,NOW(),'Grant Award Notice','Draft',true) RETURNING *`,values)).rows[0];
    await db.query(`INSERT INTO gan_document_snapshots(id,document_id,application_id,revision,request_id,request_sha256,snapshot,pdf,pdf_sha256,body_sha256,template_sha256,actor_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,[randomUUID(),id,applicationId,revision,request.requestId,fingerprint,JSON.stringify(manifest),rendered.pdf,rendered.pdf_sha256,rendered.merged_body_sha256,rendered.template_body_sha256,actor.id]);
    await auditForm(db,actor,id,'GANDraftGenerated','Generated Draft revision '+revision+'; PDF SHA-256 '+rendered.pdf_sha256+(ip?' IP: '+String(ip).slice(0,100):''),'GeneratedDocument');
    await db.query('COMMIT');return {document:publicGanDraft(document),replayed:false};
  }catch(error){await db.query('ROLLBACK');if(['40001','40P01','23505'].includes(error.code))throw accountError(409,'The GAN or its source records changed concurrently. Reload and retry the same request.');throw error;}finally{db.release();}
}
