import { format, formatDistanceToNow, isPast, isToday, isTomorrow, differenceInCalendarDays, startOfDay } from 'date-fns';
import { vi } from 'date-fns/locale';

export function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  return format(new Date(iso), 'dd/MM/yyyy', { locale: vi });
}

export function fmtDateShort(iso?: string | null): string {
  if (!iso) return '—';
  return format(new Date(iso), 'dd/MM', { locale: vi });
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

export function addDaysISO(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}
