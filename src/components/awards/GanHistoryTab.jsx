import {useEffect,useState} from 'react';
import {listAwardNotices} from '@/api/awardNotices';
import {FileText} from 'lucide-react';
const money=value=>value==null?'—':Number(value).toLocaleString(undefined,{style:'currency',currency:'USD'});
const date=value=>value?String(value).slice(0,10):'—';
export default function GanHistoryTab({applicationId}) {
  const [rows,setRows]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
  useEffect(()=>{let active=true;setLoading(true);setError('');listAwardNotices(applicationId).then(value=>{if(active)setRows(value);}).catch(err=>{if(active)setError(err.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[applicationId]);
  if(loading)return <p className="text-sm text-muted-foreground">Loading GAN history…</p>;
  if(error)return <p role="alert" className="text-sm text-destructive">{error}</p>;
  return <section aria-label="GAN History" className="space-y-3">
    <p className="text-xs text-muted-foreground">Issued Grant Award Notices are shown here separately from subrecipient Budget Amendments.</p>
    {rows.length===0?<p className="rounded border border-dashed p-6 text-center text-sm text-muted-foreground">No GAN history recorded.</p>:<div className="overflow-x-auto rounded border"><table className="w-full text-sm"><thead className="bg-muted/50"><tr>{['GAN #','Type','Amount From','Amount To','Change','Period','Status','Completed Date','PDF'].map(label=><th key={label} className="whitespace-nowrap p-3 text-left font-medium text-muted-foreground">{label}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.id} className="border-t"><td className="p-3 font-mono">{row.gan_number}</td><td className="p-3 whitespace-nowrap">{row.gan_type}</td><td className="p-3 whitespace-nowrap">{money(row.amount_from)}</td><td className="p-3 whitespace-nowrap">{money(row.amount_to)}</td><td className={'p-3 whitespace-nowrap '+(Number(row.net_change)<0?'text-red-700':Number(row.net_change)>0?'text-green-700':'')}>{money(row.net_change)}</td><td className="p-3 whitespace-nowrap">{date(row.pop_start)} – {date(row.pop_end)}</td><td className="p-3 whitespace-nowrap">{row.status||'—'}</td><td className="p-3 whitespace-nowrap">{date(row.completed_at)}</td><td className="p-3"><a href={row.pdf_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary underline"><FileText className="h-4 w-4"/>PDF</a></td></tr>)}</tbody></table></div>}
  </section>;
}
