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
    "Keycloak (sky-account SPI), silinme sürecindeki bir hesabın adresiyle yeniden kayıt denendiğinde, o adrese.",
  variables: [],
  sensitiveVariables: [],
  requiredVariables: [],
  sample: {},
};

/**
 * Someone tried to sign up with an address whose account is being deleted.
 * The mail goes to that address only, so it tells nothing to whoever typed it.
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
