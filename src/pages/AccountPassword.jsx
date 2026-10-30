import {Link} from 'react-router-dom';
import {Card,CardContent,CardHeader,CardTitle} from '@/components/admin/ui';
import AccountPasswordForm from '@/components/auth/AccountPasswordForm';
import {useAccountPassword} from '@/hooks/useAccountPassword';
export default function AccountPassword({temporary=false}) {
  const state=useAccountPassword({temporary});
  return <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
    <Card className="w-full max-w-md"><CardHeader className="text-center">
      <CardTitle className="text-2xl">Set your GMT Portal password</CardTitle>
      <p className="text-sm text-muted-foreground mt-1">{temporary?'Change your temporary password before continuing.':'Choose a password to complete your invitation or reset.'}</p>
    </CardHeader><CardContent>
      {state.missingLink?<p role="alert" className="text-sm text-red-700">This link is incomplete. Ask your administrator to resend your invitation or password-reset email.</p>:<AccountPasswordForm state={state}/>}
      <Link className="block text-sm text-primary mt-4 text-center" to="/login">Back to sign in</Link>
    </CardContent></Card>
  </div>;
}
