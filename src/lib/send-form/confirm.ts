/**
 * The title of the send form's last dialog (ConfirmSend). A direct send says
 * it goes now, without approval: "Gönderimi onayla" read as "submit for
 * approval" to someone told to send it for approval (27 Ekim 2026).
 */
export type ConfirmKind = "send" | "resendList" | "retryPeople" | "submit";

export function confirmTitle(kind: ConfirmKind, { resubmit = false }: { resubmit?: boolean } = {}): string {
  switch (kind) {
    case "resendList":
      return "Listeye yeniden gönder";
    case "retryPeople":
      return "Kişilere yeniden gönder";
    case "submit":
      return resubmit ? "Yeniden onaya sun" : "Onaya sun";
    case "send":
      return "Şimdi gönder (onaysız)";
  }
}
