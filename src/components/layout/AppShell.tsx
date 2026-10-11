import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useUI } from './UIContext';
import { SearchOverlay } from './SearchOverlay';
import { QuickCreate } from './QuickCreate';
import { Toaster } from '../ui/toast';
import { TaskDetailDrawer } from '../../features/tasks/TaskDetailDrawer';

export function AppShell() {
  const { setSearchOpen, setQuickCreateOpen, openTaskId, openTask } = useUI();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header onOpenSearch={() => setSearchOpen(true)} onOpenQuickCreate={() => setQuickCreateOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1440px] p-4 sm:p-6">
            <Outlet />
          </div>
        </main>
      </div>
      <SearchOverlay />
      <QuickCreate />
      {openTaskId && <TaskDetailDrawer taskId={openTaskId} onClose={() => openTask(null)} />}
      <Toaster />
      <div className="fixed bottom-3 left-3 z-40 hidden lg:block">
        <span className="rounded-full border bg-card px-3 py-1 text-[11px] text-muted-foreground shadow-soft">
          Chế độ demo — dữ liệu mẫu lưu trên trình duyệt
        </span>
      </div>
    </div>
  );
}
