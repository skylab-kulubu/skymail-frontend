import {
  RECIPIENT_STATUS_LABEL,
  SEND_STATUS_LABEL,
  type RecipientStatus,
  type SendStatus,
} from '@/lib/sends';
import { ToneBadge, type Tone } from '@/components/chrome/ToneBadge';

const SEND_TONE: Readonly<Record<SendStatus, Tone>> = {
  sent: 'good',
  sending: 'busy',
  failed: 'bad',
};

const RECIPIENT_TONE: Readonly<Record<RecipientStatus, Tone>> = {
  sent: 'good',
  processing: 'busy',
  pending: 'idle',
  failed: 'bad',
};

export function SendStatusBadge({ status }: { status: SendStatus }) {
  return <ToneBadge tone={SEND_TONE[status]} label={SEND_STATUS_LABEL[status]} />;
}

export function RecipientStatusBadge({ status }: { status: RecipientStatus }) {
  return <ToneBadge tone={RECIPIENT_TONE[status]} label={RECIPIENT_STATUS_LABEL[status]} />;
}
