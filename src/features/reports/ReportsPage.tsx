import { useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { AlertTriangle, CheckCheck, Download, Target, Timer } from 'lucide-react';
import { format, startOfDay } from 'date-fns';
import { useApp, userById, projectById } from '../../store/AppContext';
import { PageHeader, EmptyState } from '../../components/ui/feedback';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Select } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Progress } from '../../components/ui/progress';
import { toast } from '../../components/ui/toast';
import { fmtDate, isOverdue } from '../../lib/format';
import { TASK_STATUSES, PRIORITIES, taskStatusLabel, priorityLabel } from '../../types';
import type { TaskStatus, Priority } from '../../types';

function cssVar(name: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v ? `hsl(${v})` : '#888';
}

/** Đọc màu từ CSS variables để biểu đồ khớp theme sáng/tối hiện tại. */
function readChartColors() {
  return {
    primary: cssVar('--primary'),
    success: cssVar('--success'),
    warning: cssVar('--warning'),
    destructive: cssVar('--destructive'),
    sky: '#0ea5e9',
    card: cssVar('--card'),
    border: cssVar('--border'),
    mutedFg: cssVar('--muted-foreground'),
  };
}
type ChartColors = ReturnType<typeof readChartColors>;

function buildPerDay(tasks: { status: string; completedAt?: string }[], rangeDays: number, todayKey: string): { label: string; count: number }[] {
  const byKey = new Map<string, number>();
  for (const t of tasks) {
    if (t.status === 'done' && t.completedAt) {
      const k = format(new Date(t.completedAt), 'yyyy-MM-dd');
      byKey.set(k, (byKey.get(k) ?? 0) + 1);
    }
  }
  const today = new Date(`${todayKey}T00:00:00`);
  const rows: { label: string; count: number }[] = [];
  for (let i = rangeDays - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    rows.push({ label: format(d, 'dd/MM'), count: byKey.get(format(d, 'yyyy-MM-dd')) ?? 0 });
  }
  return rows;
}

const STATUS_COLOR_KEY: Record<TaskStatus, 'mutedFg' | 'primary' | 'warning' | 'success'> = {
  todo: 'mutedFg',
  in_progress: 'primary',
  in_review: 'warning',
  done: 'success',
};

const PRIORITY_COLOR_KEY: Record<Priority, 'mutedFg' | 'sky' | 'warning' | 'destructive'> = {
  low: 'mutedFg',
  medium: 'sky',
  high: 'warning',
  urgent: 'destructive',
};

function csvEscape(v: string | number | undefined | null): string {
  const s = v === undefined || v === null ? '' : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

export function ReportsPage() {
  const { state } = useApp();
  const [range, setRange] = useState<'7' | '30' | '90'>('30');
  const [projectId, setProjectId] = useState('all');
  const [memberId, setMemberId] = useState('all');

  const rangeDays = Number(range);

  // Màu biểu đồ đọc từ CSS variables; đồng bộ lại khi class `dark` trên <html> thay đổi
  // (AppProvider toggle class trong effect nên phải lắng nghe thay đổi class).
  const [colors, setColors] = useState<ChartColors>(readChartColors);
  useEffect(() => {
    const obs = new MutationObserver(() => setColors(readChartColors()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  const filtered = useMemo(
    () =>
      state.tasks.filter(
        (t) =>
          (projectId === 'all' || t.projectId === projectId) &&
          (memberId === 'all' || t.assigneeIds.includes(memberId)),
      ),
    [state.tasks, projectId, memberId],
  );

  const kpis = useMemo(() => {
    const total = filtered.length;
    const done = filtered.filter((t) => t.status === 'done');
    const overdue = filtered.filter((t) => isOverdue(t.dueDate, t.status));
    const onTime = done.filter(
      (t) => t.completedAt && t.dueDate && startOfDay(new Date(t.completedAt)) <= startOfDay(new Date(t.dueDate)),
    );
    const est = filtered.reduce((s, t) => s + (t.estimateHours ?? 0), 0);
    const act = filtered.reduce((s, t) => s + (t.actualHours ?? 0), 0);
    return {
      total,
      doneCount: done.length,
      rate: total ? Math.round((done.length / total) * 100) : 0,
      overdue: overdue.length,
      onTime: onTime.length,
      est,
      act,
    };
  }, [filtered]);

  const [todayKey] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const perDay = useMemo(() => buildPerDay(filtered, rangeDays, todayKey), [filtered, rangeDays, todayKey]);

  const statusData = useMemo(
    () =>
      TASK_STATUSES.map((s) => ({
        name: s.label,
        value: filtered.filter((t) => t.status === s.value).length,
        color: colors[STATUS_COLOR_KEY[s.value]],
      })).filter((x) => x.value > 0),
    [filtered, colors],
  );

  const priorityData = useMemo(
    () =>
      PRIORITIES.map((p) => ({
        name: p.label,
        value: filtered.filter((t) => t.priority === p.value).length,
        color: colors[PRIORITY_COLOR_KEY[p.value]],
      })).filter((x) => x.value > 0),
    [filtered, colors],
  );

  const openByMember = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of filtered) {
      if (t.status === 'done') continue;
      for (const id of t.assigneeIds) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([id, value]) => ({ name: userById(state.users, id)?.name ?? 'Không rõ', value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [filtered, state.users]);

  const projectRows = useMemo(() => {
    const list = projectId === 'all' ? state.projects : state.projects.filter((p) => p.id === projectId);
    return list.map((p) => {
      const pts = filtered.filter((t) => t.projectId === p.id);
      const done = pts.filter((t) => t.status === 'done').length;
      return { project: p, total: pts.length, done, pct: pts.length ? Math.round((done / pts.length) * 100) : 0 };
    });
  }, [state.projects, projectId, filtered]);

  const tick = { fill: colors.mutedFg, fontSize: 12 };
  const tooltipStyle = {
    backgroundColor: colors.card,
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
    fontSize: 12,
  };

  function handleExport() {
    if (filtered.length === 0) {
      toast('Không có dữ liệu để xuất', 'Hãy điều chỉnh bộ lọc và thử lại.', 'info');
      return;
    }
    const header = ['Mã', 'Tiêu đề', 'Dự án', 'Trạng thái', 'Ưu tiên', 'Người thực hiện', 'Hạn', 'Ngày hoàn thành'];
    const rows = filtered.map((t) => [
      t.code,
      t.title,
      projectById(state.projects, t.projectId)?.name ?? '—',
      taskStatusLabel(t.status),
      priorityLabel(t.priority),
      t.assigneeIds.map((id) => userById(state.users, id)?.name ?? '').filter(Boolean).join(', ') || '—',
      fmtDate(t.dueDate),
      t.completedAt ? fmtDate(t.completedAt) : '—',
    ]);
    const csv = '﻿' + [header, ...rows].map((r) => r.map(csvEscape).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexus-bao-cao-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast('Xuất CSV thành công', `${filtered.length} nhiệm vụ đã được xuất ra file.`);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Báo cáo & Phân tích"
        desc="Số liệu được tính trực tiếp từ dữ liệu dự án và nhiệm vụ hiện tại."
        actions={
          <Button onClick={handleExport} size="sm">
            <Download className="h-4 w-4" />
            Xuất CSV
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <Select value={range} onChange={(e) => setRange(e.target.value as '7' | '30' | '90')} className="w-40" aria-label="Khoảng thời gian">
          <option value="7">7 ngày qua</option>
          <option value="30">30 ngày qua</option>
          <option value="90">90 ngày qua</option>
        </Select>
        <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-56" aria-label="Dự án">
          <option value="all">Tất cả dự án</option>
          {state.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <Select value={memberId} onChange={(e) => setMemberId(e.target.value)} className="w-56" aria-label="Thành viên">
          <option value="all">Tất cả thành viên</option>
          {state.users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Target className="h-6 w-6" />}
          title="Chưa có dữ liệu báo cáo"
          desc="Không có nhiệm vụ nào phù hợp với bộ lọc hiện tại. Hãy điều chỉnh bộ lọc hoặc tạo thêm nhiệm vụ."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Tỷ lệ hoàn thành</p>
                  <Target className="h-5 w-5 text-primary" />
                </div>
                <p className="mt-2 text-3xl font-bold">{kpis.rate}%</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {kpis.doneCount}/{kpis.total} nhiệm vụ
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Nhiệm vụ quá hạn</p>
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <p className="mt-2 text-3xl font-bold text-destructive">{kpis.overdue}</p>
                <p className="mt-1 text-xs text-muted-foreground">cần xử lý ngay</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Hoàn thành đúng hạn</p>
                  <CheckCheck className="h-5 w-5 text-success" />
                </div>
                <p className="mt-2 text-3xl font-bold text-success">{kpis.onTime}</p>
                <p className="mt-1 text-xs text-muted-foreground">nhiệm vụ nộp đúng deadline</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Giờ ước tính / thực tế</p>
                  <Timer className="h-5 w-5 text-warning" />
                </div>
                <p className="mt-2 text-3xl font-bold">
                  {kpis.est}h <span className="text-lg font-medium text-muted-foreground">/ {kpis.act}h</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">tổng giờ của các nhiệm vụ đã lọc</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Nhiệm vụ hoàn thành theo ngày</CardTitle>
                <CardDescription>Trong {rangeDays} ngày qua</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={perDay} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
                    <XAxis dataKey="label" tick={tick} tickLine={false} interval={perDay.length <= 10 ? 0 : Math.ceil(perDay.length / 12) - 1} />
                    <YAxis tick={tick} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="count" name="Hoàn thành" fill={colors.primary} radius={[4, 4, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Phân bổ trạng thái nhiệm vụ</CardTitle>
                <CardDescription>Theo bộ lọc hiện tại</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={statusData} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={2} stroke="transparent">
                      {statusData.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Phân bổ mức độ ưu tiên</CardTitle>
                <CardDescription>Theo bộ lọc hiện tại</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={priorityData} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={2} stroke="transparent">
                      {priorityData.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Nhiệm vụ đang mở theo thành viên</CardTitle>
                <CardDescription>Top 8 thành viên có nhiều việc đang mở nhất</CardDescription>
              </CardHeader>
              <CardContent>
                {openByMember.length === 0 ? (
                  <EmptyState icon={<CheckCheck className="h-6 w-6" />} title="Không còn việc đang mở" desc="Tất cả nhiệm vụ đã hoàn thành." />
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart layout="vertical" data={openByMember} margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={colors.border} horizontal={false} />
                      <XAxis type="number" tick={tick} tickLine={false} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" width={110} tick={{ ...tick, fontSize: 11 }} tickLine={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="value" name="Đang mở" fill={colors.warning} radius={[0, 4, 4, 0]} maxBarSize={22} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Tiến độ từng dự án</CardTitle>
              <CardDescription>Tỷ lệ nhiệm vụ hoàn thành trên tổng số nhiệm vụ của dự án</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {projectRows.map(({ project, total, pct }) => (
                <div key={project.id} className="flex items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">{project.name}</p>
                      <p className="shrink-0 text-sm font-semibold text-muted-foreground">
                        {pct}% <span className="font-normal">({total} nhiệm vụ)</span>
                      </p>
                    </div>
                    <Progress value={pct} className="mt-2" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
