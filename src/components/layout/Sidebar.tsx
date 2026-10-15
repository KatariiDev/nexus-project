import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Briefcase, KanbanSquare, ListChecks, CalendarDays, Milestone,
  Users, FileText, BarChart3, Bell, Settings, ChevronsLeft, ChevronsRight, Hexagon,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useApp, useCurrentUser } from '../../store/AppContext';
import { Avatar } from '../ui/avatar';

export const NAV_ITEMS = [
  { to: '/', label: 'Tổng quan', icon: LayoutDashboard, end: true },
  { to: '/projects', label: 'Dự án', icon: Briefcase },
  { to: '/tasks', label: 'Nhiệm vụ', icon: KanbanSquare },
  { to: '/my-tasks', label: 'Công việc của tôi', icon: ListChecks },
  { to: '/calendar', label: 'Lịch', icon: CalendarDays },
  { to: '/timeline', label: 'Timeline', icon: Milestone },
  { to: '/team', label: 'Nhóm & Nhân sự', icon: Users },
  { to: '/documents', label: 'Tài liệu', icon: FileText },
  { to: '/reports', label: 'Báo cáo', icon: BarChart3 },
  { to: '/notifications', label: 'Thông báo', icon: Bell },
  { to: '/settings', label: 'Cài đặt', icon: Settings },
];

export function Sidebar() {
  const { state, dispatch } = useApp();
  const user = useCurrentUser();
  const collapsed = state.sidebarCollapsed;
  const unread = state.notifications.filter((n) => n.userId === state.currentUserId && !n.read).length;

  return (
    <aside
      className={cn(
        'flex h-screen shrink-0 flex-col border-r bg-card transition-all duration-200',
        collapsed ? 'w-[72px]' : 'w-60',
      )}
    >
      <div className={cn('flex h-16 items-center gap-2.5 border-b px-4', collapsed && 'justify-center px-0')}>
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Hexagon className="h-5 w-5" />
        </span>
        {!collapsed && (
          <div className="leading-tight">
            <p className="font-bold tracking-tight">Nexus</p>
            <p className="text-xs text-muted-foreground">{state.workspace.name}</p>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto p-3">
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    collapsed && 'justify-center px-0',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )
                }
              >
                <item.icon className="h-[18px] w-[18px] shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
                {!collapsed && item.to === '/notifications' && unread > 0 && (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-semibold text-white">
                    {unread}
                  </span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t p-3">
        <div className={cn('flex items-center gap-3 rounded-md p-2', collapsed && 'justify-center')}>
          <Avatar name={user.name} size="sm" />
          {!collapsed && (
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user.title}</p>
            </div>
          )}
        </div>
        <button
          onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-md py-1.5 text-xs text-muted-foreground hover:bg-accent"
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <><ChevronsLeft className="h-4 w-4" /> Thu gọn</>}
        </button>
      </div>
    </aside>
  );
}
