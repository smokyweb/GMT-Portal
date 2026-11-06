export { paidFundingByApplication as buildPaidByApplication } from './fundingMetrics.js';

export function utilization(expended, awarded) {
  const spent = Number(expended);
  const total = Number(awarded);
  if (!Number.isFinite(spent) || !Number.isFinite(total) || total <= 0) return 0;
  return (spent / total) * 100;
}
