/**
 * A send's controls (hub ticket duyuru-haber 05 G4, 08): pause, resume and
 * cancel, through skymail-backend's POST /mail_tasks/:id/{pause,resume,cancel},
 * and what the send's page and the home screen say about a paused or
 * cancelled send and about the bulk lane's hold.
 *
 * Only a send to many has them: a single mail goes at once. Who sends to
 * everyone (skymail:announcements:send) controls any send; who sends to a list
 * (skymail:mails:write) controls their own, as the backend checks.
 */
import { ROLE, hasRole } from "./access";
import type { ApiClient } from "./api/client";
import { formatClubTime } from "./format";
import { ANNOUNCEMENTS_SEND_ROLE } from "./news-send";
import { formatCount, type Send, type SendSummary } from "./sends";

export type SendControl = "pause" | "resume" | "cancel";

export const CONTROL_LABEL: Readonly<Record<SendControl, string>> = {
  pause: "Duraklat",
  resume: "Sürdür",
  cancel: "İptal et",
};

/** What the viewer may do to a send now, in the order the page shows them. */
export function sendControls(send: Send, viewer: { roles: readonly string[]; sub: string | null | undefined }): SendControl[] {
  if (send.audience.kind === "single" || send.cancelled_at) return [];
  const mayControl = viewer.roles.includes(ANNOUNCEMENTS_SEND_ROLE) || (hasRole(viewer.roles, ROLE.mailsWrite) && !!viewer.sub && send.sent_by === viewer.sub);
  if (!mayControl) return [];
  const unfinished = send.recipient_counts.pending + send.recipient_counts.processing > 0;
  if (send.paused_at) return unfinished ? ["resume", "cancel"] : ["resume"];
  return unfinished ? ["pause", "cancel"] : [];
}

export function controlSend(api: ApiClient, id: string, control: SendControl): Promise<Send> {
  return api.post<Send>(`/mail_tasks/${encodeURIComponent(id)}/${control}`);
}

export type ControlNotice = Readonly<{ tone: "warning" | "danger" | "info"; title: string; text: string }>;

/** What a paused or cancelled send's page says above its recipients; null for any other. */
export function controlNotice(send: Send): ControlNotice | null {
  if (send.cancelled_at) {
    const skipped = send.recipient_counts.cancelled ?? 0;
    return {
      tone: "info",
      title: "İptal edildi",
      text: `${formatClubTime(send.cancelled_at)} tarihinde iptal edildi. ${skipped > 0 ? `Bekleyen ${formatCount(skipped)} alıcı atlandı.` : "Bekleyen alıcı yoktu."}`,
    };
  }
  if (!send.paused_at) return null;
  if (send.paused_reason === "failure_rate") {
    return {
      tone: "danger",
      title: "Kendiliğinden duraklatıldı",
      text: "Alıcıların bir kısmına posta gitmedi ve hata oranı eşiği aştı. Başarısız alıcıların hatalarına bak, sonra sürdür ya da iptal et.",
    };
  }
  return {
    tone: "warning",
    title: "Duraklatıldı",
    text: `${formatClubTime(send.paused_at)} tarihinde duraklatıldı. Bekleyen alıcılara posta gitmiyor; sürdürünce kaldığı yerden devam eder.`,
  };
}

/**
 * When a paused send's pending row is due: skymail-backend parks it at
 * 2999-01-01 until the send is resumed, so it is no time to show.
 */
export function parkedAttempt(nextAttemptAt: string | null): boolean {
  return !!nextAttemptAt && new Date(nextAttemptAt).getUTCFullYear() >= 2999;
}

/** The cancel's question. */
export function cancelConfirmText(send: Send): string {
  const waiting = send.recipient_counts.pending;
  return `Bekleyen ${formatCount(waiting)} alıcıya posta gitmeyecek. Şu an gönderilmekte olanlar tamamlanır. İptal geri alınamaz.`;
}

/** What the home screen says while the relay's throttling holds the bulk lane; null when it does not. */
export function bulkHeldText(summary: SendSummary, now: Date = new Date()): string | null {
  const until = summary.bulk_held_until;
  if (!until || new Date(until).getTime() <= now.getTime()) return null;
  return `Posta sunucusu gönderimi yavaşlattı: listelere ve haberlere giden postalar ${formatClubTime(until)} saatine kadar bekliyor. Giriş kodu gibi tekil postalar gidiyor.`;
}
