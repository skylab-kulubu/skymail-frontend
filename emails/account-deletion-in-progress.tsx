import * as React from "react";
import { Context, Paragraph, Shell, Title } from "./theme";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "account.deletion-in-progress",
  name: "Hesap Silme Sürüyor (kayıt denemesi)",
  subject: "Bu adresin hesabı siliniyor",
  system: true,
  contentSensitive: true,
  brand: "account",
  trigger:
    "Keycloak (sky-account SPI), giriş sayfasında \"E-postayla devam et\" ile silinme sürecindeki bir hesabın adresine kod istendiğinde, o adrese; aynı adrese saatte en çok bir. Takip edilmez, SkyMail'de kaydı kalmaz (erase_after_send).",
  variables: [],
  sensitiveVariables: [],
  requiredVariables: [],
  sample: {},
};

/**
 * Someone asked for a sign-in code ("E-postayla devam et") with an address
 * whose account is being deleted. The mail goes to that address only, so the
 * page tells whoever typed it nothing.
 */
export default function AccountDeletionInProgress() {
  return (
    <Shell preview="Bu adresin hesabı silinme sürecinde." brand="account" reason={null}>
      <Context tone="wait">Hesap silme</Context>
      <Title>Hesap Siliniyor</Title>

      <Paragraph>
        Bu adresin hesabı silinme sürecinde. Silme bitince aynı adresle yeniden kayıt olabilirsin.
      </Paragraph>
    </Shell>
  );
}
