import * as React from "react";
import { Context, ListHeader, Note, Paragraph, RowItem, Rows, RowsEnd, Shell, Strong, TextLink, Title } from "./theme";
import { elseBranch, end, ifSet, joinTitles, rangeOver, v } from "./go";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "event.attendance-welcome",
  name: "Etkinlik · Kapı: Hoş Geldin",
  subject: `${v("EventName")}: hoş geldin`,
  system: false,
  // AttendeeNote may hold the venue's Wi-Fi password.
  contentSensitive: true,
  brand: "skylab",
  trigger:
    "core-backend, kişinin o günkü ilk okutmasında (o günün Venue entry'si yazılınca: kapıda okutma, masa ya da girişsiz alınan oturum yoklaması), yazıldıktan 2 dakika sonra, günde bir kez; çok günlü etkinlikte her gün (ATTENDANCE_MAIL=on, SKYMAIL_ATTENDANCE_WELCOME_TEMPLATE_KEY, etkinliğin attendanceWelcomeMail anahtarı; docs/attendance-mail.md). İşlem postası, kişi kapatamaz. Aynı biletin 2 dakika içindeki oturum yoklamaları bu postaya katılır (Recorded dolu gelir). Üyeye bildirim olarak (POST /v1/notifications: kutu + e-posta), misafire yalnız bu e-posta (POST /v1/mail_tasks/single). Her değişken her zaman gelir, boş olabilir. AttendeeNote düzenleyenin mekan/Wi-Fi notudur, yalnız bu postada görünür, kutuya girmez.",
  // core-backend kapi-postalari 04 (SPEC §5.2). Program: [{Time, Title}];
  // AttendeeNoteParts: [{Text, Url}], the note cut at its http(s) addresses,
  // Url empty for plain text (the note's links, Yusuf 2026-11-24);
  // Recorded, MissingRequired, MissedRequired: [{Title}]; the counts are
  // numbers, 0 when the event has no certificate rule.
  variables: [
    "FirstName",
    "EventName",
    "EventId",
    "OwnerTeam",
    "DayLabel",
    "Program",
    "AttendeeNote",
    "AttendeeNoteParts",
    "CertificateLine",
    "Recorded",
    "Attended",
    "CountedTotal",
    "MinRequired",
    "MissingRequired",
    "MissedRequired",
  ],
  // The Wi-Fi password is a credential, and SkyMail's masking does not catch a
  // password without digits by itself: listed, it is hidden whole.
  // AttendeeNoteParts (the note cut at its web addresses) is not listed: no
  // mask, and its links are tracked as any other (ADR-0074, 2026-11-24 ek).
  sensitiveVariables: ["AttendeeNote"],
  notification: {
    category: null,
    required: true,
    defaultChannels: ["email", "inbox"],
    lane: "system",
    // No AttendeeNote here: the Wi-Fi note stays in the mail.
    inbox: {
      title: `${v("EventName")}: hoş geldin`,
      summary: v("DayLabel"),
      link: `/events/${v("EventId")}`,
    },
  },
  sample: {
    FirstName: "Elif",
    EventName: "GECEKODU 2026",
    EventId: "6f1c2b9e-4d3a-4b7e-9a51-0c8d2e7f4a19",
    OwnerTeam: "WEBLAB",
    DayLabel: "1. gün · 12 Aralık Cuma",
    Program: [
      { Time: "10:00–10:45", Title: "Açılış" },
      { Time: "11:00–12:30", Title: "Go atölyesi" },
      { Time: "13:30–15:00", Title: "Veritabanı tasarımı" },
      { Time: "15:15–16:45", Title: "Takım çalışması" },
    ],
    AttendeeNote: "Wi-Fi: SKYLAB-Etkinlik\nParola: ornek-parola\nSalon: D-Blok zemin kat, D-001\nKroki: https://example.test/kroki",
    AttendeeNoteParts: [
      { Text: "Wi-Fi: SKYLAB-Etkinlik\nParola: ornek-parola\nSalon: D-Blok zemin kat, D-001\nKroki: ", Url: "" },
      { Text: "https://example.test/kroki", Url: "https://example.test/kroki" },
    ],
    CertificateLine: "Sertifika için 16 oturumdan en az 12'sine katılmalısın. Zorunlu: Final.",
    Recorded: [{ Title: "Açılış" }],
    Attended: 1,
    CountedTotal: 16,
    MinRequired: 12,
    MissingRequired: [{ Title: "Final" }],
    MissedRequired: [],
  },
};

/**
 * The day's first scan: the day's programme, the organizer's note (Wi-Fi,
 * the room), the certificate rule in one line and, when a session check-in
 * came within the same two minutes, that check-in's receipt.
 */
export default function EventAttendanceWelcome() {
  return (
    <Shell preview={`${v("EventName")}: hoş geldin.`} brand="skylab" reason={null}>
      <Context tone="ok">{v("EventName")}</Context>
      <Title>Hoş Geldin</Title>

      <Paragraph>
        {ifSet("FirstName")}Merhaba {v("FirstName")}, {end}
        <Strong>{v("EventName")}</Strong> girişin alındı.
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

      {ifSet("Program")}
      <ListHeader title="Günün programı" />
      <Rows>
        {rangeOver("Program")}
        <RowItem label={v("Time")}>{v("Title")}</RowItem>
        {end}
        <RowsEnd />
      </Rows>
      {end}

      {ifSet("AttendeeNote")}
      <Note label="Bilmen gerekenler" keepLines>
        {rangeOver("AttendeeNoteParts")}
        {ifSet("Url")}
        <TextLink href={v("Url")}>{v("Text")}</TextLink>
        {elseBranch}
        {v("Text")}
        {end}
        {end}
      </Note>
      {end}

      {ifSet("CertificateLine")}
      <Paragraph style={{ marginTop: "24px" }}>{v("CertificateLine")}</Paragraph>
      {end}

      {ifSet("Recorded")}
      <Paragraph style={{ marginTop: "24px" }}>
        Katılımın alındı: {joinTitles("Recorded")}.
        {ifSet("MinRequired")} {v("CountedTotal")} oturumdan {v("Attended")} tanesine katıldın; sertifika için {v("MinRequired")} gerekiyor.{end}
      </Paragraph>
      {ifSet("MissingRequired")}
      <Paragraph>Zorunlu oturumlardan henüz katılmadıkların: {joinTitles("MissingRequired")}.</Paragraph>
      {end}
      {ifSet("MissedRequired")}
      <Paragraph>Kaçırdığın zorunlu oturumlar: {joinTitles("MissedRequired")}.</Paragraph>
      {end}
      {end}
    </Shell>
  );
}
