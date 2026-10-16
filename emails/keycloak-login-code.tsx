import * as React from "react";
import { CodeMail } from "./code-mail";
import { elseBranch, elseIfEq, end, ifEq } from "./go";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "keycloak.login-code",
  name: "Keycloak · Giriş Kodu",
  // purpose is always passed by Keycloak's SkyMail provider (empty for every other mail), so the
  // subject may branch on it; the code itself never goes into a subject line.
  subject:
    "{{if eq .purpose `sudo`}}SKY LAB işlem onaylama kodun{{else if eq .purpose `signup`}}SKY LAB hesap açma kodun{{else if eq .purpose `link`}}SKY LAB hesap bağlama kodun{{else}}SKY LAB giriş kodun{{end}}",
  system: true,
  contentSensitive: true,
  brand: "account",
  trigger:
    "Keycloak'ın e.yildizskylab.com giriş sayfasında \"E-postayla devam et\" ile kod istendiğinde (sky-email-code, eskylab-login-ux 08, ADR-0063). Kod hesabın birincil e-postasına gider; 6 haneli, 10 dakika geçerli, yalnız isteyen tarayıcıda çalışır. purpose: login (giriş), signup (kayıt), link (YTÜ ilk girişinde var olan hesabı bağlama) ve sudo (Hesap Merkezi’nde işlem onaylama; yalnız parolası, passkey’i ve TOTP’si olmayanlara, o anki doğrulanmış birincil adrese, Account center oturumuna bağlı). Keycloak'tan K5 ile gelir.",
  variables: ["code", "codeExpirationMinutes", "purpose", "firstName", "username", "realmDisplayName", "subjectKey"],
  sensitiveVariables: ["code"],
  // The code the person types into the open sign-in page; Keycloak's SkyMail provider always passes it.
  requiredVariables: [{ name: "code", reason: "Açık sayfaya yazılacak kod; kaldırılırsa giriş ya da işlem onayı tamamlanamaz." }],
  sample: {
    code: "731904",
    codeExpirationMinutes: "10",
    purpose: "login",
    firstName: "Yusuf",
    username: "yusuf",
    realmDisplayName: "SKY LAB",
    subjectKey: "skyLoginCodeSubject",
  },
};

export default function KeycloakLoginCode() {
  return (
    <CodeMail
      preview={`${ifEq("purpose", "sudo")}Hesap Merkezi’nde bir işlemi onaylamak için kodun.${elseBranch}SKY LAB'e girmek için kodun.${end}`}
      heading={
        <>
          {ifEq("purpose", "sudo")}İşlem Onaylama Kodun{elseIfEq("purpose", "signup")}Hesap Açma Kodun{elseIfEq("purpose", "link")}Hesap Bağlama Kodun{elseBranch}Giriş
          Kodun{end}
        </>
      }
      intro={
        <>
          {ifEq("purpose", "sudo")}Hesap Merkezi’nde bir işlemi onaylamak için kodun aşağıda.{elseIfEq("purpose", "signup")}SKY LAB hesabını açmak için kodun aşağıda.{elseIfEq("purpose", "link")}YTÜ
          hesabını SKY LAB hesabına bağlamak için kodun aşağıda.{elseBranch}SKY LAB&apos;e girmek için kodun aşağıda.
          {end} {ifEq("purpose", "sudo")}Açık olan doğrulama penceresine yaz; kod yalnız onu istediğin Hesap Merkezi oturumunda çalışır.{elseBranch}Açık olan giriş sayfasına yaz; kod yalnız onu istediğin tarayıcıda çalışır.{end}
        </>
      }
      disclaimer={
        <>
          Bu isteği sen yapmadıysan bu e-postayı yok say:{" "}
          {ifEq("purpose", "sudo")}kod yazılmadan işlem onaylanmaz.{elseIfEq("purpose", "signup")}kod yazılmadan hesap açılmaz.{elseBranch}kod yazılmadan kimse hesabına giremez.
          {end}
        </>
      }
      context={<>{ifEq("purpose", "sudo")}Hesap Merkezi işlemi{elseBranch}SKY LAB girişi{end}</>}
      reason={<>{ifEq("purpose", "sudo")}Bu e-postayı, Hesap Merkezi’nde bir işlemi onaylamak için kod istendiğinden alıyorsun.{elseBranch}Bu e-postayı, bu adresle SKY LAB&apos;e e-postayla giriş ya da hesap açma kodu istendiği için alıyorsun.{end}</>}
    />
  );
}
