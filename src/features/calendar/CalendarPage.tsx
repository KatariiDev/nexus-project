import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  isValid,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from 'date-fns';
import { vi } from 'date-fns/locale';
import { useApp, useCurrentUser } from '../../store/AppContext';
import { useUI } from '../../components/layout/UIContext';
import { EmptyState, PageHeader } from '../../components/ui/feedback';
import { Tabs } from '../../components/ui/tabs';
import { Button } from '../../components/ui/button';
import { Select } from '../../components/ui/input';
import { Badge, TaskStatusBadge } from '../../components/ui/badge';
import { TASK_STATUSES, priorityLabel } from '../../types';
import type { Priority, Task } from '../../types';
import { cn } from '../../lib/utils';
import { fmtDate } from '../../lib/format';
import { visibleProjects } from '../../lib/roles';

type View = 'month' | 'week' | 'day';
type EventKind = 'due' | 'start';

interface DayEvent {
  task: Task;
  kind: EventKind;
}

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

const priorityChip: Record<Priority, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  high: 'bg-warning/10 text-warning',
  urgent: 'bg-destructive/10 text-destructive',
};

function parseDay(iso?: string | null): Date | null {
  if (!iso) return null;
  const d = startOfDay(new Date(iso));
  return isValid(d) ? d : null;
}

function dayKey(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

function capitalize(s: string): string {
  return s.replace(/^./, (c) => c.toUpperCase());
}

export function CalendarPage() {
  const { state } = useApp();
  const me = useCurrentUser();
  const { openTask, setQuickCreateTab, setQuickCreateOpen } = useUI();
  const [view, setView] = useState<View>('month');
  const [cursor, setCursor] = useState<Date>(() => new Date());
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Member chỉ thấy dự án đã tham gia (Admin thấy tất cả).
  const visibleProjectsList = useMemo(() => visibleProjects(state.projects, me), [state.projects, me]);
  const visibleIds = useMemo(() => new Set(visibleProjectsList.map((p) => p.id)), [visibleProjectsList]);

  const projectById = useMemo(() => new Map(visibleProjectsList.map((p) => [p.id, p])), [visibleProjectsList]);

  const filteredTasks = useMemo(() => {
    return state.tasks.filter((t) => {
      if (!visibleIds.has(t.projectId)) return false;
      if (projectFilter !== 'all' && t.projectId !== projectFilter) return false;
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      return true;
    });
  }, [state.tasks, visibleIds, projectFilter, statusFilter]);

  /* Gom nhiệm vụ theo ngày: dueDate là sự kiện chính, startDate là sự kiện phụ */
  const eventsByDay = useMemo(() => {
    const map = new Map<string, DayEvent[]>();
    const push = (date: Date, task: Task, kind: EventKind) => {
      const k = dayKey(date);
      const list = map.get(k) ?? [];
      list.push({ task, kind });
      map.set(k, list);
    };
    for (const t of filteredTasks) {
      const due = parseDay(t.dueDate);
      if (due) push(due, t, 'due');
      const start = parseDay(t.startDate);
      if (start && (!due || !isSameDay(start, due))) push(start, t, 'start');
    }
    for (const list of map.values()) list.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'due' ? -1 : 1));
    return map;
  }, [filteredTasks]);

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(cursor, { weekStartsOn: 1 });
    const end = endOfWeek(cursor, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const goPrev = () => {
    if (view === 'month') setCursor((c) => subMonths(c, 1));
    else if (view === 'week') setCursor((c) => subWeeks(c, 1));
    else setCursor((c) => subDays(c, 1));
  };
  const goNext = () => {
    if (view === 'month') setCursor((c) => addMonths(c, 1));
    else if (view === 'week') setCursor((c) => addWeeks(c, 1));
    else setCursor((c) => addDays(c, 1));
  };

  const title =
    view === 'month'
      ? capitalize(format(cursor, "MMMM 'năm' yyyy", { locale: vi }))
      : view === 'week'
        ? `Tuần ${format(weekDays[0], 'dd/MM', { locale: vi })} – ${format(weekDays[6], 'dd/MM/yyyy', { locale: vi })}`
        : capitalize(format(cursor, "EEEE, 'ngày' dd 'tháng' MM 'năm' yyyy", { locale: vi }));

  const openQuickCreateForTask = () => {
    setQuickCreateTab('task');
    setQuickCreateOpen(true);
  };

  const renderChip = (ev: DayEvent) => {
    const t = ev.task;
    const p = projectById.get(t.projectId);
    return (
      <button
        key={`${t.id}-${ev.kind}`}
        onClick={(e) => {
          e.stopPropagation();
          openTask(t.id);
        }}
        title={`${t.title}${p ? ` — ${p.name}` : ''}${ev.kind === 'start' ? ' (bắt đầu)' : ''}`}
        className={cn(
          'flex w-full items-center gap-1.5 truncate rounded-md px-1.5 py-1 text-left text-xs font-medium transition-colors hover:brightness-95',
          ev.kind === 'start' ? 'border border-dashed border-input text-muted-foreground' : priorityChip[t.priority],
        )}
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: p?.color ?? '#4F46E5' }} />
        <span className="truncate">
          {ev.kind === 'start' && <span className="mr-1 opacity-70">Bắt đầu:</span>}
          {t.title}
        </span>
      </button>
    );
  };

  const renderDayRows = (days: Date[]) => (
    <div className="flex flex-col gap-4">
      {days.map((day) => {
        const events = eventsByDay.get(dayKey(day)) ?? [];
        const today = isToday(day);
        return (
          <div key={dayKey(day)} className="overflow-hidden rounded-lg border bg-card shadow-soft">
            <div className={cn('flex items-center justify-between border-b px-4 py-2.5', today && 'bg-primary/5')}>
              <div className="flex items-center gap-2">
                <span className={cn('text-sm font-semibold', today ? 'text-primary' : '')}>
                  {capitalize(format(day, "EEEE, 'ngày' dd 'tháng' MM", { locale: vi }))}
                </span>
                {today && <Badge tone="primary">Hôm nay</Badge>}
                <span className="text-xs text-muted-foreground">{events.length} nhiệm vụ</span>
              </div>
              <Button variant="ghost" size="sm" onClick={openQuickCreateForTask} aria-label="Thêm nhiệm vụ">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-col gap-1 p-2">
              {events.length === 0 && <p className="px-2 py-2 text-sm text-muted-foreground">Không có nhiệm vụ.</p>}
              {events.map((ev) => (
                <button
                  key={`${ev.task.id}-${ev.kind}`}
                  onClick={() => openTask(ev.task.id)}
                  className="flex items-center gap-2.5 rounded-md border border-transparent px-2 py-2 text-left transition-colors hover:border-input hover:bg-accent"
                >
                  <span
                    className={cn(
                      'h-2 w-2 shrink-0 rounded-full',
                      ev.kind === 'start' ? 'border border-input bg-transparent' : priorityChip[ev.task.priority].split(' ')[0],
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{ev.task.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {ev.task.code} · {projectById.get(ev.task.projectId)?.name ?? '—'} ·{' '}
                      {ev.kind === 'start' ? 'Ngày bắt đầu' : `Hạn: ${fmtDate(ev.task.dueDate)}`}
                    </span>
                  </span>
                  <TaskStatusBadge status={ev.task.status} />
                  <span className="hidden text-xs text-muted-foreground sm:block">{priorityLabel(ev.task.priority)}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Lịch"
        desc="Theo dõi deadline và lịch trình công việc theo thời gian"
        actions={
          <Button onClick={openQuickCreateForTask}>
            <Plus className="h-4 w-4" />
            Tạo nhiệm vụ
          </Button>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs<View>
          tabs={[
            { value: 'month', label: 'Tháng' },
            { value: 'week', label: 'Tuần' },
            { value: 'day', label: 'Ngày' },
          ]}
          value={view}
          onChange={setView}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="w-44" aria-label="Lọc theo dự án">
            <option value="all">Tất cả dự án</option>
            {visibleProjectsList.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-40" aria-label="Lọc theo trạng thái">
            <option value="all">Tất cả trạng thái</option>
            {TASK_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={goPrev} aria-label="Trước">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCursor(new Date())} className="mx-1">
            Hôm nay
          </Button>
          <Button variant="outline" size="icon" onClick={goNext} aria-label="Sau">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <h2 className="text-center text-base font-semibold sm:text-lg">{title}</h2>
        <div className="hidden w-40 text-right text-xs text-muted-foreground lg:block">Bấm vào ô ngày để tạo nhiệm vụ nhanh</div>
      </div>

      {filteredTasks.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="h-6 w-6" />}
          title="Không có nhiệm vụ nào"
          desc="Không tìm thấy nhiệm vụ nào phù hợp với bộ lọc hiện tại."
          action={
            <Button onClick={openQuickCreateForTask}>
              <Plus className="h-4 w-4" /> Tạo nhiệm vụ
            </Button>
          }
        />
      ) : view === 'month' ? (
        <div className="overflow-hidden rounded-lg border bg-card shadow-soft">
          <div className="grid grid-cols-7 border-b bg-muted/40">
            {WEEKDAYS.map((w) => (
              <div key={w} className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground">
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthDays.map((day) => {
              const events = eventsByDay.get(dayKey(day)) ?? [];
              const inMonth = isSameMonth(day, cursor);
              const today = isToday(day);
              return (
                <div
                  key={day.toISOString()}
                  onClick={openQuickCreateForTask}
                  className={cn(
                    'min-h-[92px] cursor-pointer border-b border-r p-1.5 transition-colors hover:bg-accent/50 sm:min-h-[110px]',
                    !inMonth && 'bg-muted/30',
                  )}
                >
                  <div className="mb-1 flex items-center justify-between px-1">
                    <span
                      className={cn(
                        'flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                        today ? 'bg-primary text-primary-foreground' : inMonth ? 'text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      {format(day, 'd')}
                    </span>
                    {events.length > 3 && <span className="text-[10px] text-muted-foreground">+{events.length - 3}</span>}
                  </div>
                  <div className="flex flex-col gap-1">{events.slice(0, 3).map(renderChip)}</div>
                </div>
              );
            })}
          </div>
        </div>
      ) : view === 'week' ? (
        renderDayRows(weekDays)
      ) : (
        renderDayRows([startOfDay(cursor)])
      )}
    </div>
  );
}
