import {randomUUID} from 'node:crypto';
import {transaction} from '../accountRepository.js';
import {accountError} from '../accountPolicy.js';
import {formActor,formNofo,auditForm} from '../forms/formAccess.js';
import {validateNofoMutation} from '../forms/nofoRecordPolicy.js';
import {NOFO_AWARD_FIELDS} from '../../../src/lib/awards/awardFields.js';
import {normalizeNofoAwards,normalizeAwardValue} from './awardValidation.js';
import {normalizeNofoInput} from '../nofoPolicy.js';
import {legacyContext,stripNofoLegacyFields,assertLegacyNofoMutation} from '../legacyFields.js';
export async function mutateAwardNofo(pool,actorId,id,input={},method='PUT') {
  return transaction(pool,async db=>{
    const actor=await formActor(db,actorId),previous=id?await formNofo(db,id,true):null;
    let data=await validateNofoMutation(db,actor,id,input,method);
    const context=await legacyContext(db,actor);
    assertLegacyNofoMutation(actor,data,context);
    if(method!=='DELETE'){data=normalizeNofoInput(data,{isCreate:!previous});if(!context.canEdit)delete data.legacy_grant_id;}
    if(!previous&&method!=='DELETE')data.status=data.status||'Draft';
    if(data.title!==undefined&&(typeof data.title!=='string'||!data.title.trim()||data.title.length>500))throw accountError(400,'Enter a NOFO title under 500 characters');
    if(method==='DELETE') {
      if((await db.query('SELECT id FROM applications WHERE nofo_id=$1 LIMIT 1',[id])).rows.length)throw accountError(409,'Keep NOFOs that have applications; close them instead');
      await db.query('DELETE FROM nofos WHERE id=$1',[id]);return {success:true};
    }
    const expected=data.expectedAwardMetadataRevision;delete data.expectedAwardMetadataRevision;
    if(data.award_metadata_revision!==undefined)throw accountError(400,'NOFO metadata revisions are assigned by the server');
    const newKeys=['grant_number',...NOFO_AWARD_FIELDS.map(field=>field.key)];
    if(previous&&(expected!==undefined||newKeys.some(key=>Object.hasOwn(data,key)))) {
      if(expected!==previous.award_metadata_revision)throw accountError(409,'NOFO details changed. Reload before saving.');
    }
    for(const key of ['id','created_date','updated_date','created_by_id','is_sample'])delete data[key];
    if(previous)delete data.created_by;
    const programId=Object.hasOwn(data,'program_id')?data.program_id||null:previous?.program_id;
    let program=programId?(await db.query('SELECT * FROM grant_programs WHERE id::text=$1',[programId])).rows[0]:null;
    if(programId&&!program)throw accountError(400,'Select an existing grant program');
    if(!program){const matches=(await db.query('SELECT * FROM grant_programs WHERE code=$1 LIMIT 2',[data.program_code||previous?.program_code])).rows;if(matches.length===1)program=matches[0];}
    if(program){data.program_name=program.name;data.program_code=program.code;data.program_id=program.id;}
    if(previous&&previous.program_id!==programId&&(previous.current_form_version_id||(await db.query('SELECT id FROM applications WHERE nofo_id=$1 LIMIT 1',[id])).rows.length))throw accountError(409,'A NOFO with applications keeps its original grant program');
    if(!previous&&program) {
      if(!Object.hasOwn(data,'cfda_number'))data.cfda_number=program.cfda_number||null;
    }
    if(Object.hasOwn(data,'grant_number'))data.grant_number=normalizeAwardValue({key:'grant_number',label:'Federal Grant Number (FAIN)'},data.grant_number);
    data=normalizeNofoAwards(data,previous||{},program||{});
    data.award_metadata_revision=(previous?.award_metadata_revision||0)+1;
    const columns=new Set((await db.query("SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='nofos'")).rows.map(row=>row.column_name));
    const keys=Object.keys(data);if(keys.some(key=>!/^[_a-z][_a-z0-9]*$/i.test(key)||!columns.has(key)))throw accountError(400,'Unknown NOFO field');
    const values=keys.map(key=>data[key]!==null&&typeof data[key]==='object'?JSON.stringify(data[key]):data[key]);let saved;
    if(id)saved=(await db.query('UPDATE nofos SET '+keys.map((key,i)=>key+'=$'+(i+2)).join(',')+',updated_date=NOW() WHERE id=$1 RETURNING *',[id,...values])).rows[0];
    else saved=(await db.query('INSERT INTO nofos(id,'+keys.join(',')+') VALUES($1,'+keys.map((_,i)=>'$'+(i+2)).join(',')+') RETURNING *',[randomUUID(),...values])).rows[0];
    await auditForm(db,actor,saved.id,id?'NofoDetailsUpdated':'NofoCreated','Saved NOFO details and federal award information revision '+saved.award_metadata_revision);
    return stripNofoLegacyFields(saved,context.enabled);
  });
}
