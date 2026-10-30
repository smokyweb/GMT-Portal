import { useState } from 'react';
import {exportApplicationPdf} from '@/lib/forms/applicationPdf';
import {Button,Dialog,DialogContent,DialogHeader,DialogTitle,DialogFooter,DialogDescription,Checkbox} from '@/components/admin/ui';
import { Download, Loader2, FileText } from 'lucide-react';

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

  const [exportError,setExportError]=useState('');
  const exportPdf=async()=>{setExporting(true);setExportError('');try{await exportApplicationPdf(app,budgets,selected);setOpen(false);}catch(error){setExportError(error.message||'PDF export failed');}finally{setExporting(false);}};

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
<DialogDescription className="text-xs text-muted-foreground mb-3">Select sections to include in the export:</DialogDescription>
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
          {exportError&&<p role="alert" className="text-sm text-red-700">{exportError}</p>}
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