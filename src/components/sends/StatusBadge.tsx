import {
  RECIPIENT_STATUS_LABEL,
  SEND_STATUS_LABEL,
  type RecipientStatus,
  type SendStatus,
} from '@/lib/sends';

// Only tones the light theme redefines (globals.css): emerald, amber and red
// 300/400, the neutral scale and "white" washes.
const TONE = {
  good: {
    badge: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
    dot: 'bg-emerald-400 shadow-[0_0_6px] shadow-emerald-400/40',
  },
  busy: {
    badge: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
    dot: 'bg-amber-400 shadow-[0_0_6px] shadow-amber-400/40',
  },
  bad: {
    badge: 'border-red-400/30 bg-red-400/10 text-red-300',
    dot: 'bg-red-400 shadow-[0_0_6px] shadow-red-400/40',
  },
  idle: {
    badge: 'border-white/10 bg-white/5 text-neutral-300',
    dot: 'bg-neutral-500',
  },
} as const;

const SEND_TONE: Readonly<Record<SendStatus, keyof typeof TONE>> = {
  sent: 'good',
  sending: 'busy',
  failed: 'bad',
};

const RECIPIENT_TONE: Readonly<Record<RecipientStatus, keyof typeof TONE>> = {
  sent: 'good',
  processing: 'busy',
  pending: 'idle',
  failed: 'bad',
};

function Badge({ tone, label }: { tone: keyof typeof TONE; label: string }) {
  return (
    <span
      className={`text-2xs inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-medium whitespace-nowrap ${TONE[tone].badge}`}
    >
      <span className={`size-1.5 shrink-0 rounded-full ${TONE[tone].dot}`} aria-hidden />
      {label}
    </span>
  );
}

export function SendStatusBadge({ status }: { status: SendStatus }) {
  return <Badge tone={SEND_TONE[status]} label={SEND_STATUS_LABEL[status]} />;
}

export function RecipientStatusBadge({ status }: { status: RecipientStatus }) {
  return <Badge tone={RECIPIENT_TONE[status]} label={RECIPIENT_STATUS_LABEL[status]} />;
}
