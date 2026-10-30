export default function GanDraftActions({document,onDownload,onPackage}) {
  return <div className="flex flex-col items-start gap-2">
    <button type="button" onClick={()=>onDownload(document)} className="text-xs font-medium text-blue-700 underline">Download draft PDF · r{document.revision}</button>
    <button type="button" onClick={()=>onPackage(document)} className="text-xs font-medium text-blue-700 underline">Prepare award package</button>
  </div>;
}
