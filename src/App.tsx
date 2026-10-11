import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useApp } from './store/AppContext';
import { AppShell } from './components/layout/AppShell';
import { LoginPage, RegisterPage, ForgotPasswordPage } from './features/auth/AuthPages';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { ProjectsPage, ProjectDetailPage } from './features/projects/ProjectsPage';
import { MyTasksPage } from './features/tasks/TasksPage';
import { CalendarPage } from './features/calendar/CalendarPage';
import { GanttPage } from './features/timeline/GanttPage';
import { TeamPage } from './features/team/TeamPage';
import { DocumentsPage } from './features/documents/DocumentsPage';
import { ReportsPage } from './features/reports/ReportsPage';
import { NotificationsPage } from './features/notifications/NotificationsPage';
import { SettingsPage } from './features/settings/SettingsPage';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { state } = useApp();
  const location = useLocation();
  if (!state.authed) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:id" element={<ProjectDetailPage />} />
          <Route path="my-tasks" element={<MyTasksPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="timeline" element={<GanttPage />} />
          <Route path="team" element={<TeamPage />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
