import {ganSendTokens} from '@/lib/documents/ganWorkflowPresentation';
export default function GanSendTokenCheck({check}) {
  return <section aria-label="Token check" className="space-y-3"><h4 className="font-semibold">Token check · ready</h4>
    <p className="text-xs text-muted-foreground">Current records match this saved GAN. The server checks them again when you send.</p>
    <dl className="space-y-3">{ganSendTokens(check.values).map(item=><div key={item.key} className="grid grid-cols-2 gap-2 text-xs"><dt className="break-words font-mono text-muted-foreground">{item.key}</dt><dd className="break-words">{String(item.value)} <span className="text-green-700" aria-label="Valid">✓</span></dd></div>)}</dl>
    <div className="space-y-1 border-t pt-3 text-sm"><h4 className="font-semibold">Send to</h4><p>{check.recipient.name}</p><p className="break-all text-xs">{check.recipient.email}</p>
      <p className="pt-2 text-xs text-muted-foreground">Countersign later: {check.approver.name||check.approver.title||'NEMA approving official'}</p></div>
  </section>;
}
