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
