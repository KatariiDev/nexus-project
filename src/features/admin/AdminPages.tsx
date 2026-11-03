import { ShieldCheck, ArrowLeft } from 'lucide-react';
import { useCurrentUser } from '../../store/AppContext';
import { Button } from '../../components/ui/button';
import { canAccessAdmin } from '../../lib/roles';

export { AdminShell } from './AdminShell';
export { AdminOverviewPage } from './AdminOverviewPage';
export { ApprovalsPage } from './ApprovalsPage';
export { AdminLogsPage } from './AdminLogsPage';
export { AdminSettingsPage } from './AdminSettingsPage';

/** Guard dùng trong router: chỉ Admin được vào /admin/*. */
export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const me = useCurrentUser();
  if (!canAccessAdmin(me.role, me.isSuperAdmin)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <ShieldCheck className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-xl font-bold">Không có quyền truy cập</h1>
        <p className="text-sm text-muted-foreground">Khu vực này chỉ dành cho Admin.</p>
        <Button onClick={() => (window.location.href = '/user')}>
          <ArrowLeft className="h-4 w-4" /> Về trang người dùng
        </Button>
      </div>
    );
  }
  return <>{children}</>;
}
