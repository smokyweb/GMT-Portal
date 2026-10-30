import {accountError} from '../accountPolicy.js';
export async function ganBatchCandidates(db,actor,nofo,state) {
  const args=[nofo.id],where=actor.role==='isc_admin'?'':" AND UPPER(o.state)=$2";if(where)args.push(state);
  const applications=(await db.query(`SELECT a.id,a.application_number,a.organization_id,a.status,o.name AS organization_name,
    COALESCE(d.gan_revision,0) AS revision,(to_jsonb(o)->>'gan_settings_revision')::integer AS organization_settings_revision,
    to_jsonb(o)->>'authorized_official_id' AS default_official_id,to_jsonb(o)->>'grantee_id' AS default_grantee_id,COALESCE(w.fields->>'awarded_amount',a.awarded_amount::text) AS awarded_amount
    FROM applications a LEFT JOIN organizations o ON o.id::text=a.organization_id
    LEFT JOIN generated_documents d ON d.application_id=a.id::text AND d.gan_managed LEFT JOIN award_details w ON w.application_id::text=a.id::text
    WHERE a.nofo_id=$1`+where+' ORDER BY a.application_number,a.id LIMIT 5001',args)).rows;
  if(applications.length>5000)throw accountError(413,'This NOFO exceeds the supported 5000-row batch size; no partial batch was created');
  let counts=new Map();
  if((await db.query("SELECT to_regclass(current_schema()||'.application_projects') AS name")).rows[0].name)counts=new Map((await db.query('SELECT application_id,count(*)::integer AS count FROM application_projects GROUP BY application_id')).rows.map(row=>[row.application_id,row.count]));
  return applications.map(app=>({applicationId:app.id,applicationNumber:app.application_number,organizationId:app.organization_id,organizationName:app.organization_name,
    organizationSettingsRevision:app.organization_settings_revision,defaultOfficialId:app.default_official_id,defaultGranteeId:app.default_grantee_id,applicationStatus:app.status,projectCount:counts.get(app.id)||1,expectedRevision:app.revision,awardedAmount:app.awarded_amount}));
}
