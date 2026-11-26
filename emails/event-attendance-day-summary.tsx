import * as React from "react";
import { Context, ListHeader, Paragraph, RowItem, Rows, RowsEnd, Shell, Strong, Title } from "./theme";
import { elseBranch, end, ifSet, joinTitles, rangeOver, v } from "./go";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "event.attendance-day-summary",
  name: "Etkinlik · Kapı: Günün Özeti",
  subject: `${v("EventName")}: günün özeti`,
  system: false,
  contentSensitive: false,
  brand: "skylab",
  trigger:
    "core-backend, günün son canlı oturumunun bitişinden 30 dakika sonra (ATTENDANCE_SUMMARY_DELAY), o gün en az bir oturum Check-in'i olan her etkin bilete bir kez; aynı adresin biletleri tek posta; oturumu olmayan gün için yok (ATTENDANCE_MAIL=on, SKYNOTIFY_ATTENDANCE_SUMMARY_TEMPLATE_KEY, etkinliğin attendanceSummaryMail anahtarı; docs/attendance-mail.md). İşlem postası, kişi kapatamaz. Sayılar gönderim anında; o günün bekleyen yoklama postaları bu özete katılır. CertificateNote'u core kurar (son gün: uygun ve otomatik kapanış açık/kapalı, uygun değil; ara gün: kalan oturum ya da koşul sağlandı); kural yoksa boş. Üyeye bildirim olarak (POST /v1/notifications: kutu + e-posta), misafire yalnız bu e-posta (POST /v1/mail_tasks/single).",
  // core-backend kapi-postalari 06 (SPEC §5.2): DaySessions is
  // [{Time, Title, Attended}]; MissingRequired and MissedRequired [{Title}].
  // Remaining, Eligible and IsLastDay come too; CertificateNote already says
  // what they mean, so the body reads the note.
  variables: [
    "FirstName",
    "EventName",
    "EventId",
    "OwnerTeam",
    "DayLabel",
    "DaySessions",
    "DayAttended",
    "DayTotal",
    "HasRule",
    "Attended",
    "CountedTotal",
    "MinRequired",
    "Remaining",
    "MissingRequired",
    "MissedRequired",
    "Eligible",
    "IsLastDay",
    "CertificateNote",
  ],
  notification: {
    category: null,
    required: true,
    defaultChannels: ["email", "inbox"],
    lane: "system",
    inbox: {
      title: `${v("EventName")}: günün özeti`,
      summary: `Bugün ${v("DayTotal")} oturumdan ${v("DayAttended")} tanesine katıldın.`,
      link: `/events/${v("EventId")}`,
    },
  },
  sample: {
    FirstName: "Elif",
    EventName: "GECEKODU 2026",
    EventId: "6f1c2b9e-4d3a-4b7e-9a51-0c8d2e7f4a19",
    OwnerTeam: "WEBLAB",
    DayLabel: "1. gün · 12 Aralık Cuma",
    DaySessions: [
      { Time: "10:00–10:45", Title: "Açılış", Attended: true },
      { Time: "11:00–12:30", Title: "Go atölyesi", Attended: true },
      { Time: "13:30–15:00", Title: "Veritabanı tasarımı", Attended: false },
      { Time: "15:15–16:45", Title: "Takım çalışması", Attended: true },
    ],
    DayAttended: 3,
    DayTotal: 4,
    HasRule: true,
    Attended: 5,
    CountedTotal: 16,
    MinRequired: 12,
    Remaining: 7,
    MissingRequired: [{ Title: "Final" }],
    MissedRequired: [],
    Eligible: false,
    IsLastDay: false,
    CertificateNote: "Sertifika için 7 oturum daha gerekiyor.",
  },
};

/** Yusuf, 2026-11-24 (kapi-postalari K6): the day's sessions, x/N overall, what is left for the certificate. */
export default function EventAttendanceDaySummary() {
  return (
    <Shell preview={`${v("EventName")}: günün özeti.`} brand="skylab" reason={null}>
      <Context>{v("EventName")}</Context>
      <Title>Günün Özeti</Title>

      <Paragraph>
        {ifSet("FirstName")}Merhaba {v("FirstName")}, {end}
        bugün <Strong>{v("EventName")}</Strong> etkinliğinde {v("DayTotal")} oturumdan {v("DayAttended")} tanesine katıldın.
      </Paragraph>

      <Rows>
        {ifSet("DayLabel")}
        <RowItem label="Gün">{v("DayLabel")}</RowItem>
        {end}
        {ifSet("OwnerTeam")}
        <RowItem label="Düzenleyen">{v("OwnerTeam")}</RowItem>
        {end}
        <RowsEnd />
      </Rows>

      {ifSet("DaySessions")}
      <ListHeader title="Günün oturumları" count={`${v("DayAttended")}/${v("DayTotal")}`} />
      <Rows>
        {rangeOver("DaySessions")}
        <RowItem label={`${v("Time")} · ${v("Title")}`}>
          {ifSet("Attended")}Katıldın{elseBranch}Katılmadın{end}
        </RowItem>
        {end}
        <RowsEnd />
      </Rows>
      {end}

      {ifSet("HasRule")}
      <Paragraph style={{ marginTop: "24px" }}>
        Toplam: {v("CountedTotal")} oturumdan {v("Attended")} tanesine katıldın; sertifika için {v("MinRequired")} gerekiyor.
      </Paragraph>
      {ifSet("MissingRequired")}
      <Paragraph>Zorunlu oturumlardan henüz katılmadıkların: {joinTitles("MissingRequired")}.</Paragraph>
      {end}
      {ifSet("MissedRequired")}
      <Paragraph>Kaçırdığın zorunlu oturumlar: {joinTitles("MissedRequired")}.</Paragraph>
      {end}
      {end}

      {ifSet("CertificateNote")}
      <Paragraph>
        <Strong>{v("CertificateNote")}</Strong>
      </Paragraph>
      {end}
    </Shell>
  );
}
