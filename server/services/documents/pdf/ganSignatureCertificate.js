import {accountError} from '../../accountPolicy.js';
import {ganPdfModel} from './ganPdfModel.js';
import {ganPdfCanvas} from './ganPdfCanvas.js';
import {ganSnapshotPreview} from '../ganSnapshotModel.js';
export function ganSignatureCertificate(snapshot,evidence) {
  const model=ganPdfModel(ganSnapshotPreview(snapshot),{programCode:snapshot.values.program_code,templateBody:snapshot.template_body,templateVersion:snapshot.template_version}),c=ganPdfCanvas(model,'recipient_signed');
  let y=30;const row=(label,value)=>{y+=c.text(label,30,y,550,{size:9,bold:true})+3;y+=c.text(String(value||''),30,y,550,{size:8})+12;};
  row('GMT Portal — Electronic Signature Record','Subrecipient acceptance; awaiting NEMA countersignature.');
  row('Award',snapshot.values.application_number+' · '+snapshot.values.subaward_number);
  row('Projects',snapshot.projects.map(project=>project.project_id).join(', '));
  row('Registered official',evidence.name+' · '+evidence.title);
  row('Identity and time','User ID: '+evidence.actorId+'\nUTC: '+evidence.signedAt+'\nObserved IP: '+evidence.ip);
  row('Consent statements',Object.values(evidence.consents).map(text=>'Confirmed: '+text).join('\n'));
  row('Issued package accepted','Issue ID: '+evidence.issueId+'\nSHA-256: '+evidence.issuedPdfSha256);
  row('Recorded action','Event ID: '+evidence.eventId+'\nThis record binds acceptance to the complete issued package, including its Special Conditions.');
  if(y>735)throw accountError(422,'The signature record is too long to render; shorten the signature title');
  c.footer(1,1);return Buffer.from(c.doc.output('arraybuffer'));
}
