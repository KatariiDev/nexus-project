import { useCallback, useMemo, useState } from 'react';
import { BarChart3, CalendarRange } from 'lucide-react';
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  format,
  getDay,
  getDaysInMonth,
  isValid,
  startOfDay,
  startOfMonth,
  subDays,
} from 'date-fns';
import { vi } from 'date-fns/locale';
import { useApp, useCurrentUser } from '../../store/AppContext';
import { useUI } from '../../components/layout/UIContext';
import { EmptyState, PageHeader } from '../../components/ui/feedback';
import { Tabs } from '../../components/ui/tabs';
import { Select } from '../../components/ui/input';
import { isOverdue } from '../../lib/format';
import { visibleProjects, canAccessAdmin } from '../../lib/roles';
import { cn } from '../../lib/utils';

type Scale = 'day' | 'week' | 'month';

const DAY_WIDTH: Record<Scale, number> = { day: 40, week: 14, month: 5 };
const HEADER_H = 40;
const ROW_H = 44;

function parseDay(iso?: string | null): Date | null {
  if (!iso) return null;
  const d = startOfDay(new Date(iso));
  return isValid(d) ? d : null;
}

export function GanttPage() {
  const { state } = useApp();
  const me = useCurrentUser();
  const { openTask } = useUI();
  const [scale, setScale] = useState<Scale>('week');
  const [projectFilter, setProjectFilter] = useState<string>('all');

  const dayWidth = DAY_WIDTH[scale];

  // Member chỉ thấy dự án đã tham gia (Admin thấy tất cả).
  const visibleProjectsList = useMemo(() => visibleProjects(state.projects, me), [state.projects, me]);
  const visibleIds = useMemo(() => new Set(visibleProjectsList.map((p) => p.id)), [visibleProjectsList]);
  const isAdmin = canAccessAdmin(me.role, me.isSuperAdmin);

  /* Số nhiệm vụ trong các dự án mình thấy (chưa lọc ngày) — dùng cho trạng thái trống. */
  const visibleTasksCount = useMemo(
    () => state.tasks.filter((t) => visibleIds.has(t.projectId)).length,
    [state.tasks, visibleIds],
  );

  /* Chỉ lấy task có đủ ngày bắt đầu và hạn, có ngày hợp lệ */
  const ganttTasks = useMemo(() => {
    return state.tasks
      .filter((t) => visibleIds.has(t.projectId))
      .filter((t) => projectFilter === 'all' || t.projectId === projectFilter)
      .map((t) => ({ task: t, start: parseDay(t.startDate), due: parseDay(t.dueDate) }))
      .filter((x): x is { task: (typeof state.tasks)[number]; start: Date; due: Date } => x.start !== null && x.due !== null)
      .sort((a, b) => a.start.getTime() - b.start.getTime() || a.due.getTime() - b.due.getTime());
  }, [state.tasks, visibleIds, projectFilter]);

  const range = useMemo(() => {
    if (ganttTasks.length === 0) return null;
    let min = ganttTasks[0].start;
    let max = ganttTasks[0].due;
    for (const g of ganttTasks) {
      if (g.start < min) min = g.start;
      if (g.due > max) max = g.due;
    }
    const rangeStart = subDays(min, 2);
    const rangeEnd = addDays(max, 2);
    const totalDays = differenceInCalendarDays(rangeEnd, rangeStart) + 1;
    return { rangeStart, rangeEnd, totalDays };
  }, [ganttTasks]);

  const dayIndex = useCallback((d: Date) => (range ? differenceInCalendarDays(d, range.rangeStart) : 0), [range]);

  const marks = useMemo(() => {
    if (!range) return [];
    const out: { left: number; width: number; label: string; sub?: string }[] = [];
    if (scale === 'month') {
      let d = startOfMonth(range.rangeStart);
      while (d <= range.rangeEnd) {
        out.push({ left: dayIndex(d) * dayWidth, width: getDaysInMonth(d) * dayWidth, label: format(d, 'MM/yyyy', { locale: vi }) });
        d = addMonths(d, 1);
      }
    } else {
      for (let i = 0; i < range.totalDays; i++) {
        const d = addDays(range.rangeStart, i);
        if (scale === 'day') {
          out.push({ left: i * dayWidth, width: dayWidth, label: format(d, 'dd'), sub: d.getDate() === 1 ? format(d, 'MM') : undefined });
        } else if (getDay(d) === 1) {
          out.push({ left: i * dayWidth, width: dayWidth * 7, label: format(d, 'dd/MM', { locale: vi }) });
        }
      }
    }
    return out;
  }, [range, scale, dayWidth, dayIndex]);

  const todayX = useMemo(() => {
    if (!range) return null;
    const t = startOfDay(new Date());
    if (t < range.rangeStart || t > range.rangeEnd) return null;
    return dayIndex(t) * dayWidth;
  }, [range, dayWidth, dayIndex]);

  const barOf = useCallback(
    (index: number) => {
      const g = ganttTasks[index];
      const s = dayIndex(g.start);
      const e = dayIndex(g.due);
      return { left: s * dayWidth, width: Math.max(10, (e - s + 1) * dayWidth - 4) };
    },
    [ganttTasks, dayWidth, dayIndex],
  );

  /* Đường nối phụ thuộc: từ bar tiền nhiệm sang bar kế tiếp */
  const depLines = useMemo(() => {
    if (!range) return [];
    const pos = new Map<string, number>();
    ganttTasks.forEach((g, i) => pos.set(g.task.id, i));
    const lines: { x1: number; y1: number; x2: number; y2: number; key: string }[] = [];
    for (const dep of state.dependencies) {
      const from = pos.get(dep.dependsOnId);
      const to = pos.get(dep.taskId);
      if (from === undefined || to === undefined) continue;
      const bFrom = barOf(from);
      const bTo = barOf(to);
      lines.push({
        key: dep.id,
        x1: bFrom.left + bFrom.width,
        y1: HEADER_H + from * ROW_H + ROW_H / 2,
        x2: bTo.left,
        y2: HEADER_H + to * ROW_H + ROW_H / 2,
      });
    }
    return lines;
  }, [range, ganttTasks, state.dependencies, barOf]);

  const timelineWidth = range ? range.totalDays * dayWidth : 0;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Timeline"
        desc="Biểu đồ Gantt: tiến độ nhiệm vụ trên trục thời gian và quan hệ phụ thuộc"
        actions={
          <div className="flex items-center gap-2">
            <Tabs<Scale>
              tabs={[
                { value: 'day', label: 'Ngày' },
                { value: 'week', label: 'Tuần' },
                { value: 'month', label: 'Tháng' },
              ]}
              value={scale}
              onChange={setScale}
            />
            <Select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="w-44" aria-label="Lọc theo dự án">
              <option value="all">{isAdmin ? 'Tất cả dự án' : 'Tất cả dự án đã tham gia'}</option>
              {visibleProjectsList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-card px-4 py-2.5 text-xs text-muted-foreground shadow-soft">
        <span className="font-semibold text-foreground">Chú thích:</span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-6 rounded-full bg-primary" /> Đang thực hiện
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-6 rounded-full bg-success" /> Hoàn thành
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-6 rounded-full bg-destructive" /> Quá hạn
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="28" height="10" viewBox="0 0 28 10" className="text-muted-foreground">
            <path d="M1 5 H24 M20 1 L26 5 L20 9" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
          Phụ thuộc
        </span>
      </div>

      {!range || ganttTasks.length === 0 ? (
        <EmptyState
          icon={visibleTasksCount === 0 ? <CalendarRange className="h-6 w-6" /> : <BarChart3 className="h-6 w-6" />}
          title="Chưa có dữ liệu timeline"
          desc={
            visibleProjectsList.length === 0
              ? 'Bạn chưa tham gia dự án nào.'
              : visibleTasksCount === 0
                ? 'Chưa có nhiệm vụ nào trong các dự án của bạn.'
                : 'Các nhiệm vụ hiện tại chưa có đủ ngày bắt đầu và ngày đến hạn để vẽ biểu đồ.'
          }
        />
      ) : (
        <div className="flex overflow-hidden rounded-lg border bg-card shadow-soft">
          {/* Cột trái: danh sách nhiệm vụ */}
          <div className="w-56 shrink-0 border-r sm:w-72">
            <div className="flex h-10 items-center border-b bg-muted/40 px-4 text-xs font-semibold text-muted-foreground" style={{ height: HEADER_H }}>
              Nhiệm vụ
            </div>
            {ganttTasks.map(({ task }) => (
              <div
                key={task.id}
                className="flex items-center border-b px-4 last:border-b-0"
                style={{ height: ROW_H }}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{task.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{task.code}</p>
                </div>
              </div>
            ))}
          </div>
          {/* Cột phải: timeline */}
          <div className="flex-1 overflow-x-auto">
            <div className="relative" style={{ width: timelineWidth }}>
              {/* Header mốc thời gian */}
              <div className="relative border-b bg-muted/40" style={{ height: HEADER_H }}>
                {marks.map((m, i) => (
                  <div
                    key={i}
                    className="absolute top-0 flex h-full flex-col justify-center border-l border-input/60 px-1"
                    style={{ left: m.left, width: m.width }}
                  >
                    <span className="whitespace-nowrap text-[11px] font-medium text-muted-foreground">{m.label}</span>
                    {m.sub && <span className="text-[10px] text-muted-foreground/70">{m.sub}</span>}
                  </div>
                ))}
                {todayX !== null && (
                  <div className="absolute top-0 bottom-0 w-px bg-destructive" style={{ left: todayX }} title="Hôm nay" />
                )}
              </div>
              {/* Các hàng bar */}
              {ganttTasks.map(({ task }, i) => {
                const b = barOf(i);
                const overdue = isOverdue(task.dueDate, task.status);
                const barTone = task.status === 'done' ? 'bg-success text-success-foreground' : overdue ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground';
                return (
                  <div key={task.id} className="relative border-b last:border-b-0" style={{ height: ROW_H }}>
                    <button
                      onClick={() => openTask(task.id)}
                      title={`${task.title} — ${format(new Date(task.startDate!), 'dd/MM/yyyy')} → ${format(new Date(task.dueDate!), 'dd/MM/yyyy')}`}
                      className={cn('absolute top-1/2 flex -translate-y-1/2 items-center overflow-hidden rounded-full px-2.5 text-[11px] font-medium shadow-soft transition-transform hover:scale-[1.02]', barTone)}
                      style={{ left: b.left, width: b.width, height: 22 }}
                    >
                      <span className="truncate">{task.title}</span>
                    </button>
                  </div>
                );
              })}
              {/* SVG vẽ đường phụ thuộc */}
              <svg
                className="pointer-events-none absolute top-0 left-0 z-[5]"
                width={timelineWidth}
                height={HEADER_H + ganttTasks.length * ROW_H}
              >
                <defs>
                  <marker id="gantt-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                    <path d="M0,0 L8,4 L0,8 Z" fill="hsl(var(--muted-foreground))" />
                  </marker>
                </defs>
                {depLines.map((l) => (
                  <path
                    key={l.key}
                    d={`M ${l.x1} ${l.y1} C ${l.x1 + 24} ${l.y1}, ${l.x2 - 24} ${l.y2}, ${l.x2 - 3} ${l.y2}`}
                    stroke="hsl(var(--muted-foreground))"
                    strokeWidth="1.5"
                    fill="none"
                    markerEnd="url(#gantt-arrow)"
                    opacity="0.8"
                  />
                ))}
              </svg>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
