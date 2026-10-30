import {Button} from '@/components/admin/ui';
import {Input} from '@/components/admin/ui';
export default function AccountPasswordForm({state}) {
  return <form onSubmit={state.submit} className="space-y-4">
    {state.error&&<p role="alert" className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">{state.error}</p>}
    <div className="space-y-2"><label htmlFor="new-password" className="text-sm font-medium">New password</label>
      <Input id="new-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={state.password} onChange={e=>state.setPassword(e.target.value)}/>
      <p className="text-xs text-muted-foreground">Use at least 12 characters.</p></div>
    <div className="space-y-2"><label htmlFor="confirm-password" className="text-sm font-medium">Confirm password</label>
      <Input id="confirm-password" type="password" autoComplete="new-password" required value={state.confirmation} onChange={e=>state.setConfirmation(e.target.value)}/></div>
    <Button className="w-full" type="submit" disabled={state.busy}>{state.busy?'Saving…':'Set password'}</Button>
  </form>;
}
