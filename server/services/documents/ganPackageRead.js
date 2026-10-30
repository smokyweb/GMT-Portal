import {accountError} from '../accountPolicy.js';
import {managedGanDocument} from './ganDraftAccess.js';
import {readGanDraft} from './ganDraftRead.js';
import {verifyGanAttachment} from './ganAttachments.js';
import {ganPackageHash,publicGanPackage} from './ganPackagePolicy.js';
export async function listGanPackages(db,actorId,documentId) {
  await managedGanDocument(db,actorId,documentId);
  return (await db.query('SELECT id,document_id,gan_revision,package_revision,pdf_sha256,manifest_sha256,manifest,created_at FROM gan_package_snapshots WHERE document_id=$1 ORDER BY package_revision DESC',[documentId])).rows.map(publicGanPackage);
}
export async function readGanPackage(db,actorId,id) {
  const row=(await db.query("SELECT *,encode(sha256(convert_to(manifest::text,'UTF8')),'hex') AS calculated_manifest_sha256 FROM gan_package_snapshots WHERE id::text=$1",[id])).rows[0];
  if(!row)throw accountError(404,'GAN package not found');
  const access=await managedGanDocument(db,actorId,row.document_id);
  if(access.document.application_id!==row.application_id||access.document.organization_id!==row.organization_id||!Buffer.isBuffer(row.pdf)||ganPackageHash(row.pdf)!==row.pdf_sha256||row.manifest_sha256!==row.calculated_manifest_sha256||row.manifest.pdf_sha256!==row.pdf_sha256)throw accountError(500,'The saved GAN package failed its integrity check');
  return {...access,package:publicGanPackage(row),manifest:row.manifest,pdf:row.pdf};
}
export async function readGanPackagePart(db,actorId,id,partId) {
  const result=await readGanPackage(db,actorId,id);
  if(partId==='gan'){const draft=await readGanDraft(db,actorId,result.document.id,result.package.gan_revision);return {...result,pdf:draft.pdf,sha256:draft.document.pdf_sha256,filename:'gan-r'+draft.document.revision+'.pdf'};}
  const part=result.manifest.parts.find(p=>p.source_id===partId);if(!part)throw accountError(404,'This attachment is not part of the package');
  const source=(await db.query('SELECT * FROM gan_attachment_sources WHERE id=$1',[partId])).rows[0];verifyGanAttachment(source);
  if(source.pdf_sha256!==part.pdf_sha256||source.nofo_id!==result.manifest.nofo_id)throw accountError(500,'The saved package attachment failed its integrity check');
  return {...result,pdf:source.pdf,sha256:source.pdf_sha256,filename:source.kind+'-v'+source.version+'.pdf'};
}
