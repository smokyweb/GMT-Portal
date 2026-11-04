export async function migrateAwardNotices(db) {
  await db.query(`
    CREATE OR REPLACE VIEW award_notices AS
    WITH ordered AS (
      SELECT i.id,
        d.id AS document_id,d.application_id,i.organization_id,i.nofo_id,
        row_number() OVER (PARTITION BY d.application_id ORDER BY i.issued_at,i.id)-1 AS gan_number,
        i.manifest,i.issued_at,d.gan_revision,
        COALESCE(w.phase,d.status) AS current_status,
        (SELECT e.actor_email FROM gan_workflow_events e WHERE e.issue_id=i.id AND e.action='send' ORDER BY e.revision DESC LIMIT 1) AS released_by,
        (SELECT e.occurred_at FROM gan_workflow_events e WHERE e.issue_id=i.id AND e.action='send' ORDER BY e.revision DESC LIMIT 1) AS released_at,
        (SELECT e.actor_email FROM gan_workflow_events e WHERE e.issue_id=i.id AND e.action='accept_upload' ORDER BY e.revision DESC LIMIT 1) AS verified_by,
        (SELECT e.occurred_at FROM gan_workflow_events e WHERE e.issue_id=i.id AND e.action='accept_upload' ORDER BY e.revision DESC LIMIT 1) AS verified_at,
        (SELECT e.actor_email FROM gan_workflow_events e WHERE e.issue_id=i.id AND e.action IN ('accept_upload','sign') ORDER BY e.revision DESC LIMIT 1) AS completed_by,
        (SELECT e.occurred_at FROM gan_workflow_events e WHERE e.issue_id=i.id AND e.action IN ('accept_upload','sign') ORDER BY e.revision DESC LIMIT 1) AS completed_at
      FROM gan_workflow_issues i
      JOIN generated_documents d ON d.id=i.document_id
      LEFT JOIN gan_workflows w ON w.document_id=d.id
      WHERE d.gan_managed
    ), values AS (
      SELECT ordered.*,
        NULLIF(regexp_replace(manifest->'gan'->'values'->>'total_award_amount','[^0-9.-]','','g'),'')::numeric AS amount_to,
        manifest->'gan'->'values'->>'performance_start_date' AS pop_start,
        manifest->'gan'->'values'->>'performance_end_date' AS pop_end,
        manifest->'gan'->'values'->>'subaward_number' AS subaward_number,
        manifest->'sender'->>'name' AS requested_by,
        issued_at AS requested_at
      FROM ordered
    ), final AS (
      SELECT values.*,LAG(amount_to) OVER (PARTITION BY application_id ORDER BY issued_at,id) AS amount_from
      FROM values
    )
    SELECT final.id,
      CASE WHEN COALESCE(g.legacy_fields_enabled,false) AND final.subaward_number IS NOT NULL AND btrim(final.subaward_number)<>''
        THEN final.subaward_number||'-GAN'||lpad(final.gan_number::text,2,'0') ELSE NULL END AS legacy_gan_id,
      final.application_id,final.organization_id,final.nofo_id,final.document_id,final.gan_number,
      CASE WHEN final.gan_number=0 THEN 'Award' ELSE 'Amendment – Amount and Period' END AS gan_type,
      final.amount_from,final.amount_to,final.amount_to-final.amount_from AS net_change,final.pop_start,final.pop_end,
      final.current_status AS status,final.requested_by,final.requested_at,final.released_by,final.released_at,final.verified_by,final.verified_at,
      final.completed_by,final.completed_at,
      '/api/gan/issues/'||final.id||'/pdf' AS pdf_url
    FROM final
    LEFT JOIN applications a ON a.id::text=final.application_id
    LEFT JOIN organizations o ON o.id::text=a.organization_id
    LEFT JOIN LATERAL (SELECT grantee.* FROM grantees grantee WHERE upper(grantee.state_code)=upper(o.state) ORDER BY grantee.id LIMIT 1) g ON true
  `);
}
