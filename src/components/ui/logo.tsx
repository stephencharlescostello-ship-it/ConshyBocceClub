/** Simple generic shuffleboard mark (table + weights). Swap for the real club logo: see README → Branding. */
export function ShuffleMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <rect x="6" y="14" width="52" height="36" rx="6" fill="#1f6f4a" stroke="#d4a73a" strokeWidth="3" />
      <line x1="20" y1="14" x2="20" y2="50" stroke="#d4a73a" strokeWidth="2" opacity="0.7" />
      <line x1="34" y1="14" x2="34" y2="50" stroke="#d4a73a" strokeWidth="2" opacity="0.7" />
      <line x1="48" y1="14" x2="48" y2="50" stroke="#d4a73a" strokeWidth="2" opacity="0.7" />
      <circle cx="26" cy="32" r="6" fill="#f4efe3" stroke="#0b1f17" strokeWidth="2" />
      <circle cx="42" cy="26" r="6" fill="#e0a060" stroke="#0b1f17" strokeWidth="2" />
      <circle cx="54" cy="40" r="6" fill="#f4efe3" stroke="#0b1f17" strokeWidth="2" />
    </svg>
  );
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <ShuffleMark size={compact ? 28 : 36} />
      <span className="flex flex-col leading-none">
        <span className="font-display text-base font-extrabold tracking-tight">CBC Shuffle</span>
        {!compact && <span className="text-[11px] uppercase tracking-[0.14em] text-subtle">Conshohocken Bocce Club</span>}
      </span>
    </span>
  );
}
