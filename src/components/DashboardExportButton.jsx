import { useState } from 'react';
import { Download, FileText, FileSpreadsheet, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { base44 } from '@/api/base44Client';
import { jsPDF } from 'jspdf';

function formatCurrency(v) {
  if (!v) return '$0';
  return '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function toCsvRow(fields) {
  return fields.map(f => {
    const s = String(f ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',');
}

function downloadText(filename, content, mime = 'text/csv') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DashboardExportButton({ filteredApps }) {
  const [loading, setLoading] = useState(false);

  const getFundingRequests = async () => {
    const appIds = new Set(filteredApps.map(a => a.id));
    const allFRs = await base44.entities.FundingRequest.list('-created_date', 500);
    return allFRs.filter(r => appIds.has(r.application_id));
  };

  const exportCsv = async () => {
    setLoading(true);
    const frs = await getFundingRequests();

    // Applications sheet
    const appHeaders = ['App #', 'Organization', 'Program', 'NOFO', 'Status', 'Requested', 'Awarded', 'Expended', 'Remaining', 'Expend Rate %', 'Perf Start', 'Perf End'];
    const appRows = filteredApps.map(a => toCsvRow([
      a.application_number, a.organization_name, a.program_code, a.nofo_title,
      a.status, a.requested_amount, a.awarded_amount, a.total_expended,
      a.remaining_balance, a.expenditure_rate, a.performance_start, a.performance_end,
    ]));

    // Funding requests sheet (appended below with separator)
    const frHeaders = ['Request #', 'App #', 'Organization', 'Type', 'Status', 'Period Start', 'Period End', 'Requested', 'Approved'];
    const frRows = frs.map(r => toCsvRow([
      r.request_number, r.application_number, r.organization_name,
      r.request_type, r.status, r.period_start, r.period_end,
      r.amount_requested, r.amount_approved,
    ]));

    const csv = [
      '=== APPLICATIONS ===',
      toCsvRow(appHeaders),
      ...appRows,
      '',
      '=== FUNDING REQUESTS ===',
      toCsvRow(frHeaders),
      ...frRows,
    ].join('\n');

    downloadText(`gmt-export-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    setLoading(false);
  };

  const exportPdf = async () => {
    setLoading(true);
    const frs = await getFundingRequests();
    const doc = new jsPDF({ orientation: 'landscape' });
    const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    // Title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('GMT Portal — Dashboard Export', 14, 16);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${date}  ·  ${filteredApps.length} applications  ·  ${frs.length} funding requests`, 14, 22);

    // Helper: simple table
    const drawTable = (startY, title, headers, rows) => {
      let y = startY;
      // Section title
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(title, 14, y);
      y += 5;

      // Col widths (landscape = 277mm usable)
      const colW = Math.floor(261 / headers.length);

      // Header row
      doc.setFillColor(30, 64, 175);
      doc.rect(14, y, 261, 6, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      headers.forEach((h, i) => doc.text(h, 16 + i * colW, y + 4.2));
      y += 6;

      // Data rows
      doc.setTextColor(30, 30, 30);
      doc.setFont('helvetica', 'normal');
      rows.forEach((row, ri) => {
        if (y > 185) { doc.addPage(); y = 14; }
        if (ri % 2 === 0) {
          doc.setFillColor(245, 247, 250);
          doc.rect(14, y, 261, 5.5, 'F');
        }
        row.forEach((cell, i) => {
          const text = String(cell ?? '').slice(0, 18);
          doc.text(text, 16 + i * colW, y + 3.8);
        });
        y += 5.5;
      });
      return y + 6;
    };

    const appRows = filteredApps.map(a => [
      a.application_number || '—', (a.organization_name || '').slice(0, 18),
      a.program_code || '—', a.status || '—',
      formatCurrency(a.requested_amount), formatCurrency(a.awarded_amount),
      formatCurrency(a.total_expended), `${a.expenditure_rate ?? 0}%`,
    ]);
    const appHeaders = ['App #', 'Organization', 'Program', 'Status', 'Requested', 'Awarded', 'Expended', 'Rate'];

    let nextY = drawTable(30, 'Applications', appHeaders, appRows);

    if (frs.length > 0) {
      if (nextY > 160) { doc.addPage(); nextY = 14; }
      const frRows = frs.map(r => [
        r.request_number || '—', r.application_number || '—',
        (r.organization_name || '').slice(0, 18), r.request_type || '—',
        r.status || '—', r.period_start || '—', r.period_end || '—',
        formatCurrency(r.amount_requested), formatCurrency(r.amount_approved),
      ]);
      drawTable(nextY, 'Funding Requests', ['Req #', 'App #', 'Organization', 'Type', 'Status', 'Period Start', 'Period End', 'Requested', 'Approved'], frRows);
    }

    doc.save(`gmt-export-${new Date().toISOString().slice(0, 10)}.pdf`);
    setLoading(false);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" disabled={loading || filteredApps.length === 0}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportCsv} className="gap-2">
          <FileSpreadsheet className="h-4 w-4 text-green-600" /> Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportPdf} className="gap-2">
          <FileText className="h-4 w-4 text-red-500" /> Export as PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}