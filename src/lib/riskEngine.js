import { base44 } from '@/api/base44Client';

/**
 * Risk Score Engine
 * Scores each subrecipient organization 0–100 based on:
 *  - Compliance flags (weighted by severity)
 *  - Overdue reports
 *  - Expenditure variance (over/under-spending approved budget)
 *  - Audit log anomalies (frequent status changes)
 */

const SEVERITY_WEIGHT = { Low: 2, Medium: 5, High: 10, Critical: 20 };
const RISK_LEVELS = [
  { max: 20, label: 'Low', color: 'text-green-700', bg: 'bg-green-50', bar: 'bg-green-500' },
  { max: 45, label: 'Medium', color: 'text-amber-700', bg: 'bg-amber-50', bar: 'bg-amber-500' },
  { max: 70, label: 'High', color: 'text-orange-700', bg: 'bg-orange-50', bar: 'bg-orange-500' },
  { max: 100, label: 'Critical', color: 'text-red-700', bg: 'bg-red-50', bar: 'bg-red-500' },
];

export function getRiskLevel(score) {
  return RISK_LEVELS.find(r => score <= r.max) || RISK_LEVELS[RISK_LEVELS.length - 1];
}

export async function computeRiskScores() {
  const [flags, reports, applications, auditLogs] = await Promise.all([
    base44.entities.ComplianceFlag.list('-created_date', 500),
    base44.entities.ReportSchedule.list('-due_date', 500),
    base44.entities.Application.filter({ status: 'Approved' }, '-created_date', 500),
    base44.entities.AuditLog.filter({ entity_type: 'Application' }, '-created_date', 500),
  ]);

  // Build org map from approved applications
  const orgMap = {}; // orgName -> { orgName, appIds, score breakdown }
  applications.forEach(app => {
    const key = app.organization_name || app.organization_id || 'Unknown';
    if (!orgMap[key]) {
      orgMap[key] = {
        orgName: key,
        appIds: new Set(),
        flagScore: 0,
        reportScore: 0,
        varianceScore: 0,
        auditScore: 0,
        flagCount: 0,
        overdueCount: 0,
        varianceCount: 0,
        auditAnomalies: 0,
      };
    }
    orgMap[key].appIds.add(app.id);

    // Expenditure variance: penalize if rate < 20% or > 95% within period
    const rate = app.expenditure_rate || 0;
    if (rate > 95) {
      orgMap[key].varianceScore += 15;
      orgMap[key].varianceCount++;
    } else if (rate > 80) {
      orgMap[key].varianceScore += 8;
      orgMap[key].varianceCount++;
    }
    // Under-spending (below 20%) only penalized if performance period is > 50% elapsed
    const now = new Date();
    const start = app.performance_start ? new Date(app.performance_start) : null;
    const end = app.performance_end ? new Date(app.performance_end) : null;
    if (start && end && end > now) {
      const totalDays = (end - start) / 86400000;
      const elapsedDays = (now - start) / 86400000;
      const pctElapsed = elapsedDays / totalDays;
      if (pctElapsed > 0.5 && rate < 20) {
        orgMap[key].varianceScore += 10;
        orgMap[key].varianceCount++;
      }
    }
  });

  // Compliance flags
  flags.forEach(flag => {
    const key = flag.organization_name || 'Unknown';
    if (!orgMap[key]) return;
    if (!flag.is_resolved) {
      const weight = SEVERITY_WEIGHT[flag.severity] || 5;
      orgMap[key].flagScore += weight;
      orgMap[key].flagCount++;
    }
  });

  // Overdue reports
  reports.forEach(schedule => {
    if (schedule.status !== 'Overdue') return;
    const key = schedule.organization_name || 'Unknown';
    if (!orgMap[key]) return;
    orgMap[key].reportScore += 8;
    orgMap[key].overdueCount++;
  });

  // Audit anomalies: count denial / revision actions per org
  const appOrgMap = {};
  applications.forEach(a => { appOrgMap[a.id] = a.organization_name || 'Unknown'; });
  auditLogs.forEach(log => {
    const orgName = appOrgMap[log.entity_id];
    if (!orgName || !orgMap[orgName]) return;
    if (log.action === 'Denied' || log.action === 'RevisionRequested') {
      orgMap[orgName].auditScore += 3;
      orgMap[orgName].auditAnomalies++;
    }
  });

  // Compute total score (cap at 100)
  return Object.values(orgMap)
    .map(org => {
      const raw = org.flagScore + org.reportScore + org.varianceScore + org.auditScore;
      const score = Math.min(100, Math.round(raw));
      const level = getRiskLevel(score);
      return {
        orgName: org.orgName,
        score,
        level,
        breakdown: {
          flags: org.flagCount,
          overdueReports: org.overdueCount,
          varianceIssues: org.varianceCount,
          auditAnomalies: org.auditAnomalies,
        },
      };
    })
    .sort((a, b) => b.score - a.score);
}