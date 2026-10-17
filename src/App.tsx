import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Hexagon } from 'lucide-react';
import { useApp, useCurrentUser } from './store/AppContext';
import { canAccessAdmin } from './lib/roles';
import { AppShell } from './components/layout/AppShell';
import { LoginPage, RegisterPage, ForgotPasswordPage } from './features/auth/AuthPages';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { ProjectsPage, ProjectDetailPage } from './features/projects/ProjectsPage';
import { MyTasksPage, TasksPage } from './features/tasks/TasksPage';
import { CalendarPage } from './features/calendar/CalendarPage';
import { GanttPage } from './features/timeline/GanttPage';
import { TeamPage } from './features/team/TeamPage';
import { DocumentsPage } from './features/documents/DocumentsPage';
import { ReportsPage } from './features/reports/ReportsPage';
import { NotificationsPage } from './features/notifications/NotificationsPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { AdminShell, AdminOverviewPage, ApprovalsPage, AdminLogsPage, RequireAdmin } from './features/admin/AdminPages';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { state } = useApp();
  const location = useLocation();

  if (state.loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Hexagon className="h-8 w-8 animate-pulse" />
        </span>
        <p className="text-sm text-muted-foreground">Đang tải dữ liệu...</p>
      </div>
    );
  }

  if (state.configError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <Hexagon className="h-8 w-8" />
        </span>
        <div>
          <h1 className="text-xl font-bold">Chưa cấu hình Supabase</h1>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Tạo file <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">.env</code> từ{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">.env.example</code> và điền{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">VITE_SUPABASE_URL</code> cùng{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">VITE_SUPABASE_ANON_KEY</code> rồi chạy lại ứng dụng.
          </p>
        </div>
      </div>
    );
  }

  if (!state.authed) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

/** Các đường dẫn cũ (trước khi chuyển sang /user/*) tự chuyển sang vị trí mới. */
const LEGACY_PREFIXES = [
  'projects', 'tasks', 'my-tasks', 'calendar', 'timeline',
  'team', 'documents', 'reports', 'notifications', 'settings',
];

function Fallback() {
  const loc = useLocation();
  const seg = loc.pathname.split('/')[1] ?? '';
  if (LEGACY_PREFIXES.includes(seg)) {
    return <Navigate to={`/user${loc.pathname}${loc.search}`} replace />;
  }
  return <Navigate to="/" replace />;
}

/**
 * Trang đích sau đăng nhập: Admin vào thẳng /admin,
 * các vai trò còn lại vào /user.
 */
function Landing() {
  const { state } = useApp();
  const me = useCurrentUser();

  if (state.loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Hexagon className="h-8 w-8 animate-pulse" />
        </span>
        <p className="text-sm text-muted-foreground">Đang tải dữ liệu...</p>
      </div>
    );
  }
  if (!state.authed) return <Navigate to="/login" replace />;
  return <Navigate to={canAccessAdmin(me.role, me.isSuperAdmin) ? '/admin' : '/user'} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

        {/* Khu vực người dùng */}
        <Route
          path="/user/*"
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:id" element={<ProjectDetailPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="my-tasks" element={<MyTasksPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="timeline" element={<GanttPage />} />
          <Route path="team" element={<TeamPage />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        {/* Khu vực quản trị — chỉ Admin */}
        <Route
          path="/admin/*"
          element={
            <RequireAuth>
              <RequireAdmin>
                <AdminShell />
              </RequireAdmin>
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<AdminOverviewPage />} />
          <Route path="approvals" element={<ApprovalsPage />} />
          <Route path="users" element={<TeamPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="logs" element={<AdminLogsPage />} />
        </Route>

        <Route path="/" element={<Landing />} />
        <Route path="*" element={<Fallback />} />
      </Routes>
    </BrowserRouter>
  );
}
