const recordRows={
  'Federal Grant Title':'{{federal_grant_title}}',
  'Federal Grant Award Number (FAIN) / CFDA Number':'{{federal_award_number}} / {{cfda_number}}',
  'Assistance Listing Title':'{{cfda_title}}','Federal Award Date':'{{federal_award_date}}',
  'Federal Granting Agency':'{{federal_granting_agency}}','Total Federal Award to State':'{{total_federal_award}}',
  'Pass-Through Entity':'{{passthrough_entity}}','Federal Award Description':'{{federal_award_description}}',
  'Cost Share Requirement':'{{cost_share_requirement}}',
};
export function canonicalGanTemplate(source) {
  let body=String(source).replace(/^# Nebraska Emergency Management Agency$/m,'# {{passthrough_entity}}')
    .replace(/^## \d{4} Sub-Recipient Agreement$/m,'## {{grant_year}} Sub-Recipient Agreement')
    .replace(/^\*\*FY \d{4}[^\n]*\*\*$/m,'**{{full_grant_name}}**');
  body=body.split('\n').map(line=>{
    const match=line.match(/^\| ([^|]+) \| (.*?) \|$/);
    return match&&recordRows[match[1]]?'| '+match[1]+' | '+recordRows[match[1]]+' |':line;
  }).join('\n');
  body=body.replace(/^\*\*Indirect Cost Rate:[^\n]+$/m,'**Indirect Cost Rate:** {{indirect_cost_rate}} — **Research & Development (R&D):** {{is_r_and_d}}')
    .replace(/^\*This Grant does not have[^\n]+$/m,'{{indirect_rd_statement}}')
    .replace(/^\*\*6\. Statutory Authority for Grant:\*\*[^\n]*$/m,'**6. Statutory Authority for Grant:** {{statutory_authority}}')
    .replace(/^\*\*7\. Method of Payment:\*\*[^\n]*$/m,'**7. Method of Payment:** {{payment_method}}')
    .replace(/FY ?(?:2023|2025)\b/g,'FY {{grant_year}}');
  const marker='| Approved Budget (POETE) | Federal Share |';
  if(!body.includes(marker))throw new Error('Client GAN budget block is unavailable');
  body=body.replace(marker,'{{project_breakdown}}\n\n'+marker);
  return body;
}
export function hasFixedGanAwardData(body) {
  return /^## \d{4} Sub-Recipient Agreement/m.test(body)||/\b(?:EMK|EMW)-\d{4}-[A-Z0-9]{2,6}-\d{4,8}\b/.test(body)||/^\| Total Federal Award to State \| \$/m.test(body);
}
