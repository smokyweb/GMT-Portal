import {accountError,normalizedState} from '../accountPolicy.js';
const identifier=value=>'"'+String(value).replace(/"/g,'""')+'"';
export async function readGanEntity(db,actor,req) {
  const columns=(await db.query("SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='generated_documents' ORDER BY ordinal_position")).rows.map(row=>row.column_name).filter(key=>!['gan_pdf','gan_snapshot'].includes(key));
  const valid=new Set(columns),state=normalizedState(actor.scope_state||actor.grantee_state);
  const organizations=(await db.query('SELECT id,state FROM organizations')).rows;
  const own=new Set(organizations.filter(org=>actor.role==='isc_admin'||actor.role==='user'&&actor.organization_id===org.id||['admin','reviewer'].includes(actor.role)&&state&&state===normalizedState(org.state)).map(org=>org.id));
  const applications=(await db.query('SELECT a.id,a.organization_id,n.scope_states FROM applications a LEFT JOIN nofos n ON n.id::text=a.nofo_id')).rows;
  const pairs=applications.filter(app=>own.has(app.organization_id)&&(actor.role==='isc_admin'||!app.scope_states?.length||app.scope_states.map(normalizedState).includes(normalizedState(organizations.find(org=>org.id===app.organization_id)?.state)))).map(app=>app.id+':'+app.organization_id);
  const allowed=new Set(pairs),admin=['admin','isc_admin'].includes(actor.role),single=Boolean(req.params.id&&req.params.id!=='filter');
  const values=[],conditions=[],parameter=value=>{values.push(value);return '$'+values.length;};
  if(single)conditions.push('d.id::text='+parameter(req.params.id));
  else {
    const filter=req.method==='POST'?req.body?.filter||{}:{};
    if(!filter||typeof filter!=='object'||Array.isArray(filter))throw accountError(400,'Provide document filters as named fields');
    for(const [key,value] of Object.entries(filter)) {
      if(!valid.has(key))throw accountError(400,'Unknown or private document filter');
      if(value==null)conditions.push('d.'+identifier(key)+' IS NULL');
      else if(Array.isArray(value))conditions.push('d.'+identifier(key)+'=ANY('+parameter(value)+')');
      else conditions.push('d.'+identifier(key)+'='+parameter(typeof value==='object'?JSON.stringify(value):value));
    }
    conditions.push('(NOT d.gan_managed OR ((d.application_id||\':\'||d.organization_id)=ANY('+parameter(pairs)+'::text[])'+(admin?'':" AND d.status<>'Draft'")+'))');
  }
  const rawSort=(req.method==='POST'?req.body?.sort:req.query.sort)||'-created_date',sort=String(rawSort),column=sort.replace(/^-/,'');
  if(!valid.has(column))throw accountError(400,'Unknown or private document sort');
  const limit=single?1:Math.max(1,Math.min(Number.parseInt(req.method==='POST'?req.body?.limit:req.query.limit,10)||500,5000));
  const rows=(await db.query('SELECT '+columns.map(key=>'d.'+identifier(key)).join(',')+' FROM generated_documents d WHERE '+conditions.join(' AND ')+' ORDER BY d.'+identifier(column)+(sort.startsWith('-')?' DESC':' ASC')+' LIMIT '+parameter(limit),values)).rows;
  if(!single)return rows;
  if(!rows[0])throw accountError(404,'Document not found');
  const row=rows[0];
  if(row.gan_managed&&(!allowed.has(row.application_id+':'+row.organization_id)||row.status==='Draft'&&!admin))throw accountError(403,'This GAN document is outside your access');
  return row;
}
