import { User2 } from 'lucide-react';

const SIZES = {
  sm: { box: 'h-7 w-7 text-3xs', icon: 12 },
  md: { box: 'h-9 w-9 text-xs', icon: 16 },
  lg: { box: 'h-11 w-11 text-sm', icon: 20 },
} as const;

function getInitials(name: string, email: string) {
  const source = (name || email || '').trim();
  if (!source) return '';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toLocaleUpperCase('tr-TR');
  return (parts[0][0] + parts[1][0]).toLocaleUpperCase('tr-TR');
}

type AvatarProps = {
  name?: string;
  email?: string;
  size?: keyof typeof SIZES;
  className?: string;
};

export function Avatar({ name = '', email = '', size = 'md', className = '' }: AvatarProps) {
  const s = SIZES[size];
  const initials = getInitials(name, email);
  return (
    <div
      className={`${s.box} grid shrink-0 place-items-center overflow-hidden rounded-lg border border-white/10 bg-neutral-900/60 font-semibold text-neutral-300 ${className}`}
    >
      {initials ? <span>{initials}</span> : <User2 size={s.icon} className="text-neutral-500" />}
    </div>
  );
}
