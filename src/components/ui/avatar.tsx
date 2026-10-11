import { cn } from '../../lib/utils';
import { initials, avatarColor } from '../../lib/utils';

export function Avatar({ name, size = 'md', className, title }: { name: string; size?: 'xs' | 'sm' | 'md' | 'lg'; className?: string; title?: string }) {
  const sizes = { xs: 'h-6 w-6 text-[10px]', sm: 'h-8 w-8 text-xs', md: 'h-9 w-9 text-xs', lg: 'h-12 w-12 text-sm' };
  return (
    <span
      title={title ?? name}
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white select-none', sizes[size], className)}
      style={{ backgroundColor: avatarColor(name) }}
    >
      {initials(name)}
    </span>
  );
}

export function AvatarStack({ names, max = 4, size = 'sm' }: { names: string[]; max?: number; size?: 'xs' | 'sm' | 'md' }) {
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;
  return (
    <div className="flex -space-x-2">
      {shown.map((n, i) => (
        <Avatar key={i} name={n} size={size} className="ring-2 ring-card" />
      ))}
      {rest > 0 && (
        <span className={cn('inline-flex shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground text-[10px] font-semibold ring-2 ring-card', size === 'xs' ? 'h-6 w-6' : 'h-8 w-8')}>
          +{rest}
        </span>
      )}
    </div>
  );
}
