import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, Loader2, FileText } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { formatCurrency, formatDateShort } from '../lib/helpers';

const SECTIONS = [
  { id: 'details',     label: 'Application Details & Narratives', always: true },
  { id: 'budget',      label: 'Budget Summary' },
  { id: 'expenditures',label: 'Expenditures & Funding Requests' },
  { id: 'rfis',        label: 'RFIs / Action Items' },
  { id: 'documents',   label: 'Attached Documents' },
  { id: 'messages',    label: 'Messages' },
  { id: 'amendments',  label: 'Budget Amendments' },
  { id: 'audit',       label: 'Audit Log' },
];

export default function ApplicationPdfExport({ app, budgets }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState({ details: true, budget: true, expenditures: false, rfis: false, documents: false, messages: false, amendments: false, audit: false });
  const [exporting, setExporting] = useState(false);

  const toggle = (id) => setSelected(s => ({ ...s, [id]: !s[id] }));

  const exportPdf = async () => {
    setExporting(true);

    // Fetch all requested data in parallel
    const [fundingRequests, tasks, documents, messages, amendments, auditLogs] = await Promise.all([
      selected.expenditures ? base44.entities.FundingRequest.filter({ application_id: app.id }, '-created_date', 100) : Promise.resolve([]),
      selected.rfis ? base44.entities.Task.filter({ application_id: app.id }, '-created_date', 100) : Promise.resolve([]),
      selected.documents ? base44.entities.Document.filter({ application_id: app.id }, '-created_date', 100) : Promise.resolve([]),
      selected.messages ? base44.entities.Message.filter({ application_id: app.id }, '-created_date', 100) : Promise.resolve([]),
      selected.amendments ? base44.entities.BudgetAmendment.filter({ application_id: app.id }, '-created_date', 50) : Promise.resolve([]),
      selected.audit ? base44.entities.AuditLog.filter({ entity_id: app.id }, '-created_date', 100) : Promise.resolve([]),
    ]);

    // Fetch line items for funding requests
    let lineItemsByFR = {};
    if (selected.expenditures && fundingRequests.length > 0) {
      const results = await Promise.all(fundingRequests.map(fr =>
        base44.entities.FundingRequestLineItem.filter({ funding_request_id: fr.id })
      ));
      fundingRequests.forEach((fr, i) => { lineItemsByFR[fr.id] = results[i]; });
    }

    // ── Build PDF ──────────────────────────────────────────────────────────
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 18;
    const contentW = pageW - margin * 2;
    let y = 0;

    const checkPage = (needed = 10) => {
      if (y + needed > 275) { doc.addPage(); y = 22; }
    };

    const drawHeader = () => {
      doc.setFillColor(15, 31, 61);
      doc.rect(0, 0, pageW, 26, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('Odysseus GMT Portal', margin, 11);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.text('Grant Application - Official Record', margin, 19);
      doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, pageW - margin, 19, { align: 'right' });
    };

    const sectionTitle = (title) => {
      checkPage(16);
      doc.setFillColor(237, 242, 255);
      doc.rect(margin, y, contentW, 8, 'F');
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(37, 99, 235);
      doc.text(title, margin + 3, y + 5.5);
      doc.setTextColor(30, 30, 30);
      y += 12;
    };

    const kvRow = (label, value, x, colW) => {
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120, 120, 120);
      doc.text(label, x, y);
      doc.setTextColor(30, 30, 30);
      doc.setFont('helvetica', 'bold');
      const lines = doc.splitTextToSize(String(value || ' - '), colW - 4);
      doc.text(lines, x, y + 4.5);
      return lines.length * 4.5 + 6;
    };

    const twoColSection = (pairs) => {
      const half = contentW / 2;
      let maxH = 0;
      pairs.forEach(([label, value], i) => {
        const col = i % 2;
        const x = margin + col * (half + 2);
        if (col === 0 && i > 0) { y += maxH; maxH = 0; checkPage(14); }
        const h = kvRow(label, value, x, half);
        if (h > maxH) maxH = h;
      });
      y += maxH + 4;
    };

    const narrativeBlock = (label, text) => {
      if (!text) return;
      checkPage(16);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(80, 80, 80);
      doc.text(label, margin, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 30, 30);
      const lines = doc.splitTextToSize(text, contentW);
      lines.forEach(line => { checkPage(6); doc.text(line, margin, y); y += 4.8; });
      y += 5;
    };

    const tableHeader = (cols) => {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, contentW, 7, 'F');
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 100, 100);
      let x = margin + 1;
      cols.forEach(({ label, w, align }) => {
        const cx = align === 'right' ? margin + contentW - (w || 0) : x;
        doc.text(label, cx, y + 5, align === 'right' ? { align: 'right' } : {});
        x += w || 30;
      });
      y += 9;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 30, 30);
    };

    const tableRow = (cells, idx) => {
      checkPage(8);
      if (idx % 2 === 0) { doc.setFillColor(252, 253, 255); doc.rect(margin, y - 1, contentW, 7, 'F'); }
      doc.setFontSize(7.5);
      let x = margin + 1;
      cells.forEach(({ text, w, align }) => {
        const t = String(text || ' - ');
        const cx = align === 'right' ? margin + contentW - (w || 0) : x;
        doc.text(t, cx, y + 4, align === 'right' ? { align: 'right' } : {});
        x += w || 30;
      });
      doc.setDrawColor(235, 238, 245);
      doc.line(margin, y + 6, pageW - margin, y + 6);
      y += 7;
    };

    // ── DRAW ──────────────────────────────────────────────────────────────
    drawHeader();
    y = 34;
    doc.setTextColor(30, 30, 30);

    // App title
    doc.setFontSize(17);
    doc.setFont('helvetica', 'bold');
    doc.text(app.application_number || 'DRAFT', margin, y);
    y += 6;
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`${app.project_title || 'Untitled'}  |  Status: ${app.status || ' - '}  |  Program: ${app.program_code || ' - '}`, margin, y);
    y += 6;
    doc.setDrawColor(220, 225, 235);
    doc.setLineWidth(0.4);
    doc.line(margin, y, pageW - margin, y);
    y += 8;

    // ── APPLICATION DETAILS ──
    sectionTitle('Organization & Submission');
    twoColSection([
      ['Organization', app.organization_name],
      ['Submitted By', app.submitted_by],
      ['Submission Date', formatDateShort(app.submitted_at)],
      ['Version', app.version || 1],
      ['NOFO', app.nofo_title],
      ['Grant Number', app.grant_number],
    ]);

    sectionTitle('Project & Financial Details');
    twoColSection([
      ['Requested Amount', formatCurrency(app.requested_amount)],
      ['Awarded Amount', app.awarded_amount ? formatCurrency(app.awarded_amount) : 'Pending'],
      ['Match / Cost-Share', formatCurrency(app.match_amount)],
      ['Total Expended', app.total_expended ? formatCurrency(app.total_expended) : ' - '],
      ['Performance Start', formatDateShort(app.performance_start)],
      ['Performance End', formatDateShort(app.performance_end)],
    ]);

    narrativeBlock('Project Narrative', app.project_narrative);
    narrativeBlock('Work Plan', app.work_plan);
    narrativeBlock('Risk Assessment', app.risk_assessment);
    if (app.revision_notes) narrativeBlock('Revision Notes from Reviewer', app.revision_notes);

    // ── BUDGET ──
    if (selected.budget && budgets && budgets.length > 0) {
      sectionTitle('Budget Summary');
      const bc = { cat: 0, desc: 38, req: contentW - 42, match: contentW - 18 };
      tableHeader([
        { label: 'Category', w: 38 },
        { label: 'Description', w: contentW - 38 - 42 },
        { label: 'Requested', w: 42, align: 'right' },
        { label: 'Match', w: 20, align: 'right' },
      ]);
      let totalReq = 0, totalMatch = 0;
      budgets.forEach((b, idx) => {
        checkPage(8);
        if (idx % 2 === 0) { doc.setFillColor(252, 253, 255); doc.rect(margin, y - 1, contentW, 7, 'F'); }
        doc.setFontSize(7.5);
        doc.text(b.budget_category || '', margin + 1, y + 4);
        const descW = contentW - 38 - 42 - 4;
        const desc = doc.splitTextToSize(b.line_description || '', descW);
        doc.text(desc[0] || '', margin + 38, y + 4);
        doc.text(formatCurrency(b.amount_requested), pageW - margin, y + 4, { align: 'right' });
        doc.text(formatCurrency(b.amount_match), pageW - margin - 22, y + 4, { align: 'right' });
        totalReq += b.amount_requested || 0;
        totalMatch += b.amount_match || 0;
        doc.setDrawColor(235, 238, 245);
        doc.line(margin, y + 6, pageW - margin, y + 6);
        y += 7;
      });
      checkPage(10);
      doc.setFillColor(15, 31, 61);
      doc.rect(margin, y, contentW, 8, 'F');
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('TOTAL', margin + 2, y + 5.5);
      doc.text(formatCurrency(totalReq), pageW - margin, y + 5.5, { align: 'right' });
      doc.text(formatCurrency(totalMatch), pageW - margin - 22, y + 5.5, { align: 'right' });
      doc.setTextColor(30, 30, 30);
      y += 14;
    }

    // ── EXPENDITURES ──
    if (selected.expenditures && fundingRequests.length > 0) {
      sectionTitle('Expenditures & Funding Requests');
      fundingRequests.forEach((fr, fi) => {
        checkPage(20);
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 30, 30);
        doc.text(`${fr.request_number || `FR-${fi + 1}`} - ${fr.request_type}  |  ${formatCurrency(fr.amount_requested)}  |  Status: ${fr.status}`, margin, y);
        y += 5;
        if (fr.amount_approved != null) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(80, 80, 80);
          doc.text(`Approved: ${formatCurrency(fr.amount_approved)}${fr.payment_status ? `  |  Payment: ${fr.payment_status}` : ''}${fr.payment_reference ? `  |  Ref: ${fr.payment_reference}` : ''}`, margin, y);
          y += 4.5;
        }
        if (fr.reviewer_notes) {
          doc.setFontSize(7.5);
          doc.setTextColor(160, 100, 0);
          const notes = doc.splitTextToSize(`Notes: ${fr.reviewer_notes}`, contentW);
          notes.forEach(l => { checkPage(5); doc.text(l, margin, y); y += 4; });
        }
        y += 2;

        const items = lineItemsByFR[fr.id] || [];
        if (items.length > 0) {
          tableHeader([
            { label: 'Category', w: 30 },
            { label: 'Item / Description', w: 60 },
            { label: 'Qty', w: 12, align: 'right' },
            { label: 'Unit Cost', w: 22, align: 'right' },
            { label: 'Amount', w: 22, align: 'right' },
          ]);
          items.forEach((li, idx) => {
            checkPage(8);
            if (idx % 2 === 0) { doc.setFillColor(252, 253, 255); doc.rect(margin, y - 1, contentW, 7, 'F'); }
            doc.setFontSize(7.5);
            doc.setTextColor(30, 30, 30);
            doc.text(li.budget_category || '', margin + 1, y + 4);
            const itemLabel = [li.expenditure_name, li.description].filter(Boolean).join(' - ');
            const itemLines = doc.splitTextToSize(itemLabel || ' - ', 56);
            doc.text(itemLines[0] || '', margin + 31, y + 4);
            doc.text(String(li.quantity || ' - '), pageW - margin - 44, y + 4, { align: 'right' });
            doc.text(li.unit_cost ? formatCurrency(li.unit_cost) : ' - ', pageW - margin - 22, y + 4, { align: 'right' });
            doc.text(formatCurrency(li.amount), pageW - margin, y + 4, { align: 'right' });
            doc.setDrawColor(235, 238, 245);
            doc.line(margin, y + 6, pageW - margin, y + 6);
            y += 7;
          });
          const frTotal = items.reduce((s, l) => s + (Number(l.amount) || 0), 0);
          doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 30);
          doc.text(`Request Total: ${formatCurrency(frTotal)}`, pageW - margin, y + 4, { align: 'right' });
          y += 10;
        }
        y += 3;
      });
    }

    // ── RFIs ──
    if (selected.rfis && tasks.length > 0) {
      sectionTitle('RFIs & Action Items');
      tableHeader([
        { label: 'Title', w: 70 },
        { label: 'Type', w: 20 },
        { label: 'Priority', w: 20 },
        { label: 'Status', w: 25 },
        { label: 'Due', w: 20, align: 'right' },
      ]);
      tasks.forEach((t, idx) => {
        tableRow([
          { text: t.title, w: 70 },
          { text: t.type, w: 20 },
          { text: t.priority, w: 20 },
          { text: t.status, w: 25 },
          { text: formatDateShort(t.due_date), w: 20, align: 'right' },
        ], idx);
        if (t.description) {
          doc.setFontSize(7); doc.setTextColor(100, 100, 100);
          const lines = doc.splitTextToSize(t.description, contentW - 4);
          lines.slice(0, 2).forEach(l => { checkPage(5); doc.text(l, margin + 2, y); y += 4; });
        }
      });
      y += 4;
    }

    // ── DOCUMENTS ──
    if (selected.documents && documents.length > 0) {
      sectionTitle('Attached Documents');
      tableHeader([
        { label: 'File Name', w: 70 },
        { label: 'Type', w: 35 },
        { label: 'Review Status', w: 30 },
        { label: 'Uploaded', w: 30, align: 'right' },
      ]);
      documents.forEach((d, idx) => {
        tableRow([
          { text: d.name, w: 70 },
          { text: d.doc_type, w: 35 },
          { text: d.review_status || 'Pending', w: 30 },
          { text: formatDateShort(d.uploaded_at || d.created_date), w: 30, align: 'right' },
        ], idx);
      });
      y += 4;
    }

    // ── MESSAGES ──
    if (selected.messages && messages.length > 0) {
      sectionTitle('Messages');
      messages.slice(0, 50).forEach((m, idx) => {
        checkPage(14);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(60, 60, 60);
        doc.text(`${m.sender_email || m.created_by || ' - '} - ${formatDateShort(m.created_date)}${m.topic ? `  [${m.topic}]` : ''}`, margin, y);
        y += 4.5;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(30, 30, 30);
        const lines = doc.splitTextToSize(m.content || '', contentW);
        lines.slice(0, 6).forEach(l => { checkPage(5); doc.text(l, margin, y); y += 4; });
        doc.setDrawColor(235, 238, 245);
        doc.line(margin, y + 1, pageW - margin, y + 1);
        y += 5;
      });
    }

    // ── AMENDMENTS ──
    if (selected.amendments && amendments.length > 0) {
      sectionTitle('Budget Amendments');
      tableHeader([
        { label: 'Amendment #', w: 35 },
        { label: 'Status', w: 30 },
        { label: 'Net Change', w: 30, align: 'right' },
        { label: 'Submitted', w: 30, align: 'right' },
      ]);
      amendments.forEach((a, idx) => {
        tableRow([
          { text: a.amendment_number || `AMD-${idx + 1}`, w: 35 },
          { text: a.status, w: 30 },
          { text: a.net_change != null ? formatCurrency(a.net_change) : ' - ', w: 30, align: 'right' },
          { text: formatDateShort(a.submitted_at), w: 30, align: 'right' },
        ], idx);
        if (a.justification) {
          doc.setFontSize(7); doc.setTextColor(100, 100, 100);
          const lines = doc.splitTextToSize(a.justification, contentW - 4);
          lines.slice(0, 2).forEach(l => { checkPage(5); doc.text(l, margin + 2, y); y += 4; });
        }
      });
      y += 4;
    }

    // ── AUDIT LOG ──
    if (selected.audit && auditLogs.length > 0) {
      sectionTitle('Audit Log');
      tableHeader([
        { label: 'Action', w: 35 },
        { label: 'User', w: 50 },
        { label: 'Details', w: 60 },
        { label: 'Date', w: 25, align: 'right' },
      ]);
      auditLogs.forEach((log, idx) => {
        checkPage(8);
        if (idx % 2 === 0) { doc.setFillColor(252, 253, 255); doc.rect(margin, y - 1, contentW, 7, 'F'); }
        doc.setFontSize(7.5); doc.setTextColor(30, 30, 30);
        doc.text(log.action || ' - ', margin + 1, y + 4);
        doc.text(log.performed_by || log.created_by || ' - ', margin + 36, y + 4);
        const detail = doc.splitTextToSize(log.details || ' - ', 58);
        doc.text(detail[0] || '', margin + 87, y + 4);
        doc.text(formatDateShort(log.created_date), pageW - margin, y + 4, { align: 'right' });
        doc.setDrawColor(235, 238, 245);
        doc.line(margin, y + 6, pageW - margin, y + 6);
        y += 7;
      });
    }

    // ── FOOTERS ──
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(160, 160, 160);
      doc.text(`Page ${i} of ${pageCount}  |  Odysseus GMT Portal  |  Confidential`, pageW / 2, 291, { align: 'center' });
    }

    doc.save(`${app.application_number || 'application'}_export.pdf`);
    setExporting(false);
    setOpen(false);
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <Download className="h-3.5 w-3.5" />
        Export PDF
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" /> Export Application PDF
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-1 py-1">
            <p className="text-xs text-muted-foreground mb-3">Select sections to include in the export:</p>
            {SECTIONS.map(s => (
              <label key={s.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition ${s.always ? 'opacity-60' : 'hover:bg-muted/40'}`}>
                <Checkbox
                  checked={selected[s.id]}
                  disabled={s.always}
                  onCheckedChange={() => !s.always && toggle(s.id)}
                />
                <span className="text-sm">{s.label}</span>
                {s.always && <span className="text-xs text-muted-foreground ml-auto">Always included</span>}
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={exportPdf} disabled={exporting}>
              {exporting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating…</> : <><Download className="h-4 w-4 mr-2" /> Export PDF</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}