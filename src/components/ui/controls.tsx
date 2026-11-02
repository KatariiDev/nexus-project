import { cn } from '../../lib/utils';

export function Switch({ checked, onChange, className }: { checked: boolean; onChange: (v: boolean) => void; className?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors',
        checked ? 'bg-primary' : 'bg-input',
        className,
      )}
    >
      <span
        className={cn(
          'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform mt-0.5',
          checked ? 'translate-x-[22px]' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

export function Checkbox({ checked, onChange, className, disabled, indeterminate }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  className?: string;
  /** Không bấm được (vd. nhiệm vụ đang chờ duyệt). */
  disabled?: boolean;
  /** Trạng thái chờ (vd. nhiệm vụ đang chờ duyệt): hiện dấu trừ màu vàng. */
  indeterminate?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); if (disabled) return; onChange(!checked); }}
      className={cn(
        'flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors',
        indeterminate
          ? 'border-warning bg-warning/15 text-warning'
          : checked
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-muted-foreground/80 bg-card hover:border-primary',
        disabled && 'cursor-not-allowed opacity-70',
        className,
      )}
    >
      {indeterminate ? (
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="M5 12h14" strokeLinecap="round" />
        </svg>
      ) : checked ? (
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
    </button>
  );
}
