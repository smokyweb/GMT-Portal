import { base44 } from '@/api/base44Client';

const VARIANCE_THRESHOLD = 0.15; // 15%

/**
 * Scans all approved applications and flags any whose expenditure
 * variance exceeds 15% of the awarded budget.
 * Creates a ComplianceFlag and notifies all state admins.
 */
export async function runVarianceScanner(triggeredByUser) {
  const [applications, existingFlags, users] = await Promise.all([
    base44.entities.Application.filter({ status: 'Approved' }, '-created_date', 200),
    base44.entities.ComplianceFlag.filter({ flag_type: 'FinancialDiscrepancy', is_resolved: false }),
    base44.entities.User.list(),
  ]);

  const stateAdmins = users.filter(u => u.role === 'admin' || u.role === 'reviewer');

  // Build set of already-flagged application IDs so we don't duplicate
  const alreadyFlaggedIds = new Set(existingFlags.map(f => f.application_id));

  let newFlagsCount = 0;

  for (const app of applications) {
    if (!app.awarded_amount || app.awarded_amount === 0) continue;

    const expended = app.total_expended || 0;
    const variance = Math.abs(expended - app.awarded_amount) / app.awarded_amount;

    if (variance > VARIANCE_THRESHOLD && !alreadyFlaggedIds.has(app.id)) {
      const variancePct = (variance * 100).toFixed(1);
      const severity = variance > 0.4 ? 'Critical' : variance > 0.25 ? 'High' : 'Medium';

      // Create compliance flag
      const flag = await base44.entities.ComplianceFlag.create({
        application_id: app.id,
        application_number: app.application_number,
        organization_name: app.organization_name,
        flag_type: 'FinancialDiscrepancy',
        description: `Expenditure variance of ${variancePct}% detected. Awarded: $${app.awarded_amount?.toLocaleString()}, Expended: $${expended?.toLocaleString()}.`,
        severity,
        is_resolved: false,
      });

      // Notify all state admins
      for (const admin of stateAdmins) {
        await base44.entities.Notification.create({
          user_email: admin.email,
          title: `⚠️ Budget Variance Alert — ${app.organization_name}`,
          message: `Application ${app.application_number} shows a ${variancePct}% expenditure variance exceeding the 15% threshold. Immediate review recommended.`,
          type: 'variance_alert',
          entity_type: 'ComplianceFlag',
          entity_id: flag.id,
          is_read: false,
          link: '/compliance',
        });
      }

      // Audit log
      await base44.entities.AuditLog.create({
        user_email: triggeredByUser?.email || 'system',
        user_name: triggeredByUser?.full_name || 'Automated Scanner',
        action: 'FlagCreated',
        entity_type: 'ComplianceFlag',
        entity_id: flag.id,
        description: `Variance scanner flagged ${app.application_number} (${variancePct}% variance).`,
      });

      newFlagsCount++;
    }
  }

  return { scanned: applications.length, flagged: newFlagsCount };
}