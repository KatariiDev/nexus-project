import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Bell, Briefcase, CheckCheck, Clock, MessageSquare, UserPlus, Users } from 'lucide-react';
import { taskById, useApp, useCurrentUser } from '../../store/AppContext';
import { useUI } from '../../components/layout/UIContext';
import { EmptyState, PageHeader } from '../../components/ui/feedback';
import { Tabs } from '../../components/ui/tabs';
import { Button } from '../../components/ui/button';
import { timeAgo } from '../../lib/format';
import { cn } from '../../lib/utils';
import { canAccessAdmin, visibleProjects } from '../../lib/roles';
import { toast } from '../../components/ui/toast';
import type { Notification } from '../../types';

type Tab = 'all' | 'unread';

const kindMeta: Record<Notification['kind'], { icon: React.ReactNode; tone: string; label: string }> = {
  assigned: { icon: <UserPlus className="h-4 w-4" />, tone: 'bg-primary/10 text-primary', label: 'Được giao việc' },
  due_soon: { icon: <Clock className="h-4 w-4" />, tone: 'bg-warning/10 text-warning', label: 'Sắp đến hạn' },
  overdue: { icon: <AlertTriangle className="h-4 w-4" />, tone: 'bg-destructive/10 text-destructive', label: 'Quá hạn' },
  comment: { icon: <MessageSquare className="h-4 w-4" />, tone: 'bg-sky-500/10 text-sky-600 dark:text-sky-400', label: 'Bình luận' },
  project: { icon: <Briefcase className="h-4 w-4" />, tone: 'bg-success/10 text-success', label: 'Dự án' },
  member: { icon: <Users className="h-4 w-4" />, tone: 'bg-purple-500/10 text-purple-600 dark:text-purple-400', label: 'Thành viên' },
  review: { icon: <CheckCheck className="h-4 w-4" />, tone: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', label: 'Chờ duyệt' },
};

export function NotificationsPage() {
  const { state, dispatch } = useApp();
  const { openTask } = useUI();
  const me = useCurrentUser();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('all');

  const mine = useMemo(() => {
    return state.notifications
      .filter((n) => n.userId === state.currentUserId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [state.notifications, state.currentUserId]);

  const unreadCount = mine.filter((n) => !n.read).length;
  const shown = tab === 'all' ? mine : mine.filter((n) => !n.read);

  /** Id các dự án người này được thấy — dùng để kiểm tra nhiệm vụ có mở được không. */
  const visibleProjectIds = useMemo(
    () => new Set(visibleProjects(state.projects, me).map((p) => p.id)),
    [state.projects, me],
  );

  /**
   * Mở thông báo về nhiệm vụ: tới chi tiết dự án của nó (tab Nhiệm vụ)
   * rồi mở drawer chi tiết nhiệm vụ ngay để thấy rõ nhiệm vụ vừa trỏ tới.
   * Nhiệm vụ không tồn tại hoặc nằm ngoài dự án mình được thấy thì báo
   * rõ và ở lại trang Thông báo, không mở drawer trống.
   */
  const openTaskNotification = (taskId: string) => {
    const task = taskById(state.tasks, taskId);
    if (!task || !visibleProjectIds.has(task.projectId)) {
      toast(
        'Không mở được nhiệm vụ này',
        'Nhiệm vụ có thể đã bị xóa hoặc bạn không còn quyền xem.',
        'error',
      );
      return;
    }
    navigate(`/user/projects/${task.projectId}`, { state: { tab: 'tasks' } });
    openTask(task.id);
  };

  const openNotification = (n: Notification) => {
    dispatch({ type: 'NOTIF_READ', id: n.id });
    if (!n.link) return;
    // Link nhiệm vụ: dạng hiện tại `/user/tasks/<id>` và dạng cũ `/tasks/<id>`.
    const taskMatch = n.link.match(/^\/(?:user\/)?tasks\/([^/?#]+)$/);
    if (taskMatch) {
      openTaskNotification(taskMatch[1]);
      return;
    }
    // Link khu vực Admin (vd: thông báo yêu cầu cần phê duyệt): chỉ Admin mở được.
    if (n.link.startsWith('/admin/')) {
      if (canAccessAdmin(me.role, me.isSuperAdmin)) {
        navigate(n.link);
      } else {
        toast(
          'Chỉ Admin mới xem được trang này',
          'Yêu cầu này cần Admin phê duyệt — bạn có thể xem dự án trong danh sách dự án.',
          'info',
        );
        navigate('/user/projects');
      }
      return;
    }
    navigate(n.link);
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Thông báo"
        desc={unreadCount > 0 ? `Bạn có ${unreadCount} thông báo chưa đọc` : 'Tất cả thông báo đã được đọc'}
        actions={
          <Button variant="outline" size="sm" disabled={unreadCount === 0} onClick={() => dispatch({ type: 'NOTIF_READ_ALL' })}>
            <CheckCheck className="h-4 w-4" />
            Đánh dấu đã đọc tất cả
          </Button>
        }
      />

      <Tabs<Tab>
        tabs={[
          { value: 'all', label: `Tất cả (${mine.length})` },
          { value: 'unread', label: `Chưa đọc (${unreadCount})` },
        ]}
        value={tab}
        onChange={setTab}
      />

      {shown.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-6 w-6" />}
          title={tab === 'unread' ? 'Không có thông báo chưa đọc' : 'Chưa có thông báo'}
          desc={tab === 'unread' ? 'Tuyệt vời! Bạn đã đọc hết mọi thông báo.' : 'Các thông báo về nhiệm vụ, deadline và dự án sẽ xuất hiện ở đây.'}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card shadow-soft">
          {shown.map((n) => {
            const meta = kindMeta[n.kind];
            return (
              <button
                key={n.id}
                onClick={() => openNotification(n)}
                className={cn(
                  'flex w-full items-start gap-3 border-b px-4 py-3.5 text-left transition-colors last:border-b-0 hover:bg-accent/60',
                  !n.read && 'bg-primary/[0.04]',
                )}
              >
                <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', meta.tone)} title={meta.label}>
                  {meta.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className={cn('truncate text-sm', !n.read ? 'font-semibold' : 'font-medium')}>{n.title}</span>
                    {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-sky-500" aria-label="Chưa đọc" />}
                  </span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">{n.body}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{timeAgo(n.createdAt)}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
