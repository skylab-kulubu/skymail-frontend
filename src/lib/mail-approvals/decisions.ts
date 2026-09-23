/**
 * A decision on a request (ticket 20), whole in one record: what the
 * confirmation calls it and says will happen, the text it asks for, the
 * API action it posts to (ticket 19), and what the page says once it went
 * through. An approver approves (as it stands, or with an edit), returns an
 * edit or rejects; the submitter accepts or declines a returned edit.
 */

export type Decision = "approve" | "approveEdited" | "return" | "reject" | "accept" | "decline";

export type DecisionWords = Readonly<{
  /** The confirmation's title, and its button. */
  title: string;
  /** The button while the decision is on its way. */
  pending: string;
  /** What the confirmation says will happen. */
  explains: string;
  /** What the page says once it went through. */
  done: string;
  /** The API's action: `POST /mail_approvals/:id/<path>`. */
  path: "approve" | "return" | "reject" | "accept" | "decline";
  /** The text the confirmation asks for — a rejection's reason is required — or none. */
  text: Readonly<{ required: boolean; label: string; placeholder?: string }> | null;
  /** The approver's edit goes with it, shown beside what was submitted. */
  withEdit: boolean;
  /** It refuses rather than sends: its button is the red one. */
  refusal: boolean;
}>;

const NOTE = { required: false, label: "Sunana not (isteğe bağlı)" } as const;

export const DECISIONS: Readonly<Record<Decision, DecisionWords>> = {
  approve: {
    title: "Onayla ve gönder",
    pending: "Gönderiliyor…",
    explains: "Sunulduğu gibi hemen gönderilir; gönderim açıldıktan sonra geri alınamaz. Sunana karar mail olarak bildirilir.",
    done: "Onaylandı: gönderim kuyruğa alındı.",
    path: "approve",
    text: NOTE,
    withEdit: false,
    refusal: false,
  },
  approveEdited: {
    title: "Düzenlemeyle gönder",
    pending: "Gönderiliyor…",
    explains:
      "Düzenlenmiş hâli hemen gönderilir; gönderim açıldıktan sonra geri alınamaz. Neyi değiştirdiğin kayda geçer ve sunana bildirilir.",
    done: "Düzenlemeyle onaylandı: gönderim kuyruğa alındı. Değişiklik kayda geçti ve sunana bildirildi.",
    path: "approve",
    text: NOTE,
    withEdit: true,
    refusal: false,
  },
  return: {
    title: "Sunana geri gönder",
    pending: "Geri gönderiliyor…",
    explains: "Hiçbir şey gönderilmez: istek düzenlemenle sunana döner, kabul ederse gönderilir. Sunanın karar vermek için 7 günü olur.",
    done: "Düzenleme sunana geri gönderildi: kabul ederse gönderilir. Sunanın karar vermek için 7 günü var.",
    path: "return",
    text: NOTE,
    withEdit: true,
    refusal: false,
  },
  reject: {
    title: "Reddet",
    pending: "Reddediliyor…",
    explains: "Hiçbir şey gönderilmez. Sunan gerekçeni görür; isteği düzenleyip yeniden sunabilir.",
    done: "Reddedildi: sunan gerekçeni görecek ve isteği düzenleyip yeniden sunabilir.",
    path: "reject",
    text: { required: true, label: "Ret gerekçesi", placeholder: "Sunan neden reddedildiğini görecek." },
    withEdit: false,
    refusal: true,
  },
  accept: {
    title: "Kabul et ve gönder",
    pending: "Gönderiliyor…",
    explains: "Onaycının düzenlemesiyle hemen gönderilir; gönderim açıldıktan sonra geri alınamaz.",
    done: "Düzenlemeyi kabul ettin: gönderim kuyruğa alındı.",
    path: "accept",
    text: null,
    withEdit: false,
    refusal: false,
  },
  decline: {
    title: "Düzenlemeyi kabul etme",
    pending: "Kaydediliyor…",
    explains: "Hiçbir şey gönderilmez. Sonra isteği kendi değerlerinle düzenleyip yeniden sunabilirsin.",
    done: "Düzenlemeyi kabul etmedin: isteği kendi değerlerinle düzenleyip yeniden sunabilirsin.",
    path: "decline",
    text: { required: false, label: "Neden (isteğe bağlı)" },
    withEdit: false,
    refusal: true,
  },
};

/**
 * What a decision posts: a rejection's reason; the approver's edit, whole,
 * with a note when there is one; else a note, or nothing — an approval
 * without an edit sends the request as it stands.
 */
export function decisionBody(decision: Decision, text: string, edited: Readonly<Record<string, unknown>> | null): unknown {
  if (decision === "reject") return { reason: text };
  const note = text ? { note: text } : {};
  if (DECISIONS[decision].withEdit) return { body_variables: edited, ...note };
  return text ? note : undefined;
}
