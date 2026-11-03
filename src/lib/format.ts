import { format, formatDistanceToNow, isPast, isToday, isTomorrow, differenceInCalendarDays, startOfDay } from 'date-fns';
import { vi } from 'date-fns/locale';

export function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  return format(new Date(iso), 'dd/MM/yyyy', { locale: vi });
}

export function fmtDateTime(iso?: string | null): string {
  if (!iso) return '—';
  return format(new Date(iso), 'HH:mm dd/MM/yyyy', { locale: vi });
}

export function timeAgo(iso: string): string {
  return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: vi });
}

export function dueLabel(dueDate?: string | null, status?: string): { text: string; tone: 'overdue' | 'today' | 'tomorrow' | 'soon' | 'normal' | 'done' } {
  if (!dueDate) return { text: 'Chưa có hạn', tone: 'normal' };
  if (status === 'done') return { text: fmtDate(dueDate), tone: 'done' };
  const d = startOfDay(new Date(dueDate));
  const today = startOfDay(new Date());
  const diff = differenceInCalendarDays(d, today);
  if (diff < 0) return { text: `Quá hạn ${Math.abs(diff)} ngày`, tone: 'overdue' };
  if (isToday(new Date(dueDate))) return { text: 'Hôm nay', tone: 'today' };
  if (isTomorrow(new Date(dueDate))) return { text: 'Ngày mai', tone: 'tomorrow' };
  if (diff <= 7) return { text: `Còn ${diff} ngày`, tone: 'soon' };
  return { text: fmtDate(dueDate), tone: 'normal' };
}

export function isOverdue(dueDate?: string | null, status?: string): boolean {
  if (!dueDate || status === 'done') return false;
  return isPast(startOfDay(new Date())) && differenceInCalendarDays(startOfDay(new Date()), startOfDay(new Date(dueDate))) > 0;
}

export function greeting(name: string): string {
  const h = new Date().getHours();
  const part = h < 11 ? 'Chào buổi sáng' : h < 13 ? 'Chào buổi trưa' : h < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
  return `${part}, ${name}`;
}

export function todayLong(): string {
  return format(new Date(), "EEEE, 'ngày' dd 'tháng' MM 'năm' yyyy", { locale: vi });
}

export function toISODate(d: Date): string {
  return format(d, "yyyy-MM-dd'T'HH:mm:ss");
}

/** '2026-10-11T00:00:00' -> '2026-10-11' (dùng cho input type="date"). */
export function isoToDateInput(iso?: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

/** '2026-10-11' -> '2026-10-11T00:00:00' (rỗng -> undefined). */
export function dateInputToISO(v: string): string | undefined {
  return v ? `${v}T00:00:00` : undefined;
}

/** Định dạng kích thước file: 512 -> '512 B', 2048 -> '2 KB', 2.5MB -> '2.5 MB' (rỗng -> '—'). */
export function formatBytes(bytes?: number | null): string {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function addDaysISO(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** Đếm ngược tới một thời điểm hết hạn: "Còn 2 ngày 4 giờ" / "Còn 5 giờ 20 phút" / "Đã hết hạn". */
export function formatCountdown(expiresAt: string, now: Date = new Date()): string {
  const diffMs = new Date(expiresAt).getTime() - now.getTime();
  if (diffMs <= 0) return 'Đã hết hạn';
  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `Còn ${days} ngày${hours > 0 ? ` ${hours} giờ` : ''}`;
  if (hours > 0) return `Còn ${hours} giờ${minutes > 0 ? ` ${minutes} phút` : ''}`;
  return `Còn ${minutes} phút`;
}
