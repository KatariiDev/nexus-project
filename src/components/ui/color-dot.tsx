import { cn } from '../../lib/utils';

/** Chấm màu tròn (nhãn, chú thích biểu đồ...). Mặc định h-2.5 w-2.5, đổi kích cỡ qua `className`. */
export function ColorDot({ color, className, title }: { color?: string | null; className?: string; title?: string }) {
  return (
    <span
      title={title}
      className={cn('h-2.5 w-2.5 shrink-0 rounded-full', className)}
      style={{ backgroundColor: color ?? undefined }}
    />
  );
}

/** Thanh màu dọc đầu dự án (danh sách/bảng/chi tiết). Mặc định h-8 w-1.5, đổi kích cỡ qua `className`. */
export function ProjectColorBar({ color, className }: { color?: string | null; className?: string }) {
  return (
    <span
      className={cn('h-8 w-1.5 shrink-0 rounded-full', className)}
      style={{ backgroundColor: color ?? undefined }}
    />
  );
}
