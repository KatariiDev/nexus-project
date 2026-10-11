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

/** '2026-10-11T00:00:00' -> '2026-10-11' (dùng cho input type="date") */
export function isoToDateInput(iso?: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

/** '2026-10-11' -> '2026-10-11T00:00:00' */
export function dateInputToISO(v: string): string | undefined {
  return v ? `${v}T00:00:00` : undefined;
}
