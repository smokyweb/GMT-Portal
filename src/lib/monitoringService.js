import { base44 } from '@/api/base44Client';
import { logAudit, createNotification } from './helpers';

// Thresholds
const THRESHOLDS = {
  LOW_EXPENDITURE_WARNING: 25,   // < 25% spent with < 90 days left → warning
  LOW_EXPENDITURE_CRITICAL: 10,  // < 10% spent with < 90 days left → critical
  HIGH_BURN_WARNING: 90,         // > 90% spent → risk of running over
  OVERDUE_DAYS: 0,               // report past due_date
};

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function daysAgo(dateStr) {
  if (!dateStr) return null;
  const diff = new Date() - new Date(dateStr);
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

async function notifyStateAdmins(title, message, entityType, entityId) {
  const admins = await base44.entities.User.list();
  const adminEmails = admins.filter(u => u.role === 'admin').map(u => u.email);
  await Promise.all(adminEmails.map(email =>
    createNotification(base44, email, title, message, 'alert', entityType, entityId)
  ));
}

async function notifySubmitter(email, title, message, entityType, entityId) {
  if (!email) return;
  await createNotification(base44, email, title, message, 'alert', entityType, entityId);
}

export async function runGrantMonitor(currentUser) {
  const results = { created: 0, skipped: 0, checks: [] };

  const [applications, reportSchedules, existingFlags] = await Promise.all([
    base44.entities.Application.filter({ status: 'Approved' }),
    base44.entities.ReportSchedule.list('-due_date', 200),
    base44.entities.ComplianceFlag.filter({ is_resolved: false }),
  ]);

  const existingFlagKeys = new Set(
    existingFlags.map(f => `${f.application_id}::${f.flag_type}::${f.description?.slice(0, 40)}`)
  );

  const flagsToCreate = [];
  const notifications = [];

  // --- Check 1: Low expenditure rate with deadline approaching ---
  for (const app of applications) {
    const daysLeft = daysUntil(app.performance_end);
    const rate = app.expenditure_rate || 0;

    if (daysLeft !== null && daysLeft <= 90) {
      let severity = null;
      let desc = null;

      if (rate < THRESHOLDS.LOW_EXPENDITURE_CRITICAL) {
        severity = 'Critical';
        desc = `Only ${rate.toFixed(0)}% expended with ${daysLeft} days remaining in performance period`;
      } else if (rate < THRESHOLDS.LOW_EXPENDITURE_WARNING) {
        severity = 'High';
        desc = `Only ${rate.toFixed(0)}% expended with ${daysLeft} days remaining in performance period`;
      }

      if (severity && desc) {
        const key = `${app.id}::FinancialDiscrepancy::${desc.slice(0, 40)}`;
        if (!existingFlagKeys.has(key)) {
          flagsToCreate.push({
            application_id: app.id,
            application_number: app.application_number,
            organization_name: app.organization_name,
            flag_type: 'FinancialDiscrepancy',
            description: desc,
            severity,
            is_resolved: false,
          });
          notifications.push({
            adminTitle: `Low Expenditure Alert — ${app.application_number}`,
            adminMsg: `${app.organization_name}: ${desc}`,
            subTitle: `Action Required — ${app.application_number}`,
            subMsg: desc + `. Please review your spending plan.`,
            submittedBy: app.submitted_by,
            entityId: app.id,
          });
          results.checks.push({ type: 'LowExpenditure', severity, app: app.application_number, org: app.organization_name, desc });
        } else {
          results.skipped++;
        }
      }
    }

    // --- Check 2: High burn rate (> 90%) ---
    if (rate > THRESHOLDS.HIGH_BURN_WARNING) {
      const desc = `Expenditure rate at ${rate.toFixed(0)}% — funds may be exhausted before period end`;
      const key = `${app.id}::FinancialDiscrepancy::${desc.slice(0, 40)}`;
      if (!existingFlagKeys.has(key)) {
        flagsToCreate.push({
          application_id: app.id,
          application_number: app.application_number,
          organization_name: app.organization_name,
          flag_type: 'FinancialDiscrepancy',
          description: desc,
          severity: 'High',
          is_resolved: false,
        });
        notifications.push({
          adminTitle: `High Burn Rate Alert — ${app.application_number}`,
          adminMsg: `${app.organization_name}: ${desc}`,
          subTitle: `Funding Alert — ${app.application_number}`,
          subMsg: desc,
          submittedBy: app.submitted_by,
          entityId: app.id,
        });
        results.checks.push({ type: 'HighBurnRate', severity: 'High', app: app.application_number, org: app.organization_name, desc });
      } else {
        results.skipped++;
      }
    }
  }

  // --- Check 3: Overdue report schedules ---
  for (const schedule of reportSchedules) {
    if (schedule.status === 'Pending') {
      const overdueDays = daysAgo(schedule.due_date);
      if (overdueDays !== null && overdueDays > THRESHOLDS.OVERDUE_DAYS) {
        const desc = `${schedule.report_type} report overdue by ${overdueDays} day(s) (due ${schedule.due_date})`;
        const key = `${schedule.application_id}::OverdueReport::${desc.slice(0, 40)}`;
        if (!existingFlagKeys.has(key)) {
          const severity = overdueDays > 30 ? 'Critical' : overdueDays > 14 ? 'High' : 'Medium';
          flagsToCreate.push({
            application_id: schedule.application_id,
            application_number: schedule.application_number,
            organization_name: schedule.organization_name,
            flag_type: 'OverdueReport',
            description: desc,
            severity,
            is_resolved: false,
          });
          notifications.push({
            adminTitle: `Overdue Report — ${schedule.application_number}`,
            adminMsg: `${schedule.organization_name}: ${desc}`,
            subTitle: `Report Overdue — ${schedule.application_number}`,
            subMsg: `Your ${schedule.report_type} report was due on ${schedule.due_date} and has not been submitted.`,
            submittedBy: null, // no submitter on schedule directly
            entityId: schedule.application_id,
          });
          results.checks.push({ type: 'OverdueReport', severity, app: schedule.application_number, org: schedule.organization_name, desc });
        } else {
          results.skipped++;
        }
      }
    }
  }

  // Batch create flags and send notifications
  if (flagsToCreate.length > 0) {
    await base44.entities.ComplianceFlag.bulkCreate(flagsToCreate);
    results.created = flagsToCreate.length;
  }

  await Promise.all(notifications.map(async n => {
    await notifyStateAdmins(n.adminTitle, n.adminMsg, 'Application', n.entityId);
    if (n.submittedBy) await notifySubmitter(n.submittedBy, n.subTitle, n.subMsg, 'Application', n.entityId);
  }));

  await logAudit(
    base44,
    currentUser,
    'MonitoringRun',
    'System',
    null,
    `Automated monitor run: ${results.created} new flags created, ${results.skipped} duplicates skipped`
  );

  return results;
}