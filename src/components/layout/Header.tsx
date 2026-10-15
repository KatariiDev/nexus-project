import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, Plus, Bell, Sun, Moon, ChevronRight, LogOut, User as UserIcon, Settings as SettingsIcon } from 'lucide-react';
import { useApp, useCurrentUser } from '../../store/AppContext';
import { Avatar } from '../ui/avatar';
import { Button } from '../ui/button';
import { Dropdown, DropdownItem, DropdownSeparator, DropdownLabel } from '../ui/dropdown';
import { fmtDateTime } from '../../lib/format';

const CRUMBS: Record<string, string> = {
  '': 'Tổng quan',
  projects: 'Dự án',
  'my-tasks': 'Công việc của tôi',
  calendar: 'Lịch',
  timeline: 'Timeline',
  team: 'Nhóm & Nhân sự',
  documents: 'Tài liệu',
  reports: 'Báo cáo & Phân tích',
  notifications: 'Thông báo',
  settings: 'Cài đặt',
  tasks: 'Nhiệm vụ',
};

export function Header({ onOpenSearch, onOpenQuickCreate }: { onOpenSearch: () => void; onOpenQuickCreate: () => void }) {
  const { state, dispatch, signOut } = useApp();
  const user = useCurrentUser();
  const location = useLocation();
  const navigate = useNavigate();

  const seg = location.pathname.split('/').filter(Boolean)[0] ?? '';
  const crumb = CRUMBS[seg] ?? 'Nexus';
  const notifs = state.notifications.filter((n) => n.userId === state.currentUserId).slice(0, 6);
  const unread = state.notifications.filter((n) => n.userId === state.currentUserId && !n.read).length;

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b bg-card px-4 sm:px-6">
      <nav className="flex items-center gap-1.5 text-sm">
        <Link to="/" className="text-muted-foreground hover:text-foreground">Nexus</Link>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-semibold">{crumb}</span>
      </nav>

      <div className="flex-1" />

      <button
        onClick={onOpenSearch}
        className="hidden md:flex h-9 w-64 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-muted-foreground hover:bg-accent"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Tìm kiếm...</span>
        <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-semibold">Ctrl K</kbd>
      </button>
      <button
        onClick={onOpenSearch}
        className="md:hidden rounded-md p-2 hover:bg-accent text-muted-foreground"
        aria-label="Tìm kiếm"
      >
        <Search className="h-5 w-5" />
      </button>

      <Button size="sm" onClick={onOpenQuickCreate} className="hidden sm:inline-flex">
        <Plus className="h-4 w-4" /> Tạo mới
      </Button>

      <Dropdown
        trigger={
          <button className="relative rounded-md p-2 hover:bg-accent text-muted-foreground" aria-label="Thông báo">
            <Bell className="h-5 w-5" />
            {unread > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
                {unread}
              </span>
            )}
          </button>
        }
      >
        <DropdownLabel>Thông báo</DropdownLabel>
        {notifs.length === 0 && <p className="px-3 py-4 text-sm text-muted-foreground">Không có thông báo nào.</p>}
        {notifs.map((n) => (
          <button
            key={n.id}
            onClick={() => { dispatch({ type: 'NOTIF_READ', id: n.id }); if (n.link) navigate(n.link); }}
            className="flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left hover:bg-accent"
          >
            {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
            <span className={n.read ? 'ml-4' : ''}>
              <span className="block text-sm font-medium">{n.title}</span>
              <span className="block text-xs text-muted-foreground line-clamp-2">{n.body}</span>
              <span className="block text-[11px] text-muted-foreground mt-0.5">{fmtDateTime(n.createdAt)}</span>
            </span>
          </button>
        ))}
        <DropdownSeparator />
        <DropdownItem label="Xem tất cả thông báo" onClick={() => navigate('/notifications')} />
      </Dropdown>

      <button
        onClick={() => dispatch({ type: 'SET_THEME', theme: state.theme === 'light' ? 'dark' : 'light' })}
        className="rounded-md p-2 hover:bg-accent text-muted-foreground"
        aria-label="Đổi giao diện"
      >
        {state.theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
      </button>

      <Dropdown
        trigger={<button className="rounded-full"><Avatar name={user.name} size="sm" /></button>}
      >
        <div className="px-2.5 py-2">
          <p className="text-sm font-semibold">{user.name}</p>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </div>
        <DropdownSeparator />
        <DropdownItem icon={<UserIcon className="h-4 w-4" />} label="Hồ sơ cá nhân" onClick={() => navigate('/settings')} />
        <DropdownItem icon={<SettingsIcon className="h-4 w-4" />} label="Cài đặt" onClick={() => navigate('/settings')} />
        <DropdownSeparator />
        <DropdownItem
          icon={<LogOut className="h-4 w-4" />}
          label="Đăng xuất"
          danger
          onClick={() => { void signOut(); navigate('/login'); }}
        />
      </Dropdown>
    </header>
  );
}
