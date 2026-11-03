import { NavLink, Outlet } from 'react-router-dom';
import {
  ArrowLeft, LayoutDashboard, Settings, ShieldCheck, Users, Briefcase, History,
} from 'lucide-react';
import { useApp, useCurrentUser } from '../../store/AppContext';
import { Avatar } from '../../components/ui/avatar';
import { Button } from '../../components/ui/button';
import { cn } from '../../lib/utils';

const ADMIN_NAV = [
  { to: '/admin/overview', label: 'Tổng quan', icon: LayoutDashboard, end: true },
  { to: '/admin/approvals', label: 'Phê duyệt', icon: ShieldCheck },
  { to: '/admin/users', label: 'Người dùng', icon: Users },
  { to: '/admin/projects', label: 'Dự án', icon: Briefcase },
  { to: '/admin/logs', label: 'Nhật ký', icon: History },
  { to: '/admin/settings', label: 'Cấu hình', icon: Settings },
];

/** Layout riêng cho khu vực /admin/* — chỉ Admin vào được (guard ở router). */
export function AdminShell() {
  const { state } = useApp();
  const me = useCurrentUser();
  const pending = state.projectRequests.filter((r) => r.status === 'pending' && r.type !== 'join_project').length;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Aside trái */}
      <aside className="flex h-screen w-60 shrink-0 flex-col border-r bg-card">
        <div className="flex h-16 items-center gap-2.5 border-b px-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div className="leading-tight">
            <p className="font-bold tracking-tight">Quản trị</p>
            <p className="truncate text-xs text-muted-foreground">{state.workspace.name}</p>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-3">
          <ul className="flex flex-col gap-1">
            {ADMIN_NAV.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )
                  }
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" />
                  <span className="truncate">{item.label}</span>
                  {item.to === '/admin/approvals' && pending > 0 && (
                    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-semibold text-white">
                      {pending}
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="border-t p-3">
          <div className="flex items-center gap-3 rounded-md p-2">
            <Avatar name={me.name} avatarUrl={me.avatarUrl} size="sm" />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-semibold">{me.name}</p>
              <p className="truncate text-xs font-mono text-muted-foreground">
                {me.username}
              </p>
            </div>
          </div>
          <Button variant="outline" className="mt-2 w-full" onClick={() => (window.location.href = '/user')}>
            <ArrowLeft className="h-4 w-4" /> Về trang người dùng
          </Button>
        </div>
      </aside>
      {/* Nội dung */}
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
