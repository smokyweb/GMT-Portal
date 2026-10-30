export async function ganBatchList(db,actorId,nofoIds) {
  const rows=(await db.query(`SELECT b.id,b.nofo_id,b.created_at,b.template_version,jsonb_array_length(b.rows) AS total,
    (SELECT count(*) FROM gan_draft_batch_results r WHERE r.batch_id=b.id AND r.state='Generated')::integer AS generated
    FROM gan_draft_batches b WHERE b.actor_id=$1 AND b.nofo_id=ANY($2::text[]) ORDER BY b.created_at DESC,b.id LIMIT 100`,[actorId,nofoIds])).rows;
  return rows;
}
