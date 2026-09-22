import * as React from "react";
import { Text } from "@react-email/components";
import { Cta, Heading, Shell, colors, fontStack } from "./theme";
import { end, ifSet, v } from "./go";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "free.basic",
  name: "Serbest Gönderim",
  // The only template whose subject is written per send, so the variable is
  // always supplied by the compose form and can never be missing here.
  subject: v("Subject"),
  system: false,
  brand: "skylab",
  trigger: "SkyMail'de elle: alıcıları seç, konuyu ve gövdeyi yaz, gönder.",
  variables: ["Subject", "Heading", "BodyHtml", "CtaLabel", "CtaUrl"],
  sample: {
    Subject: "GECEKODU başvuruları açıldı",
    Heading: "GECEKODU Başvuruları Açıldı",
    BodyHtml:
      "<p>Bu yıl <strong>GECEKODU</strong> 12–13 Nisan'da Davutpaşa'da. Takımını kur, 24 saat boyunca bir fikri çalışır hâle getir.</p><p>Kontenjan sınırlı; başvurular <strong>5 Nisan</strong>'da kapanıyor.</p>",
    CtaLabel: "Başvuruya Git",
    CtaUrl: "https://skyl.app/gecekodu",
  },
};

/**
 * The one template whose body is written by a person rather than by a service.
 *
 * BodyHtml is the only variable in the whole catalogue rendered with safeHTML
 * instead of being escaped, so the sender's bold text and links survive. What
 * reaches it has already been narrowed to an allowlist twice — once in the
 * compose form and once in the mailer — so this is rich text, not an opening
 * for arbitrary markup.
 */
export default function FreeBasic() {
  return (
    <Shell preview={v("Subject")} brand="skylab">
      {ifSet("Heading")}
      <Heading>{v("Heading")}</Heading>

      <div
        className="t-body"
        style={{
          marginTop: "14px",
          fontSize: "15px",
          lineHeight: "1.75",
          color: colors.textBody,
          fontFamily: fontStack,
        }}
      >
        {"{{safeHTML .BodyHtml}}"}
      </div>

      {ifSet("CtaUrl")}
      <Cta href={v("CtaUrl")}>
        {ifSet("CtaLabel")}{v("CtaLabel")}{end}
      </Cta>
      {end}

      <Text
        className="t-faint"
        style={{ marginTop: "28px", marginBottom: 0, fontSize: "12px", lineHeight: "1.7", color: colors.textFaint, fontFamily: fontStack }}
      >
        Bu e-postayı SKY LAB üyesi ya da etkinlik katılımcısı olduğun için alıyorsun.
      </Text>
    </Shell>
  );
}
