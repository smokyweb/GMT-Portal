import {formActor} from '../services/forms/formAccess.js';
import {accountError} from '../services/accountPolicy.js';
const quoted=value=>'"'+String(value).replace(/"/g,'""')+'"';
// Activation must mount this before the generic Notification entity router.
export function createGanWorkflowNotificationAccess(db) {
  return async(req,res,next)=>{
    if(req.params.entity!=='Notification')return next();
    try{
      if(!(await db.query("SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='notifications' AND column_name='gan_workflow_user_id'")).rows.length)return next();
      const actor=await formActor(db,req.user.id),single=req.params.id&&req.params.id!=='filter',reading=req.method==='GET'||req.method==='POST'&&req.params.id==='filter';
      if(reading){
        const columns=(await db.query("SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='notifications'")).rows.map(row=>row.column_name),valid=new Set(columns);
        const values=[actor.id],where=['(gan_workflow_event_id IS NULL OR gan_workflow_user_id=$1)'],put=value=>{values.push(value);return '$'+values.length;};
        if(single)where.push('id::text='+put(req.params.id));
        else{
          const filters=req.method==='POST'?req.body?.filter||{}:{};if(!filters||Array.isArray(filters)||typeof filters!=='object')throw accountError(400,'Choose named notification filters');
          for(const [key,value] of Object.entries(filters)){
            if(!valid.has(key))throw accountError(400,'Unknown notification filter');
            if(key==='user_email'&&value===actor.email)where.push('(user_email='+put(value)+' OR gan_workflow_user_id=$1)');
            else if(value==null)where.push(quoted(key)+' IS NULL');
            else if(Array.isArray(value))where.push(quoted(key)+'=ANY('+put(value)+')');
            else where.push(quoted(key)+'='+put(typeof value==='object'?JSON.stringify(value):value));
          }
        }
        const sort=String((req.method==='POST'?req.body?.sort:req.query.sort)||'-created_date'),column=sort.replace(/^-/,'');if(!valid.has(column))throw accountError(400,'Unknown notification sort');
        const limit=single?1:Math.max(1,Math.min(Number.parseInt(req.method==='POST'?req.body?.limit:req.query.limit,10)||500,5000));
        const rows=(await db.query('SELECT * FROM notifications WHERE '+where.join(' AND ')+' ORDER BY '+quoted(column)+(sort.startsWith('-')?' DESC':' ASC')+' LIMIT '+put(limit),values)).rows;
        res.set('Cache-Control','private, no-store');if(single&&!rows.length)throw accountError(404,'Notification not found');return res.json(single?rows[0]:rows);
      }
      if(Object.keys(req.body||{}).some(key=>key.toLowerCase().startsWith('gan_')))throw accountError(403,'Managed GAN alerts are created by the owned workflow');
      const row=single?(await db.query('SELECT * FROM notifications WHERE id::text=$1',[req.params.id])).rows[0]:null;
      if(!row?.gan_workflow_event_id)return next();
      if(row.gan_workflow_user_id!==actor.id)throw accountError(403,'This GAN alert belongs to another recipient');
      if(req.method!=='PUT'||Object.keys(req.body||{}).some(key=>key!=='is_read')||typeof req.body?.is_read!=='boolean')throw accountError(403,'Only the read marker may change on this GAN alert');
      const client=await db.connect();try{await client.query('BEGIN');await client.query("SELECT set_config('gmt.gan_action','notification_read',true),set_config('gmt.gan_notification_actor',$1,true)",[actor.id]);
        const saved=(await client.query('UPDATE notifications SET is_read=$2,updated_date=NOW() WHERE id=$1 RETURNING *',[row.id,req.body.is_read])).rows[0];await client.query('COMMIT');return res.json(saved);
      }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
    }catch(error){res.status(error.status||500).json({error:error.status?error.message:'Unable to verify GAN notification access'});}
  };
}
