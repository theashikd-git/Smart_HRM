import { cn, initials } from '@/lib/utils';

export function Avatar({
  name,
  size = 'md',
  scanFrame = false,
}: {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  scanFrame?: boolean;
}) {
  const sizes: Record<string, string> = {
    sm: 'h-7 w-7 text-[10px]',
    md: 'h-9 w-9 text-xs',
    lg: 'h-14 w-14 text-base',
  };
  return (
    <div className={cn(scanFrame && 'scan-frame m-1')}>
      <div
        className={cn(
          'flex items-center justify-center rounded-full bg-ink text-white font-semibold tracking-wide',
          sizes[size],
        )}
      >
        {initials(name) || '?'}
      </div>
    </div>
  );
}
