export default function GanReturnHistoryRow({label,onDownload,disabled}) {
  return <li className="flex flex-wrap items-start justify-between gap-2 border-t py-2 text-xs"><span className="min-w-0 break-words">{label}</span>
    <button type="button" onClick={onDownload} disabled={disabled} className="text-primary underline disabled:opacity-50">Download saved version</button></li>;
}
