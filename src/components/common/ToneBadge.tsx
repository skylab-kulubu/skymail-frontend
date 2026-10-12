import { Badge, StatusDot } from '@skylab-kulubu/skylcn-ui';

/** The four states SkyMail shows: sent, on its way, failed, and nothing to say. */
export type Tone = 'good' | 'busy' | 'bad' | 'idle';

/** skylcn-ui's tone for each; the send statuses, the home screen's tiles and the Mail template versions share them. */
export const SKYLCN_TONE = {
  good: 'success',
  busy: 'warning',
  bad: 'danger',
  idle: 'neutral',
} as const satisfies Record<Tone, string>;

/** A figure in a state's colour (the home screen's tiles). */
export const TONE_TEXT: Readonly<Record<Tone, string>> = {
  good: 'text-success',
  busy: 'text-warning',
  bad: 'text-destructive',
  idle: 'text-foreground',
};

/** A status in a few words, with a dot of its tone. */
export function ToneBadge({ tone, label }: { tone: Tone; label: string }) {
  return (
    <Badge tone={SKYLCN_TONE[tone]} size="md" className="gap-1.5 rounded-full">
      <StatusDot tone={SKYLCN_TONE[tone]} />
      {label}
    </Badge>
  );
}
