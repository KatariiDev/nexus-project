import { useState } from 'react';
import { cn } from '../../lib/utils';
import { initials, avatarColor } from '../../lib/utils';

export function Avatar({
  name,
  avatarUrl,
  size = 'md',
  className,
  title,
}: {
  name: string;
  avatarUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  title?: string;
}) {
  const [imageError, setImageError] = useState(false);
  const sizes = { xs: 'h-6 w-6 text-[10px]', sm: 'h-8 w-8 text-xs', md: 'h-9 w-9 text-xs', lg: 'h-12 w-12 text-sm' };

  if (avatarUrl && !imageError) {
    return (
      <span
        title={title ?? name}
        className={cn('inline-flex shrink-0 items-center justify-center rounded-full overflow-hidden select-none bg-muted', sizes[size], className)}
      >
        <img
          src={avatarUrl}
          alt={name}
          className="h-full w-full object-cover"
          onError={() => setImageError(true)}
        />
      </span>
    );
  }

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

export function AvatarStack({
  names,
  users,
  max = 4,
  size = 'sm',
}: {
  names?: string[];
  users?: Array<{ name: string; avatarUrl?: string | null }>;
  max?: number;
  size?: 'xs' | 'sm' | 'md';
}) {
  const items = users ?? (names ?? []).map((n) => ({ name: n, avatarUrl: undefined }));
  const shown = items.slice(0, max);
  const rest = items.length - shown.length;
  return (
    <div className="flex -space-x-2">
      {shown.map((u, i) => (
        <Avatar key={i} name={u.name} avatarUrl={u.avatarUrl} size={size} className="ring-2 ring-card" />
      ))}
      {rest > 0 && (
        <span className={cn('inline-flex shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground text-[10px] font-semibold ring-2 ring-card', size === 'xs' ? 'h-6 w-6' : 'h-8 w-8')}>
          +{rest}
        </span>
      )}
    </div>
  );
}
