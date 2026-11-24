import * as React from "react";
import { Context, Paragraph, RowItem, Rows, RowsEnd, Shell, Title } from "./theme";
import { elseBranch, end, ifSet, joinTitles, v } from "./go";
import type { TemplateMeta } from "./types";

/** `'A', 'B'`: each session's title in quotes, joined. */
const quoted = (name: string) => `{{range $i, $s := .${name}}}{{if $i}}, {{end}}'{{$s.Title}}'{{end}}`;

/** One session or several: the one condition the wording turns on. */
const ifOne = (name: string) => `{{if eq (len .${name}) 1}}`;

export const meta: TemplateMeta = {
  key: "event.attendance-recorded",
  name: "Etkinlik · Kapı: Katılım Alındı",
  subject: `${v("EventName")}: katılımın alındı`,
  system: false,
  contentSensitive: false,
  brand: "skylab",
  trigger:
    "core-backend, her oturum Check-in'inde (görevli okutması, yoklama QR'ı, kendi e-postası, masa), yazıldıktan 2 dakika sonra, dakikada en çok ATTENDANCE_MAIL_PER_MINUTE posta (ATTENDANCE_MAIL=on, SKYMAIL_ATTENDANCE_RECORDED_TEMPLATE_KEY, etkinliğin attendanceRecordedMail anahtarı; docs/attendance-mail.md). İşlem postası, kişi kapatamaz. Aynı biletin bekleyen yoklamaları tek postada (Sessions); hoş geldin ya da gün sonu özetiyle birleşen yoklama ayrıca gitmez. Check-in geri alınırsa gitmez. Sayılar gönderim anında sertifika kuralından; kural yoksa HasRule false, sayılar 0, listeler boş. Üyeye bildirim olarak (POST /v1/notifications: kutu + e-posta), misafire yalnız bu e-posta (POST /v1/mail_tasks/single).",
  // core-backend kapi-postalari 05 (SPEC §5.2): Sessions, MissingRequired,
  // MissedRequired, NotCounted are [{Title}].
  variables: [
    "FirstName",
    "EventName",
    "EventId",
    "OwnerTeam",
    "Sessions",
    "HasRule",
    "Attended",
    "CountedTotal",
    "MinRequired",
    "MissingRequired",
    "MissedRequired",
    "NotCounted",
  ],
  notification: {
    category: null,
    required: true,
    defaultChannels: ["email", "inbox"],
    lane: "system",
    inbox: {
      title: `${v("EventName")}: katılımın alındı`,
      summary: joinTitles("Sessions"),
      link: `/events/${v("EventId")}`,
    },
  },
  sample: {
    FirstName: "Elif",
    EventName: "GECEKODU 2026",
    EventId: "6f1c2b9e-4d3a-4b7e-9a51-0c8d2e7f4a19",
    OwnerTeam: "WEBLAB",
    Sessions: [{ Title: "Veritabanı tasarımı" }],
    HasRule: true,
    Attended: 5,
    CountedTotal: 16,
    MinRequired: 12,
    MissingRequired: [{ Title: "Final" }],
    MissedRequired: [],
    NotCounted: [],
  },
};

/** Yusuf, 2026-11-24 (kapi-postalari K5): one sentence, the count, what is still required. */
export default function EventAttendanceRecorded() {
  return (
    <Shell preview={`${v("EventName")}: katılımın alındı.`} brand="skylab" reason={null}>
      <Context tone="ok">{v("EventName")}</Context>
      <Title>Katılımın Alındı</Title>

      <Paragraph>
        {ifSet("FirstName")}Merhaba {v("FirstName")}, {end}
        {quoted("Sessions")} {ifOne("Sessions")}oturumuna{elseBranch}oturumlarına{end} katılımın alındı.
        {ifSet("HasRule")} {v("CountedTotal")} oturumdan {v("Attended")} tanesine katıldın; sertifika için {v("MinRequired")} gerekiyor.{end}
      </Paragraph>

      {ifSet("HasRule")}
      {ifSet("MissingRequired")}
      <Paragraph>Zorunlu oturumlardan henüz katılmadıkların: {joinTitles("MissingRequired")}.</Paragraph>
      {end}
      {ifSet("MissedRequired")}
      <Paragraph>Kaçırdığın zorunlu oturumlar: {joinTitles("MissedRequired")}.</Paragraph>
      {end}
      {ifSet("NotCounted")}
      <Paragraph>
        {ifOne("Sessions")}Bu oturum sertifikada sayılmıyor.{elseBranch}Sertifikada sayılmayan oturumlar: {joinTitles("NotCounted")}.{end}
      </Paragraph>
      {end}
      {end}

      {ifSet("OwnerTeam")}
      <Rows>
        <RowItem label="Düzenleyen">{v("OwnerTeam")}</RowItem>
        <RowsEnd />
      </Rows>
      {end}
    </Shell>
  );
}
