import {Router} from 'express';
import {randomUUID} from 'node:crypto';
import {readAwardNoticeHistory} from '../services/documents/awardNoticeRead.js';

function requireImportRole(req) {
  if(!['admin','isc_admin'].includes(req.user?.role)) {
    const error=new Error('Only state or ISC administrators can import historical GANs');
    error.status=403; throw error;
  }
}

export function createAwardNoticeRouter(db,authenticate) {
  const router=Router();router.use(authenticate);
  router.post('/import',async(req,res)=>{
    const client=await db.connect();
    try {
      requireImportRole(req);
      const rows=Array.isArray(req.body?.rows)?req.body.rows:[];
      if(!rows.length||rows.length>5000)throw Object.assign(new Error('Provide between 1 and 5000 GAN rows'),{status:400});
      await client.query('BEGIN');
      const results=[];
      for(const source of rows) {
        const applicationId=String(source.application_id||'');
        const legacyGanId=String(source.legacy_gan_id||'').trim();
        if(!applicationId||!legacyGanId||source.gan_number===undefined)throw Object.assign(new Error('Each GAN needs application_id, legacy_gan_id, and gan_number'),{status:400});
        const app=(await client.query('SELECT id,organization_id,nofo_id FROM applications WHERE id::text=$1',[applicationId])).rows[0];
        if(!app)throw Object.assign(new Error(`Application not found for GAN ${legacyGanId}`),{status:404});
        const duplicate=(await client.query('SELECT id FROM award_notices WHERE legacy_gan_id=$1 LIMIT 1',[legacyGanId])).rows[0];
        if(duplicate){results.push({legacy_gan_id:legacyGanId,status:'skipped',id:duplicate.id});continue;}
        const id=randomUUID(),amountFrom=source.amount_from??null,amountTo=source.amount_to??null;
        const netChange=source.net_change??(amountFrom!==null&&amountTo!==null?Number(amountTo)-Number(amountFrom):null);
        const inserted=(await client.query(`INSERT INTO award_notice_imports
          (id,legacy_gan_id,application_id,organization_id,nofo_id,gan_number,gan_type,amount_from,amount_to,net_change,pop_start,pop_end,status,requested_by,requested_at,released_by,released_at,verified_by,verified_at,completed_by,completed_at,pdf_url,version,issue_date,source_file,imported_by,source_record)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,COALESCE($13,'Completed'),$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)
          RETURNING id`,[id,legacyGanId,app.id,app.organization_id,app.nofo_id,Number(source.gan_number),source.gan_type||null,amountFrom,amountTo,netChange,source.pop_start||null,source.pop_end||null,source.status||null,source.requested_by||null,source.requested_at||null,source.released_by||null,source.released_at||null,source.verified_by||null,source.verified_at||null,source.completed_by||null,source.completed_at||null,source.pdf_url||null,source.version??Number(source.gan_number),source.issue_date||source.completed_at||source.requested_at||null,source.source_file||null,req.user.email||req.user.full_name||'GMT import',JSON.stringify(source)])).rows[0];
        for(const line of (Array.isArray(source.project_lines)?source.project_lines:[])) {
          if(!line.legacy_gan_line_id)throw Object.assign(new Error(`GAN ${legacyGanId} has a project line without legacy_gan_line_id`),{status:400});
          await client.query(`INSERT INTO award_notice_import_projects(award_notice_import_id,legacy_gan_line_id,project_id,project_title,amount_from,amount_to,net_change,line_basis,source_record)
            VALUES($1,$2,$3,$4,$5,$6,COALESCE($7,$6::numeric-$5::numeric),$8,$9) ON CONFLICT(legacy_gan_line_id) DO NOTHING`,[inserted.id,String(line.legacy_gan_line_id),line.project_id||null,line.project_title||null,line.amount_from??null,line.amount_to??null,line.net_change??null,line.line_basis||null,JSON.stringify(line)]);
        }
        results.push({legacy_gan_id:legacyGanId,status:'inserted',id:inserted.id});
      }
      await client.query('COMMIT');res.status(201).json({results});
    } catch(error){await client.query('ROLLBACK');console.error('Historical GAN import failed:',error);res.status(error.status||500).json({error:error.status?error.message:'Unable to import historical GANs'});} finally {client.release();}
  });
  router.get('/applications/:id',async(req,res)=>{try{res.json(await readAwardNoticeHistory(db,req.user.id,req.params.id));}catch(error){res.status(error.status||500).json({error:error.status?error.message:'Unable to load GAN history'});}});
  router.get('/current',async(req,res)=>{
    try {
      const actor=await db.query('SELECT * FROM users WHERE id::text=$1',[req.user.id]).then(result=>result.rows[0]);
      if(!actor)throw Object.assign(new Error('Active account required'),{status:401});
      const requested=String(req.query.application_ids||'').split(',').map(value=>value.trim()).filter(Boolean).slice(0,5000);
      const values=[];const where=[];
      if(requested.length){values.push(requested);where.push(`a.id::text = ANY($${values.length}::text[])`);}
      if(['federal_admin','federal_officer','isc_admin'].includes(actor.role)){
        // Federal/ISC users can see all applications.
      } else if(actor.role==='user') {
        values.push(actor.id);
        where.push(`EXISTS (SELECT 1 FROM user_organizations member_org WHERE member_org.user_id=$${values.length} AND member_org.organization_id::text=a.organization_id::text)`);
      }
      else {
        const state=String(actor.scope_state||actor.grantee_state||'').trim().toUpperCase();
        if(!['admin','reviewer'].includes(actor.role)||!state){return res.json([]);}
        values.push(state);where.push(`btrim(COALESCE(o.state,''))<>'' AND upper(o.state)=upper($${values.length})`);
      }
      const sql=`SELECT DISTINCT ON (n.application_id) n.* FROM award_notices n JOIN applications a ON a.id::text=n.application_id::text LEFT JOIN organizations o ON o.id::text=a.organization_id::text WHERE lower(trim(COALESCE(n.status,''))) IN ('issued','completed') ${where.length?`AND ${where.join(' AND ')}`:''} ORDER BY n.application_id,COALESCE(n.version,n.gan_number, -1) DESC,n.issue_date DESC NULLS LAST,n.gan_number DESC`;
      res.json((await db.query(sql,values)).rows);
    } catch(error){res.status(error.status||500).json({error:error.status?error.message:'Unable to load current award notices'});}
  });
  return router;
}
