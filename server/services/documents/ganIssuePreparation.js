import {randomUUID} from 'node:crypto';
import {inspectGanIssue} from './ganIssueReadiness.js';
import {renderGanIssuedPackage} from './ganIssuePdf.js';
export async function prepareGanIssue(db,access,packageId,issuedAt) {
  const {document,actor,organization,application}=access;
  const {saved,snapshot,sources,recipient,settings}=await inspectGanIssue(db,access,packageId);
  const rendered=await renderGanIssuedPackage(db,snapshot,saved.manifest);
  const id=randomUUID(),manifest={schema_version:1,kind:'issued_for_signature',document_id:document.id,package_id:packageId,draft_package_sha256:saved.package.pdf_sha256,pdf_sha256:rendered.pdf_sha256,
    recipient_id:recipient.id,recipient:{id:recipient.id,name:snapshot.values.authorized_official_name,title:snapshot.values.authorized_official_title,email:recipient.email},
    sender:{id:actor.id,name:actor.full_name,email:actor.email},approver:{id:sources.approvingOfficialId,name:snapshot.values.approving_official_name,title:snapshot.values.approving_official_title},
    allowed_methods:settings.allowed_methods,signature_settings_revision:settings.revision,issued_at:issuedAt,gan:snapshot,package:saved.manifest,pages:rendered.pages,parts:rendered.parts};
  const row=(await db.query(`INSERT INTO gan_workflow_issues(id,document_id,package_id,gan_revision,organization_id,nofo_id,recipient_id,approver_id,sender_id,sender_email,issued_at,manifest,manifest_sha256,pdf,pdf_sha256)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,encode(sha256(convert_to($12::jsonb::text,'UTF8')),'hex'),$13,$14) RETURNING *`,
    [id,document.id,packageId,document.gan_revision,organization.id,application.nofo_id,recipient.id,sources.approvingOfficialId,actor.id,actor.email,issuedAt,JSON.stringify(manifest),rendered.pdf,rendered.pdf_sha256])).rows[0];
  return row;
}
