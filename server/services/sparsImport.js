import {createHash,randomUUID} from 'node:crypto';

const ROLE_ALLOWLIST=new Set(['admin','isc_admin']);
const OMITTED_TABS=new Set(['Contacts','Documents','Notes']);
const TAB_ORDER=['Agencies','Grants','Subawards','GAN History','GAN Project Lines','Projects','Budget Lines','Reimbursements','Reimbursement Lines','Payments','Payment Lines'];
const TAB_KEYS={
  Agencies:['Agency ID (SPARS FIPS)'], Grants:['Grant ID'], Subawards:['Subaward ID (SPARS Grant #)'],
  'GAN History':['GAN ID'],'GAN Project Lines':['GAN Line ID'], Projects:['Project ID'],
  'Budget Lines':['Budget Line ID (SPARS)'], Reimbursements:['Reimbursement ID'],
  'Reimbursement Lines':['Line ID (SPARS Expenditure ID)'], Payments:['Payment ID (SPARS Voucher ID)'],
  'Payment Lines':['Payment ID','Reimbursement Line ID']
};
const TABLE_KEYS={organizations:'legacy_spars_id',nofos:'legacy_grant_id',applications:'legacy_subaward_id',projects:'legacy_project_id',application_budgets:'legacy_budget_line_id',funding_requests:'legacy_reimbursement_id',funding_request_line_items:'legacy_expenditure_id'};

function fail(message,status=400){const e=new Error(message);e.status=status;return e;}
function text(v){return v===null||v===undefined?'':String(v).trim();}
function num(v){if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:v;}
function date(v){if(v===null||v===undefined||v==='')return null;const s=v instanceof Date?v.toISOString():String(v);return s.slice(0,10);}
function nameKey(v){return text(v).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();}
function hash(v){return createHash('sha256').update(JSON.stringify(v)).digest('hex');}
function ready(rows){return (Array.isArray(rows)?rows:[]).filter(r=>!Object.hasOwn(r||{},'Upload Status')||text(r['Upload Status'])==='Ready');}
function sourceRows(tabs,tab){return ready(tabs[tab]);}
function value(row,key){return row?.[key];}
function sourceId(tab,row){return text(row?.[TAB_KEYS[tab]?.[0]]);}
function orgType(row){const raw=text(row['Organization Type']||row['Agency Type']);return ['County','Municipality','Nonprofit','Tribe','Local Jurisdiction','Local Jurisdiction State Agency','State Agency','Federal Agency','University','Other'].includes(raw)?raw:'Other';}
function dollar(v){return num(v)??0;}
function paymentMethod(v){const s=text(v).toLowerCase();if(!s)return null;if(s.includes('eft'))return 'EFT';if(s.includes('check'))return 'Check';if(s.includes('multiple')||s.includes('payable'))return 'Multiple Payables';return null;}
function paymentStatus(v){const s=text(v).toLowerCase();if(s==='paid')return 'Paid';if(s==='submitted')return 'SubmittedToFinance';if(s==='at saa')return 'PendingDisbursement';return null;}
function sameValue(a,b){if(a===null||a===undefined||a===''||b===null||b===undefined||b==='')return false;const na=Number(a),nb=Number(b);if(Number.isFinite(na)&&Number.isFinite(nb))return Math.abs(na-nb)<0.000001;const da=date(a),db=date(b);return da&&db&&/^\d{4}-\d{2}-\d{2}$/.test(da)&&/^\d{4}-\d{2}-\d{2}$/.test(db)?da===db:String(a)===String(b);}

export function assertSparsImportActor(actor){if(!ROLE_ALLOWLIST.has(actor?.role))throw fail('Only state or ISC administrators can run SPARS imports',403);}

async function rowsBy(db,table,key,values){
  const clean=[...new Set(values.map(text).filter(Boolean))]; if(!clean.length)return new Map();
  const result=await db.query(`SELECT * FROM ${table} WHERE ${key}=ANY($1::text[])`,[clean]);
  return new Map(result.rows.map(r=>[text(r[key]),r]));
}
async function allOrganizations(db){return (await db.query('SELECT * FROM organizations WHERE is_active IS NOT FALSE')).rows;}
function orgMatch(source,organizations){
  const legacy=text(source['Agency ID (SPARS FIPS)']),vendor=text(source['Address Book # (VIN)']),ein=text(source['Tax ID']),name=nameKey(source['Agency Name']);
  const by=(field,v)=>v?organizations.filter(o=>text(o[field]).toLowerCase()===v.toLowerCase()):[];
  let m=by('legacy_spars_id',legacy); if(m.length)return m.length===1?{row:m[0],method:'legacy_spars_id'}:{error:'multiple organizations share SPARS ID'};
  m=by('vendor_number',vendor); if(m.length===1)return {row:m[0],method:'vendor_number'};
  if(m.length>1){const sameName=m.filter(o=>nameKey(o.name)===name);if(sameName.length===1)return {row:sameName[0],method:'vendor_number_name'};return {error:'Address Book # matches multiple organizations; match by SPARS ID or organization name'};}
  m=by('ein',ein); if(m.length>1)return {error:'multiple organizations share Tax ID'};
  if(m.length===1)return nameKey(m[0].name)===name?{row:m[0],method:'ein'}:{error:`Tax ID matched ${m[0].name}, but name does not fit`};
  m=organizations.filter(o=>nameKey(o.name)===name); return m.length===1?{row:m[0],method:'name'}:m.length>1?{error:'multiple organizations share normalized name'}:{row:null,method:'create'};
}

function orgData(r){return {name:text(r['Agency Name']),type:orgType(r),ein:text(r['Tax ID'])||null,vendor_number:text(r['Address Book # (VIN)'])||null,duns:text(r.DUNS)||null,region:text(r.Region)||null,county:text(r.County)||null,address:text(r['Site Address'])||null,legacy_spars_id:text(r['Agency ID (SPARS FIPS)'])||null};}
function grantData(r){const matchRequired=text(r['Match Required']).toLowerCase();return {legacy_grant_id:text(r['Grant ID']),title:text(r.Description)||text(r.Program)||text(r['Grant ID']),program_name:text(r.Program)||null,program_code:text(r.Program)||null,fiscal_year:num(r['Fiscal Year']),grant_number:text(r['Federal Award #'])||null,total_funding_available:num(r['Total Federal Award']),federal_performance_start:date(r['Federal Start Date']),federal_performance_end:date(r['Federal End Date']),local_share_amount:num(r['Local Share']),state_share_amount:num(r['State Share']),mou_amount:num(r['MOU Amount']),match_requirement:num(r['Match %'])??(matchRequired==='yes'?100:matchRequired==='no'?0:null)};}
function appData(r){return {legacy_subaward_id:text(r['Subaward ID (SPARS Grant #)']),grant_number:text(r['Subaward ID (SPARS Grant #)']),application_number:text(r['Subaward ID (SPARS Grant #)'])||null,organization_name:text(r['Agency Name'])||null,nofo_title:text(r['Grant ID'])||null,program_name:text(r.Program)||null,program_code:text(r.Program)||null,project_title:text(r.Title)||null,requested_amount:num(r['Federal Award (SPARS)']),awarded_amount:num(r['Current GAN Amount'])??num(r['Federal Award (SPARS)']),original_award_amount:num(r['Original GAN Amount']),match_amount:num(r['Match Amount']),performance_start:date(r['Period of Performance Start']),performance_end:date(r['Period of Performance End']),poc_first_name:text(r['POC First Name'])||null,poc_last_name:text(r['POC Last Name'])||null,poc_title:text(r['POC Title'])||null,poc_email:text(r['POC Email'])||null,poc_phone:text(r['POC Phone'])||null};}
function projectData(r){return {legacy_project_id:text(r['Project ID']),title:text(r.Title)||null,project_narrative:text(r.Description)||null,project_type:text(r.Type)||null,funding_type:['Pass-Through','Retained'].includes(text(r['Funding Type']))?text(r['Funding Type']):null,project_zip:text(r['Project Zip Code'])||null,awarded_amount:num(r['Awarded Amount'])};}
function budgetData(r){return {legacy_budget_line_id:text(r['Budget Line ID (SPARS)']),line_description:text(r.Description)||null,amount_requested:num(r['Federal Amount']),amount_match:num(r['Match Amount'])??0,ael_number:text(r['AEL Code'])||null,ael_category:text(r['AEL Category'])||null,poete_category:text(r['Portal poete_category']||r['POETE Category'])||null,budget_category:text(r['Portal budget_category'])||null,quantity:num(r.Quantity),unit_cost:num(r['Unit Cost']),vulnerability_addressed:text(r['Vulnerability / Gap Addressed'])||null};}
function reimbursementData(r){return {legacy_reimbursement_id:text(r['Reimbursement ID']),organization_name:text(r['Agency Name'])||null,application_number:text(r['Subaward ID'])||null,amount_requested:num(r['Amount Requested']),status:text(r.Status)||'Complete',submitted_at:date(r['Submitted Date']),original_created_at:date(r['Created Date']),request_type:'Reimbursement'};}
function lineData(r){return {legacy_expenditure_id:text(r['Line ID (SPARS Expenditure ID)']),description:text(r.Description)||null,expenditure_name:text(r.Expenditure)||null,invoice_number:text(r['Invoice #'])||null,amount:num(r['Line Total']),amount_requested:num(r['Federal Amount']),amount_match:num(r['Match Amount'])??0,amount_subgrantee:num(r['Subgrantee Funds'])??0,ael_number:text(r['AEL Code'])||null,ael_category:text(r['AEL Category'])||null,quantity:num(r.Quantity),unit_cost:num(r['Unit Cost']),budget_category:text(r['Portal budget_category'])||null,application_budget_id:text(r['Linked Budget Line ID'])||null};}

function compare(current,data,key){
  if(!current)return {status:'add',changes:data};
  const changes={},errors=[];
  for(const [field,v] of Object.entries(data)){
    if(v===null||v==='')continue;
    const old=current[field];
    if(old===null||old===undefined||old==='')changes[field]=v;
    else if(!sameValue(old,v)&&field!==key)errors.push(`conflict ${field}: portal=${old}, source=${v}`);
  }
  return errors.length?{status:'conflict',changes,errors}:{status:Object.keys(changes).length?'update':'unchanged',changes};
}

async function previewSparsImport(db,actor,payload={}){
  assertSparsImportActor(actor); const tabs=payload.tabs&&typeof payload.tabs==='object'?payload.tabs:{}; const allowReviewed=payload.allowReviewedLinks===true; const allowAgencyIdDependencies=payload.allowAgencyIdDependencies===true; const useExistingGrantDependencies=payload.useExistingGrantDependencies===true;
  const results=[],exceptions=[]; const context={};
  const organizations=await allOrganizations(db); const agencies=sourceRows(tabs,'Agencies');
  context.organizations=new Map(organizations.map(o=>[text(o.legacy_spars_id),o])); context.orgMatches=new Map();
  for(const row of agencies){const match=orgMatch(row,organizations);context.orgMatches.set(sourceId('Agencies',row),match);}
  const configs=[
    ['Agencies','organizations','legacy_spars_id',orgData],['Grants','nofos','legacy_grant_id',grantData],['Subawards','applications','legacy_subaward_id',appData],
    ['Projects','projects','legacy_project_id',projectData],['Budget Lines','application_budgets','legacy_budget_line_id',budgetData],['Reimbursements','funding_requests','legacy_reimbursement_id',reimbursementData]
  ];
  for(const [tab,table,key,mapper] of configs){
    const rows=sourceRows(tabs,tab), existing=tab==='Agencies'?new Map():await rowsBy(db,table,key,rows.map(r=>sourceId(tab,r))), out={tab,table,records:rows.length,added:0,updated:0,unchanged:0,conflicts:0,held:0,rows:[]};
    for(const [i,row] of rows.entries()){
      const sid=sourceId(tab,row), data=mapper(row), errors=[]; let current=existing.get(sid);
      if(tab==='Agencies'){const m=context.orgMatches.get(sid); current=m?.row; if(m?.error)errors.push(m.error); if(!current&&m?.method==='create')data.type=orgType(row);}
      const result=compare(current,data,key); if(errors.length)result.status='conflict',result.errors=errors;
      if(result.status==='add')out.added++;else if(result.status==='update')out.updated++;else if(result.status==='unchanged')out.unchanged++;else out.conflicts++;
      out.rows.push({row:i+2,key:sid,status:result.status,changes:result.changes||{},errors:result.errors||[],match_method:tab==='Agencies'?context.orgMatches.get(sid)?.method:undefined,id:current?.id});
    }
    results.push(out);exceptions.push(...out.rows.filter(x=>x.errors.length).map(x=>({...x,tab})));context[tab]=new Map(rows.map(r=>[sourceId(tab,r),r]));
  }
  // Relationship and child tabs are evaluated after their parent keys are known.
  const relChecks=[['GAN History','GAN ID','award_notice_imports',r=>({legacy_gan_id:text(r['GAN ID']),application_id:text(r['Subaward ID']),gan_number:num(r['GAN #'])}),r=>context.Subawards?.has(text(r['Subaward ID']))],['GAN Project Lines','GAN Line ID','award_notice_import_projects',r=>({legacy_gan_line_id:text(r['GAN Line ID']),project_id:text(r['Project ID']),project_title:text(r['Project Title'])||null}),r=>context['GAN History']?.has(text(r['GAN ID']))&&context.Projects?.has(text(r['Project ID']))]];
  for(const [tab,key,table,mapper,relationship] of relChecks){const rows=sourceRows(tabs,tab),out={tab,table,records:rows.length,added:0,updated:0,unchanged:0,conflicts:0,held:0,rows:[]}; const existing=tab==='Payment Lines'?await rowsBy(db,table,'legacy_expenditure_id',rows.map(r=>r['Reimbursement Line ID'])):new Map(); for(const [i,row] of rows.entries()){const sid=text(row[key]);const errors=[];if(!sid)errors.push(`missing ${key}`);if(!relationship(row))errors.push('dependency is missing or not Ready');let result=compare(existing.get(sid),mapper(row),'id');if(errors.length)result={status:'conflict',changes:result.changes||{},errors};if(result.status==='add')out.added++;else if(result.status==='update')out.updated++;else if(result.status==='unchanged')out.unchanged++;else out.conflicts++;out.rows.push({row:i+2,key:sid,status:result.status,changes:result.changes||{},errors:result.errors||[]});}results.push(out);exceptions.push(...out.rows.filter(x=>x.errors.length).map(x=>({...x,tab})));context[tab]=new Map(rows.map(r=>[text(r[key]),r]));}
  const lines=sourceRows(tabs,'Reimbursement Lines'), lineOut={tab:'Reimbursement Lines',table:'funding_request_line_items',records:lines.length,added:0,updated:0,unchanged:0,conflicts:0,held:0,rows:[]};
  const budgetRows=(await db.query('SELECT id,legacy_budget_line_id FROM application_budgets WHERE legacy_budget_line_id IS NOT NULL')).rows;
  const budgetIds=new Map(budgetRows.map(r=>[text(r.legacy_budget_line_id),text(r.id)]));
  const existingLines=await rowsBy(db,'funding_request_line_items','legacy_expenditure_id',lines.map(r=>sourceId('Reimbursement Lines',r)));
  for(const [i,row] of lines.entries()){const data=lineData(row),sourceBudget=data.application_budget_id;data.application_budget_id=budgetIds.get(sourceBudget)||sourceBudget;const errors=[];if(!context.Reimbursements?.has(text(row['Reimbursement ID'])))errors.push('reimbursement dependency is missing or not Ready');if(!context.Projects?.has(text(row['Project ID'])))errors.push('project dependency is missing or not Ready');if(!sourceBudget)errors.push('no linked ApplicationBudget');if(!data.budget_category)errors.push('missing Portal budget_category');if(text(row['Link Basis']).startsWith('Review:')&&!allowReviewed)errors.push('review/fallback link requires approval');const result=compare(existingLines.get(data.legacy_expenditure_id),data,'legacy_expenditure_id');if(errors.length)result.status='conflict',result.errors=errors; if(result.status==='add')lineOut.added++;else if(result.status==='update')lineOut.updated++;else if(result.status==='unchanged')lineOut.unchanged++;else lineOut.conflicts++;lineOut.rows.push({row:i+2,key:data.legacy_expenditure_id,status:result.status,changes:result.changes||{},errors:result.errors||[],link_basis:text(row['Link Basis'])});}
  lineOut.held=lineOut.records-lineOut.added-lineOut.updated-lineOut.unchanged-lineOut.conflicts;results.push(lineOut);exceptions.push(...lineOut.rows.filter(x=>x.errors.length).map(x=>({...x,tab:'Reimbursement Lines'})));
  context['Reimbursement Lines']=new Map(lines.map(r=>[text(r['Line ID (SPARS Expenditure ID)']),r]));
  const payments=sourceRows(tabs,'Payments'),paymentOut={tab:'Payments',table:'funding_requests (payment reconciliation)',records:payments.length,added:0,updated:0,unchanged:0,conflicts:0,held:0,rows:[]};
  for(const [i,row] of payments.entries()){const ids=text(row['Reimbursement IDs Paid']).split(/[,;|]/).map(text).filter(Boolean),errors=ids.filter(id=>!context.Reimbursements?.has(id)).map(id=>`reimbursement ${id} is missing or not Ready`);if(!text(row['Payment ID (SPARS Voucher ID)']))errors.push('missing Payment ID (SPARS Voucher ID)');const status=errors.length?'conflict':'update';paymentOut[status==='conflict'?'conflicts':'updated']++;paymentOut.rows.push({row:i+2,key:text(row['Payment ID (SPARS Voucher ID)']),status,changes:{paid_amount:num(row['Paid Amount']),payment_method:text(row['Payment Method'])||null},errors});}
  results.push(paymentOut);exceptions.push(...paymentOut.rows.filter(x=>x.errors.length).map(x=>({...x,tab:'Payments'})));
  const paymentLines=sourceRows(tabs,'Payment Lines'),paymentLineOut={tab:'Payment Lines',table:'funding_request_line_items',records:paymentLines.length,added:0,updated:0,unchanged:0,conflicts:0,held:0,rows:[]};
  for(const [i,row] of paymentLines.entries()){const sid=text(row['Reimbursement Line ID']),errors=[];if(!context['Reimbursement Lines'].has(sid))errors.push('reimbursement line dependency is missing or not Ready');const status=errors.length?'conflict':'update';paymentLineOut[status==='conflict'?'conflicts':'updated']++;paymentLineOut.rows.push({row:i+2,key:sid,status,changes:{amount_paid:num(row['Amount Paid'])},errors});}
  results.push(paymentLineOut);exceptions.push(...paymentLineOut.rows.filter(x=>x.errors.length).map(x=>({...x,tab:'Payment Lines'})));
  const summary=results.reduce((a,r)=>{for(const k of ['records','added','updated','unchanged','conflicts','held'])a[k]+=r[k];return a;},{records:0,added:0,updated:0,unchanged:0,conflicts:0,held:0});
  return {mode:'dry-run',excluded:[...OMITTED_TABS],dependencyMode:allowAgencyIdDependencies?'agency-id-existing-org':'strict',grantMode:useExistingGrantDependencies?'existing-grant-by-id':'import',summary,tabs:results,exceptions,fingerprint:hash({tabs,allowReviewed,allowAgencyIdDependencies,useExistingGrantDependencies,summary,tabs:results.map(({rows,...r})=>r)})};
}

export {previewSparsImport};

async function upsert(client,table,key,data,current){
  const entries=Object.entries(data).filter(([,v])=>v!==null&&v!==undefined&&v!==''); if(!entries.length)return current?.id||null;
  if(current){const set=entries.map(([k],i)=>`${k}=$${i+1}`).join(',');const touch=['award_notice_imports','award_notice_import_projects'].includes(table)?'':',updated_date=NOW()';await client.query(`UPDATE ${table} SET ${set}${touch} WHERE id=$${entries.length+1}`,[...entries.map(([,v])=>v),current.id]);return current.id;}
  const id=randomUUID(),fields=['id',...entries.map(([k])=>k)],vals=[id,...entries.map(([,v])=>v)];await client.query(`INSERT INTO ${table} (${fields.join(',')}) VALUES (${fields.map((_,i)=>`$${i+1}`).join(',')})`,vals);return id;
}

export async function commitSparsImport(db,actor,payload={}){
  assertSparsImportActor(actor);if(!payload.fingerprint)throw fail('A dry-run fingerprint is required before commit',409);const preview=await previewSparsImport(db,actor,payload);if(preview.fingerprint!==payload.fingerprint)throw fail('The import changed. Run a new dry run before committing.',409);if((preview.summary.conflicts||preview.summary.held)&&payload.commitEligibleOnly!==true)throw fail('Import has conflicts or held rows; resolve them or use commitEligibleOnly',409);
  const rowStatus=new Map(preview.tabs.map(t=>[t.tab,new Map(t.rows.map(r=>[r.key,r]))]));
  const eligible=(tab,key)=>payload.commitEligibleOnly===true?rowStatus.get(tab)?.get(text(key))?.status!=='conflict':true;
  const dependency=(condition,message)=>{if(condition)return true;if(payload.commitEligibleOnly===true)return false;throw fail(message,409);};
  const client=await db.connect();try{await client.query('BEGIN');const committed=[];const tabs=payload.tabs||{};const orgs=await allOrganizations(client),orgMap=new Map();
    for(const row of sourceRows(tabs,'Agencies')){const sid=sourceId('Agencies',row),m=orgMatch(row,orgs),agencyIdOverride=payload.allowAgencyIdDependencies===true&&m.row?.id&&text(m.row.legacy_spars_id)===sid;if(!eligible('Agencies',sid)&&!agencyIdOverride)continue;if(agencyIdOverride){orgMap.set(sid,m.row.id);continue;}if(!dependency(!m.error,`Organization conflict for ${sid}`))continue;const id=await upsert(client,'organizations','legacy_spars_id',orgData(row),m.row);orgMap.set(sid,id);}
    const grantMap=new Map(),grantTitleMap=new Map(),appMap=new Map(),projectMap=new Map(),budgetMap=new Map(),requestMap=new Map(),lineMap=new Map();
    for(const row of sourceRows(tabs,'Grants')){const sid=sourceId('Grants',row),cur=(await rowsBy(client,'nofos','legacy_grant_id',[sid])).get(sid);if(payload.useExistingGrantDependencies===true&&cur){grantMap.set(sid,cur.id);grantTitleMap.set(sid,cur.title);continue;}if(!eligible('Grants',sid))continue;const d=grantData(row);if(!cur)d.status='Closed';grantMap.set(sid,await upsert(client,'nofos','legacy_grant_id',d,cur));grantTitleMap.set(sid,d.title);}
    for(const row of sourceRows(tabs,'Subawards')){if(!eligible('Subawards',sourceId('Subawards',row)))continue;const cur=(await rowsBy(client,'applications','legacy_subaward_id',[sourceId('Subawards',row)])).get(sourceId('Subawards',row));const d=appData(row);d.organization_id=orgMap.get(text(row['Agency ID']))||null;d.nofo_id=grantMap.get(text(row['Grant ID']))||null;d.nofo_title=grantTitleMap.get(text(row['Grant ID']))||d.nofo_title;if(!cur)d.status='Approved';if(!dependency(d.organization_id&&d.nofo_id,`Missing application dependency for ${sourceId('Subawards',row)}`))continue;appMap.set(sourceId('Subawards',row),await upsert(client,'applications','legacy_subaward_id',d,cur));}
    for(const row of sourceRows(tabs,'Projects')){if(!eligible('Projects',sourceId('Projects',row)))continue;const cur=(await rowsBy(client,'projects','legacy_project_id',[sourceId('Projects',row)])).get(sourceId('Projects',row));const d=projectData(row);d.application_id=appMap.get(text(row['Subaward ID']))||null;if(!cur)d.is_legacy_backfill=true;if(!dependency(d.application_id,`Missing project application for ${sourceId('Projects',row)}`))continue;projectMap.set(sourceId('Projects',row),await upsert(client,'projects','legacy_project_id',d,cur));}
    for(const row of sourceRows(tabs,'Budget Lines')){if(!eligible('Budget Lines',sourceId('Budget Lines',row)))continue;const cur=(await rowsBy(client,'application_budgets','legacy_budget_line_id',[sourceId('Budget Lines',row)])).get(sourceId('Budget Lines',row));const d=budgetData(row);d.application_id=appMap.get(text(row['Subaward ID']))||null;d.project_id=projectMap.get(text(row['Project ID']))||null;if(!dependency(d.application_id&&d.budget_category,`Missing budget dependency/category for ${sourceId('Budget Lines',row)}`))continue;budgetMap.set(sourceId('Budget Lines',row),await upsert(client,'application_budgets','legacy_budget_line_id',d,cur));}
    const ganMap=new Map();
    for(const row of sourceRows(tabs,'GAN History')){const legacy=text(row['GAN ID']);if(!eligible('GAN History',legacy))continue;const cur=(await rowsBy(client,'award_notice_imports','legacy_gan_id',[legacy])).get(legacy),applicationId=appMap.get(text(row['Subaward ID']));if(!dependency(applicationId,`Missing GAN application for ${legacy}`))continue;const app=(await client.query('SELECT organization_id,nofo_id FROM applications WHERE id=$1',[applicationId])).rows[0];const d={legacy_gan_id:legacy,application_id:applicationId,organization_id:app.organization_id,nofo_id:app.nofo_id,gan_number:num(row['GAN #']),gan_type:text(row['GAN Type'])||null,amount_from:num(row['Amount From']),amount_to:num(row['Amount To']),net_change:num(row.Change),pop_start:date(row['Period Start']),pop_end:date(row['Period End']),status:text(row.Status)||'Completed',requested_by:text(row['Requested By'])||null,requested_at:date(row['Requested Date']),released_by:text(row['Released By'])||null,released_at:date(row['Released Date']),verified_by:text(row['Verified By'])||null,verified_at:date(row['Verified Date']),completed_by:text(row['Completed By'])||null,completed_at:date(row['Completed Date']),version:num(row['GAN #']),issue_date:date(row['Completed Date']),source_file:text(row['Source File'])||null,imported_by:actor.email||actor.full_name||'GMT import',source_record:JSON.stringify(row)};ganMap.set(legacy,await upsert(client,'award_notice_imports','legacy_gan_id',d,cur));}
    for(const row of sourceRows(tabs,'GAN Project Lines')){const legacy=text(row['GAN Line ID']);if(!eligible('GAN Project Lines',legacy))continue;const cur=(await rowsBy(client,'award_notice_import_projects','legacy_gan_line_id',[legacy])).get(legacy),notice=ganMap.get(text(row['GAN ID'])),project=projectMap.get(text(row['Project ID']));if(!dependency(notice&&project,`Missing GAN project-line dependency for ${legacy}`))continue;const d={award_notice_import_id:notice,legacy_gan_line_id:legacy,project_id:project,project_title:text(row['Project Title'])||null,amount_from:num(row['Amount From']),amount_to:num(row['Amount To']),net_change:num(row.Change),line_basis:text(row['Line Basis'])||null,source_record:JSON.stringify(row)};await upsert(client,'award_notice_import_projects','legacy_gan_line_id',d,cur);}
    for(const row of sourceRows(tabs,'Reimbursements')){const legacy=sourceId('Reimbursements',row);if(!eligible('Reimbursements',legacy))continue;const cur=(await rowsBy(client,'funding_requests','legacy_reimbursement_id',[legacy])).get(legacy),d=reimbursementData(row);d.application_id=appMap.get(text(row['Subaward ID']))||null;d.project_id=projectMap.get(text(row['Project ID']))||null;d.organization_id=orgMap.get(text(row['Agency ID']))||null;d.request_number=legacy;if(!dependency(d.application_id,`Missing reimbursement application for ${d.legacy_reimbursement_id}`))continue;requestMap.set(d.legacy_reimbursement_id,await upsert(client,'funding_requests','legacy_reimbursement_id',d,cur));}
    for(const row of sourceRows(tabs,'Reimbursement Lines')){const legacy=sourceId('Reimbursement Lines',row);if(!eligible('Reimbursement Lines',legacy))continue;const cur=(await rowsBy(client,'funding_request_line_items','legacy_expenditure_id',[legacy])).get(legacy),d=lineData(row);d.funding_request_id=requestMap.get(text(row['Reimbursement ID']))||null;d.project_id=projectMap.get(text(row['Project ID']))||null;d.application_budget_id=budgetMap.get(text(row['Linked Budget Line ID']))||null;if(!dependency(d.funding_request_id&&d.application_budget_id,`Missing reimbursement-line dependency for ${d.legacy_expenditure_id}`))continue;await upsert(client,'funding_request_line_items','legacy_expenditure_id',d,cur);lineMap.set(d.legacy_expenditure_id,cur?.id||true);}
    for(const row of sourceRows(tabs,'Payment Lines')){const lineId=text(row['Reimbursement Line ID']);if(!eligible('Payment Lines',lineId)||!dependency(lineMap.has(lineId),`Missing payment-line reimbursement dependency ${lineId}`))continue;await client.query('UPDATE funding_request_line_items SET amount_paid=COALESCE(amount_paid,$1),updated_date=NOW() WHERE legacy_expenditure_id=$2',[num(row['Amount Paid']),lineId]);}
    for(const row of sourceRows(tabs,'Payments')){const ids=text(row['Reimbursement IDs Paid']).split(/[,;|]/).map(text).filter(Boolean);for(const rid of ids){if(requestMap.has(rid))await client.query('UPDATE funding_requests SET amount_paid=COALESCE(amount_paid,$1),payment_method=COALESCE(payment_method,$2),payment_status=COALESCE(payment_status,$3),payment_reference=COALESCE(payment_reference,$4),payment_date=COALESCE(payment_date,$5),voucher_number=COALESCE(voucher_number,$6),updated_date=NOW() WHERE id=$7',[num(row['Paid Amount']),paymentMethod(row['Payment Method']),paymentStatus(row.Status),text(row['Payment # (EFT / Check)'])||null,date(row['Paid Date']),text(row['Voucher # as entered in SPARS'])||text(row['Voucher #'])||null,requestMap.get(rid)]);}}
    await client.query('COMMIT');return {mode:payload.commitEligibleOnly===true?'commit-eligible':'commit',summary:preview.summary,committed:true,skippedConflicts:payload.commitEligibleOnly===true?preview.exceptions:[],excluded:[...OMITTED_TABS]};
  }catch(e){await client.query('ROLLBACK');throw e}finally{client.release();}
}
