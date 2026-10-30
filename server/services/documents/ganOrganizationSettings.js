import {transaction} from '../accountRepository.js';
import {accountError,normalizedState} from '../accountPolicy.js';
import {auditForm} from '../forms/formAccess.js';
import {ganOrganizationSettingsAccess} from './ganSettingsAccess.js';
import {ORG_GAN_FIELDS,ganSettingsInput,eligibleRecipientOfficial,ganContactPerson} from './ganSettingsPolicy.js';
export async function readGanOrganizationSettings(db,actorId,id) {
  const {actor,organization,canEdit}=await ganOrganizationSettingsAccess(db,actorId,id);
  const choices=(await db.query("SELECT id,full_name,email,title,phone,role,organization_id,active_status FROM users WHERE organization_id=$1 AND role='user' ORDER BY full_name,email",[organization.id])).rows;
  const current=choices.find(user=>user.id===organization.authorized_official_id),official=eligibleRecipientOfficial(current,organization)?ganContactPerson(current):null;
  const grantees=(await db.query('SELECT id,name,agency_name,state_code,is_active FROM grantees ORDER BY name,id')).rows.filter(grantee=>normalizedState(grantee.state_code)===normalizedState(organization.state)&&(!actor.grantee_id||actor.role==='isc_admin'||grantee.id===actor.grantee_id));
  const assignedGrantee=grantees.find(grantee=>grantee.id===organization.grantee_id)||null;
  const warnings=[];
  if(organization.authorized_official_id&&!official)warnings.push('The assigned official is inactive, missing, or no longer belongs to this organization. Choose a registered replacement.');
  if(organization.grantee_id&&(!assignedGrantee||assignedGrantee.is_active===false))warnings.push('The saved grantee needs review before generating award documents.');
  return {organization:{id:organization.id,name:organization.name,state:organization.state},settings:{authorized_official_id:organization.authorized_official_id||null,grantee_id:organization.grantee_id||null},
    revision:organization.gan_settings_revision||0,can_edit:canEdit,viewer_is_official:official?.id===actor.id,official,grantee:assignedGrantee,warnings,
    choices:{officials:canEdit?choices.filter(user=>eligibleRecipientOfficial(user,organization)).map(ganContactPerson):official?[official]:[],grantees:canEdit?grantees.filter(grantee=>grantee.is_active!==false):assignedGrantee?[assignedGrantee]:[]}};
}
export async function saveGanOrganizationSettings(pool,actorId,id,input,ip='') {
  const changes=ganSettingsInput(input,ORG_GAN_FIELDS);
  return transaction(pool,async db=>{
    const {actor,organization}=await ganOrganizationSettingsAccess(db,actorId,id,true,true);
    if(input.expectedRevision!==(organization.gan_settings_revision||0))throw accountError(409,'Organization award contacts changed. Reload before saving.');
    const data={authorized_official_id:organization.authorized_official_id||null,grantee_id:organization.grantee_id||null,...changes};
    if(data.authorized_official_id) {
      const user=(await db.query('SELECT * FROM users WHERE id::text=$1 FOR SHARE',[data.authorized_official_id])).rows[0];
      if(!eligibleRecipientOfficial(user,organization))throw accountError(403,'Choose an active registered subrecipient account belonging to this organization');
    }
    if(data.grantee_id) {
      const grantee=(await db.query('SELECT * FROM grantees WHERE id::text=$1 FOR SHARE',[data.grantee_id])).rows[0];
      if(!grantee||grantee.is_active===false||normalizedState(grantee.state_code)!==normalizedState(organization.state)||actor.role!=='isc_admin'&&actor.grantee_id&&actor.grantee_id!==grantee.id)throw accountError(403,'Choose an active grantee assigned to this organization state');
    }
    await db.query("SELECT set_config('gmt.gan_settings_action','organization',true)");
    await db.query('UPDATE organizations SET authorized_official_id=$2,grantee_id=$3,updated_date=NOW() WHERE id=$1',[organization.id,data.authorized_official_id,data.grantee_id]);
    await auditForm(db,actor,organization.id,'OrganizationAwardContactsUpdated','Updated award-contact fields: '+Object.keys(changes).join(', ')+(ip?' IP: '+String(ip).slice(0,100):''),'Organization');
    return readGanOrganizationSettings(db,actorId,id);
  });
}
