function number(value) {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

/** The request-level amount that represents money actually paid. */
export function paidFundingAmount(request) {
  if (request?.payment_status !== 'Paid') return 0;
  return Math.max(0, number(request.amount_paid ?? request.amount_approved ?? request.amount_requested));
}

/** Sum paid requests once per request ID, grouped by application. */
export function paidFundingByApplication(requests = []) {
  const totals = new Map();
  const seen = new Set();
  for (const request of Array.isArray(requests) ? requests : []) {
    if (!request?.id || seen.has(request.id)) continue;
    seen.add(request.id);
    const amount = paidFundingAmount(request);
    if (!amount || !request.application_id) continue;
    totals.set(request.application_id, (totals.get(request.application_id) || 0) + amount);
  }
  return totals;
}

/**
 * Allocate paid federal dollars to budget categories without counting a line
 * more than once. New imports may carry line-level amount_paid; older paid
 * requests often only have a request-level approved/paid amount, so those
 * dollars are allocated by each line's federal amount_requested.
 */
export function paidLineActuals(requests = [], lines = []) {
  const requestsById = new Map((Array.isArray(requests) ? requests : []).filter(item => item?.id).map(item => [item.id, item]));
  const grouped = new Map();
  for (const line of Array.isArray(lines) ? lines : []) {
    if (!line?.id || !line.funding_request_id || !requestsById.has(line.funding_request_id)) continue;
    if (!grouped.has(line.funding_request_id)) grouped.set(line.funding_request_id, []);
    if (!grouped.get(line.funding_request_id).some(item => item.id === line.id)) grouped.get(line.funding_request_id).push(line);
  }

  const actuals = new Map();
  for (const [requestId, requestLines] of grouped) {
    const request = requestsById.get(requestId);
    const requestPaid = paidFundingAmount(request);
    if (!requestPaid) continue;
    const explicit = requestLines.filter(line => line.amount_paid !== null && line.amount_paid !== undefined && line.amount_paid !== '');
    const explicitTotal = explicit.reduce((sum, line) => sum + Math.max(0, number(line.amount_paid)), 0);
    const remaining = explicit.length === requestLines.length ? 0 : Math.max(0, requestPaid - explicitTotal);
    const implicit = requestLines.filter(line => !explicit.includes(line));
    const denominator = implicit.reduce((sum, line) => sum + Math.max(0, number(line.amount_requested ?? line.amount)), 0);

    for (const line of explicit) actuals.set(line.id, Math.max(0, number(line.amount_paid)));
    for (const line of implicit) {
      const federal = Math.max(0, number(line.amount_requested ?? line.amount));
      const share = denominator > 0 ? remaining * federal / denominator : (implicit.length ? remaining / implicit.length : 0);
      actuals.set(line.id, share);
    }
  }
  return actuals;
}
