import {createHash} from 'node:crypto';
import {accountError} from '../accountPolicy.js';
import {managedGanDocument} from './ganDraftAccess.js';
import {publicGanDraft} from './ganDraftPolicy.js';
const hash=value=>createHash('sha256').update(value).digest('hex');
export async function readGanDraft(db,actorId,id,revision) {
  if(revision!==undefined&&(!Number.isInteger(revision)||revision<1))throw accountError(400,'Select a valid GAN snapshot revision');
  const {document}=await managedGanDocument(db,actorId,id),selected=revision??document.gan_revision;
  const saved=(await db.query('SELECT * FROM gan_document_snapshots WHERE document_id=$1 AND revision=$2',[document.id,selected])).rows[0];
  if(!saved)throw accountError(404,'GAN snapshot revision not found');
  const snapshot=saved.snapshot;
  if(!snapshot||typeof snapshot.merged_body!=='string'||typeof snapshot.template_body!=='string'||!snapshot.sources||!Buffer.isBuffer(saved.pdf))throw accountError(500,'The saved GAN snapshot failed its integrity check');
  if(hash(saved.pdf)!==saved.pdf_sha256||hash(snapshot.merged_body)!==saved.body_sha256||hash(snapshot.template_body)!==saved.template_sha256||
    snapshot.pdf_sha256!==saved.pdf_sha256||snapshot.merged_body_sha256!==saved.body_sha256||snapshot.template_body_sha256!==saved.template_sha256||
    snapshot.sources.applicationId!==document.application_id||snapshot.sources.organizationId!==document.organization_id)throw accountError(500,'The saved GAN snapshot failed its integrity check');
  const history=(await db.query('SELECT revision,created_at,actor_id,pdf_sha256 FROM gan_document_snapshots WHERE document_id=$1 ORDER BY revision DESC',[document.id])).rows;
  return {document:publicGanDraft({...document,gan_snapshot:snapshot,gan_template_version:snapshot.template_version,gan_pdf_sha256:saved.pdf_sha256,gan_generated_at:saved.created_at},selected),
    snapshot,history,pdf:saved.pdf};
}
