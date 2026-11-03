import { useMemo, useState } from 'react';
import { DndContext, DragOverlay } from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { Plus, Search, SquareKanban, Table as TableIcon } from 'lucide-react';
import { projectById, useApp, useCurrentUser } from '../../store/AppContext';
import { canManageTaskForProject } from '../../lib/roles';
import { useUI } from '../../components/layout/UIContext';
import type { TaskStatus } from '../../types';
import { TASK_STATUSES, taskStatusLabel } from '../../types';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Tabs } from '../../components/ui/tabs';
import { EmptyState } from '../../components/ui/feedback';
import { toast } from '../../components/ui/toast';
import { TaskCardPreview } from './TaskCard';
import { KanbanColumn } from './TaskKanban';
import { TaskTable } from './TaskTable';
import { TaskForm } from './TaskForm';


/**
 * Bảng nhiệm vụ của MỘT dự án (Kanban + Bảng) — dùng trong tab Nhiệm vụ
 * của chi tiết dự án. Tab Nhiệm vụ chính ngoài sidebar đã bỏ.
 */
export function ProjectTaskBoard({ projectId }: { projectId: string }) {
  const { state, dispatch } = useApp();
  const { openTask } = useUI();
  const me = useCurrentUser();
  const [view, setView] = useState<'kanban' | 'table'>('kanban');
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  // Task đang được kéo — dùng để hiển thị bản xem trước trong DragOverlay.
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeTask = activeId ? state.tasks.find((t) => t.id === activeId) : undefined;

  const project = projectById(state.projects, projectId);
  // Chỉ Leader của dự án + Admin được tạo nhiệm vụ; thành viên chỉ xem
  // (ngoại trừ đổi trạng thái nhiệm vụ được giao cho mình).
  const canManage = !!project && canManageTaskForProject(project, me);

  const tasks = useMemo(() => {
    let list = state.tasks.filter((t) => t.projectId === projectId);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((t) => t.title.toLowerCase().includes(q) || t.code.toLowerCase().includes(q));
    return list;
  }, [state.tasks, projectId, search]);

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    const id = String(e.active.id);
    const overStatus = e.over ? String(e.over.id) : null;
    const task = state.tasks.find((t) => t.id === id);
    if (!task || !overStatus || task.status === overStatus) return;
    // Thành viên chỉ được kéo-thả nhiệm vụ được giao cho mình.
    if (!canManage && !task.assigneeIds.includes(me.id)) {
      toast('Không thể di chuyển nhiệm vụ', 'Chỉ Chủ dự án hoặc Admin mới được đổi trạng thái nhiệm vụ của người khác.', 'info');
      return;
    }
    // dispatch là async, trả false khi guard chặn (đồng thời tự hiện toast lỗi)
    // nên chỉ hiện toast thành công khi đổi trạng thái thật sự thành công.
    const ok = await dispatch({ type: 'TASK_MOVE', id, status: overStatus as TaskStatus });
    if (ok) toast('Đã chuyển trạng thái', `${task.code} → ${taskStatusLabel(overStatus as TaskStatus)}`);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tiêu đề hoặc mã..."
            className="w-64 pl-9"
            aria-label="Tìm kiếm nhiệm vụ"
          />
        </div>
        {canManage && (
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" />Tạo nhiệm vụ
          </Button>
        )}
        <Tabs
          value={view}
          onChange={setView}
          className="ml-auto"
          tabs={[
            { value: 'kanban', label: 'Kanban', icon: <SquareKanban className="h-4 w-4" /> },
            { value: 'table', label: 'Bảng', icon: <TableIcon className="h-4 w-4" /> },
          ]}
        />
      </div>

      {view === 'kanban' ? (
        tasks.length === 0 ? (
          <EmptyState
            icon={<SquareKanban className="h-6 w-6" />}
            title="Chưa có nhiệm vụ"
            desc="Tạo nhiệm vụ mới hoặc điều chỉnh từ khóa tìm kiếm."
            action={
              canManage ? (
                <Button onClick={() => setFormOpen(true)}>
                  <Plus className="h-4 w-4" />Tạo nhiệm vụ
                </Button>
              ) : undefined
            }
          />
        ) : (
          <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {TASK_STATUSES.map((s) => (
                <KanbanColumn
                  key={s.value}
                  status={s}
                  tasks={tasks.filter((t) => t.status === s.value)}
                  quickProjectId={canManage ? projectId : undefined}
                  onOpenTask={openTask}
                />
              ))}
            </div>
            {/* Bản xem trước của task đang kéo — render qua portal nên luôn
              nổi lên trên mọi cột, không bị cắt bởi overflow của cột. */}
            <DragOverlay>
              {activeTask ? <TaskCardPreview task={activeTask} /> : null}
            </DragOverlay>
          </DndContext>
        )
      ) : (
        <TaskTable tasks={tasks} onOpenTask={openTask} canManage={canManage} />
      )}

      <TaskForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        defaultProjectId={projectId}
      />
    </div>
  );
}
