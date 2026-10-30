export async function ehpAuditExport(db,id) {
  const exists=(await db.query("SELECT to_regclass(current_schema()||'.ehp_decisions') AS name")).rows[0].name;
  if(!exists)return {decisions:[],lines:[]};
  const [decisions,lines]=await Promise.all([
    db.query('SELECT * FROM ehp_decisions WHERE application_id=$1 ORDER BY revision',[id]),
    db.query(`SELECT li.* FROM funding_request_line_items li JOIN funding_requests fr
      ON fr.id::text=COALESCE(NULLIF(li.funding_request_id,''),li.fund_request_id)
      WHERE fr.application_id=$1 ORDER BY li.created_date,li.id`,[id]),
  ]);
  return {decisions:decisions.rows,lines:lines.rows};
}
