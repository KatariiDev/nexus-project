import type { Task } from '../../types';

/** Sinh mã nhiệm vụ tiếp theo theo format `${projectCode}-001`, tương thích dữ liệu seed. */
export function nextTaskCode(projectCode: string, tasks: Task[]): string {
  const prefix = `${projectCode}-`;
  let max = 0;
  for (const t of tasks) {
    if (t.code.startsWith(prefix)) {
      const n = parseInt(t.code.slice(prefix.length), 10);
      if (!Number.isNaN(n) && n > max) max = n;
    }
  }
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

/** Mau chu theo han chot cua nhiem vu — dung chung cho the kanban, bang va dong Cong viec cua toi. */
export const dueToneClass: Record<string, string> = {
  overdue: 'text-destructive',
  today: 'text-warning',
  tomorrow: 'text-sky-600 dark:text-sky-400',
  soon: 'text-muted-foreground',
  normal: 'text-muted-foreground',
  done: 'text-success',
};
