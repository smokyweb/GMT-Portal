import {Router} from 'express';
export function createPreviewEntities(db,tables) {
  if(!String(db.options.options).includes('search_path=gmt_qa_preview_'))throw new Error('Preview entities require an isolated QA schema');
  const router=Router(),safe=row=>{const {password_hash,auth_version,...data}=row;return data;};
  const handle=action=>async(req,res)=>{try{await action(req,res);}catch(error){res.status(400).json({error:error.message});}};
  router.get('/:entity',handle(async(req,res)=>{
    const table=tables[req.params.entity];if(!table)return res.status(404).json({error:'Unknown QA entity'});
    res.json((await db.query('SELECT * FROM '+table)).rows.map(safe));
  }));
  router.post('/:entity/filter',handle(async(req,res)=>{
    const table=tables[req.params.entity];if(!table)return res.status(404).json({error:'Unknown QA entity'});
    const rows=(await db.query('SELECT * FROM '+table)).rows;
    res.json(rows.filter(row=>Object.entries(req.body.filter||{}).every(([key,value])=>Array.isArray(value)?value.includes(row[key]):row[key]===value)).map(safe));
  }));
  const writable=new Set(['Document','ApplicationBudget','Notification','Nofo','GrantProgram']);
  const mutate=async(req,res)=>{
    if(!writable.has(req.params.entity))return res.status(403).json({error:'QA entity is read only'});
    const table=tables[req.params.entity],columns=new Set((await db.query("SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=$1",[table])).rows.map(row=>row.column_name));
    const data=Object.fromEntries(Object.entries(req.body||{}).filter(([key])=>!['id','created_date','updated_date'].includes(key)));
    const keys=Object.keys(data);if(keys.some(key=>!columns.has(key)||!/^[_a-z][_a-z0-9]*$/i.test(key)))throw new Error('Unknown QA field');
    const values=keys.map(key=>data[key]!==null&&typeof data[key]==='object'?JSON.stringify(data[key]):data[key]);
    if(req.method==='DELETE'){await db.query('DELETE FROM '+table+' WHERE id::text=$1',[req.params.id]);return res.json({success:true});}
    const sql=req.method==='POST'?'INSERT INTO '+table+' ('+keys.join(',')+') VALUES ('+keys.map((_,i)=>'$'+(i+1)).join(',')+') RETURNING *':'UPDATE '+table+' SET '+keys.map((key,i)=>key+'=$'+(i+2)).join(',')+' WHERE id::text=$1 RETURNING *';
    const result=await db.query(sql,req.method==='POST'?values:[req.params.id,...values]);res.json(safe(result.rows[0]));
  };
  router.post('/:entity',handle(mutate));router.put('/:entity/:id',handle(mutate));router.delete('/:entity/:id',handle(mutate));
  return router;
}
