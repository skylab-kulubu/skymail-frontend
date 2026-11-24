/**
 * The door mails (kapi-postalari 07; SPEC §5.2): the welcome on the day's first
 * scan, the receipt for each session check-in and the day's summary. core
 * sends every variable every time (SkyMail renders with missingkey=error);
 * lists are ranged over, so inside a range .Title, .Time and .Attended are the
 * element's. Words are Yusuf's (2026-11-24, K5): "'<Oturum>' oturumuna
 * katılımın alındı. <N> oturumdan <x> tanesine katıldın; sertifika için <M>
 * gerekiyor."
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findTemplate } from "../../../emails";
import { findActions } from "./go-template";
import { fillSampleValues, referencedVariables, renderComponent } from ".";

async function rendered(key: string) {
  const template = findTemplate(key);
  assert.ok(template, `${key} yok`);
  const result = await renderComponent(template.Component);
  assert.ok(result.ok, `${key} render edilmedi`);
  return { meta: template.meta, html: result.html, plainText: result.plainText };
}

const actionsOf = (body: string) => findActions(body).map(({ start, end }) => body.slice(start, end).replace(/\s+/g, " "));

/** The visible text with every Go action left in place, one string. */
const text = (html: string) =>
  html
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&apos;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;|&#xA0;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const CORE: Record<string, string[]> = {
  "event.attendance-welcome": [
    "AttendeeNote", "AttendeeNoteParts", "Attended", "CertificateLine", "CountedTotal", "DayLabel", "EventId", "EventName", "FirstName",
    "MinRequired", "MissedRequired", "MissingRequired", "OwnerTeam", "Program", "Recorded",
  ],
  "event.attendance-recorded": [
    "Attended", "CountedTotal", "EventId", "EventName", "FirstName", "HasRule", "MinRequired", "MissedRequired",
    "MissingRequired", "NotCounted", "OwnerTeam", "Sessions",
  ],
  "event.attendance-day-summary": [
    "Attended", "CertificateNote", "CountedTotal", "DayAttended", "DayLabel", "DaySessions", "DayTotal", "Eligible",
    "EventId", "EventName", "FirstName", "HasRule", "IsLastDay", "MinRequired", "MissedRequired", "MissingRequired",
    "OwnerTeam", "Remaining",
  ],
};

/** Sent by core but not read by the body: EventId is the inbox link's; the note says what Remaining, Eligible and IsLastDay mean. */
const NOT_IN_BODY = new Set(["EventId", "Remaining", "Eligible", "IsLastDay"]);

const SUBJECTS: Record<string, string> = {
  "event.attendance-welcome": "{{.EventName}}: hoş geldin",
  "event.attendance-recorded": "{{.EventName}}: katılımın alındı",
  "event.attendance-day-summary": "{{.EventName}}: günün özeti",
};

describe("the door mails", () => {
  for (const key of Object.keys(CORE)) {
    it(`${key} reads exactly what core sends`, async () => {
      const { meta, html } = await rendered(key);
      assert.equal(meta.subject, SUBJECTS[key]);
      assert.equal(meta.system, false);
      assert.deepEqual([...meta.variables].sort(), [...CORE[key]].sort());
      assert.deepEqual(Object.keys(meta.sample).sort(), [...CORE[key]].sort());
      const referenced = [...referencedVariables(html)].filter((name) => name !== "UnsubscribeUrl");
      assert.deepEqual(referenced.sort(), CORE[key].filter((name) => !NOT_IN_BODY.has(name)).sort());
    });

    it(`${key} is a required, system lane Notification type by e-mail and the inbox, opening the event`, async () => {
      const { meta } = await rendered(key);
      const n = meta.notification;
      assert.ok(n, `${key}: Bildirim türü yok`);
      assert.deepEqual(
        { required: n.required, lane: n.lane, channels: n.defaultChannels, category: n.category },
        { required: true, lane: "system", channels: ["email", "inbox"], category: null },
      );
      assert.equal(n.inbox?.title, meta.subject);
      assert.equal(n.inbox?.link, "/events/{{.EventId}}");
      assert.ok(!JSON.stringify(n.inbox).includes("AttendeeNote"), `${key}: Wi-Fi notu kutuya girmez`);
    });

    it(`${key} carries no exclamation, no reassurance, no emoji`, async () => {
      const { meta, html, plainText } = await rendered(key);
      for (const body of [text(fillSampleValues(html, meta.sample)), plainText]) {
        assert.ok(!/[!🎉✅]|endişelenme|merak etme|teşekkür/u.test(body), key);
      }
    });
  }

  it("samples the brief's case: 16 sessions, 5 attended, 12 required, Final mandatory", async () => {
    for (const key of ["event.attendance-recorded", "event.attendance-day-summary"]) {
      const { meta } = await rendered(key);
      assert.equal(meta.sample.CountedTotal, 16);
      assert.equal(meta.sample.Attended, 5);
      assert.equal(meta.sample.MinRequired, 12);
      assert.deepEqual(meta.sample.MissingRequired, [{ Title: "Final" }]);
    }
  });
});

describe("the welcome (event.attendance-welcome)", () => {
  it("masks its content and the note whole, since the note may hold the Wi-Fi password", async () => {
    const { meta } = await rendered("event.attendance-welcome");
    assert.equal(meta.contentSensitive, true);
    assert.deepEqual(meta.sensitiveVariables, ["AttendeeNote"]);
  });

  it("shows the programme, the note with its line breaks and the certificate line only when set", async () => {
    const { html, plainText } = await rendered("event.attendance-welcome");
    for (const body of [html, plainText]) {
      const actions = actionsOf(body);
      for (const block of ["{{if .Program}}", "{{range .Program}}", "{{if .AttendeeNote}}", "{{if .CertificateLine}}", "{{if .Recorded}}"]) {
        assert.ok(actions.includes(block), `${block} yok`);
      }
    }
    // The note keeps its lines and makes its web addresses links (core cuts it at them)
    const gap = String.raw`(?:\s|<!-- -->)*`;
    assert.match(
      html,
      new RegExp(
        String.raw`white-space:pre-wrap[^>]*>` + gap +
          String.raw`\{\{range \.AttendeeNoteParts\}\}` + gap + String.raw`\{\{if \.Url\}\}` + gap +
          String.raw`<a[^>]*href="\{\{\.Url\}\}"[^>]*>\{\{\.Text\}\}</a>` + gap + String.raw`\{\{else\}\}` + gap +
          String.raw`\{\{\.Text\}\}` + gap + String.raw`\{\{end\}\}` + gap + String.raw`\{\{end\}\}`,
      ),
    );
    assert.match(html, /\{\{range \.Program\}\}[\s\S]*\{\{\.Time\}\}[\s\S]*\{\{\.Title\}\}[\s\S]*\{\{end\}\}/);
  });

  it("joins a check-in of the same two minutes: the receipt and the count, inside the Recorded block", async () => {
    const { plainText } = await rendered("event.attendance-welcome");
    const body = text(plainText);
    assert.match(
      body,
      /\{\{if \.Recorded\}\} Katılımın alındı: \{\{range \$i, \$s := \.Recorded\}\}\{\{if \$i\}\}, \{\{end\}\}\{\{\$s\.Title\}\}\{\{end\}\}\.\s*\{\{if \.MinRequired\}\}\s*\{\{\.CountedTotal\}\} oturumdan \{\{\.Attended\}\} tanesine katıldın; sertifika için \{\{\.MinRequired\}\} gerekiyor\.\{\{end\}\}/,
    );
  });

  it("reads as a greeting and the day's rows when every list and note is empty", async () => {
    const { meta, html } = await rendered("event.attendance-welcome");
    const empty = { ...meta.sample, Program: [], AttendeeNote: "", AttendeeNoteParts: [], CertificateLine: "", Recorded: [], MissingRequired: [], DayLabel: "" };
    const body = text(fillSampleValues(html, empty));
    assert.match(body, /Merhaba Elif\s*, GECEKODU 2026 girişin alındı\./);
    assert.doesNotMatch(body, /Günün programı|Bilmen gerekenler|Sertifika için|Katılımın alındı|Gün /);
  });
});

describe("the session receipt (event.attendance-recorded)", () => {
  it("says the session, the count and the missing required ones, all inside HasRule but the first sentence", async () => {
    const { plainText } = await rendered("event.attendance-recorded");
    const body = text(plainText);
    assert.match(
      body,
      /\{\{if \.FirstName\}\}Merhaba \{\{\.FirstName\}\}, \{\{end\}\}\s*\{\{range \$i, \$s := \.Sessions\}\}\{\{if \$i\}\}, \{\{end\}\}'\{\{\$s\.Title\}\}'\{\{end\}\} \{\{if eq \(len \.Sessions\) 1\}\}oturumuna\{\{else\}\}oturumlarına\{\{end\}\} katılımın alındı\.\s*\{\{if \.HasRule\}\}\s*\{\{\.CountedTotal\}\} oturumdan \{\{\.Attended\}\} tanesine katıldın; sertifika için \{\{\.MinRequired\}\} gerekiyor\.\{\{end\}\}/,
    );
    assert.match(body, /\{\{if \.HasRule\}\}\s*\{\{if \.MissingRequired\}\}\s*Zorunlu oturumlardan henüz katılmadıkların: /);
    assert.match(body, /Kaçırdığın zorunlu oturumlar: /);
    assert.match(body, /\{\{if eq \(len \.Sessions\) 1\}\}Bu oturum sertifikada sayılmıyor\.\{\{else\}\}Sertifikada sayılmayan oturumlar: /);
  });
});

describe("the day's summary (event.attendance-day-summary)", () => {
  it("lists the day's sessions with whether the person attended, x/N overall and core's certificate note", async () => {
    const { html, plainText } = await rendered("event.attendance-day-summary");
    assert.match(text(plainText), /\{\{range \.DaySessions\}\}\s*\{\{\.Time\}\} · \{\{\.Title\}\}\s*\{\{if \.Attended\}\}Katıldın\{\{else\}\}Katılmadın\{\{end\}\}\s*\{\{end\}\}/);
    assert.ok(text(html).includes("{{range .DaySessions}}"), "HTML ranges over DaySessions");
    const body = text(plainText);
    assert.match(body, /bugün \{\{\.EventName\}\} etkinliğinde \{\{\.DayTotal\}\} oturumdan \{\{\.DayAttended\}\} tanesine katıldın\./);
    assert.match(body, /\{\{if \.HasRule\}\}\s*Toplam: \{\{\.CountedTotal\}\} oturumdan \{\{\.Attended\}\} tanesine katıldın; sertifika için \{\{\.MinRequired\}\} gerekiyor\./);
    assert.match(body, /\{\{if \.CertificateNote\}\}\s*\{\{\.CertificateNote\}\}\s*\{\{end\}\}/);
  });

  it("says nothing about a certificate when the event has no rule", async () => {
    const { meta, html } = await rendered("event.attendance-day-summary");
    const none = { ...meta.sample, HasRule: false, CertificateNote: "", MissingRequired: [] };
    const body = text(fillSampleValues(html, none));
    assert.doesNotMatch(body, /Toplam:|sertifika|Sertifika/);
  });

  it("prints core's last-day note as it comes", async () => {
    const { meta, html } = await rendered("event.attendance-day-summary");
    const note = "Sertifikan katılım kapanınca (yaklaşık 1 saat sonra) gelecek.";
    const body = text(fillSampleValues(html, { ...meta.sample, IsLastDay: true, Eligible: true, CertificateNote: note }));
    assert.ok(body.includes(note));
  });
});
