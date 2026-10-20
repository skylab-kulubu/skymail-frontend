/**
 * The pieces SKY LAB Forms' own mail templates import from their layout
 * (forms-frontend mail-templates/_components/Layout.jsx) that the theme does
 * not already export under the same name. With them, a Forms template keeps
 * its body as Fatih writes it there and changes only where it imports from:
 * the components come from ./theme, which draws the same layout, and these
 * from here.
 *
 * Layout is the theme's Shell with the Forms brand: the same logo and name on
 * top, the footer with Forms' credit line above SkyMail's. Note is the theme's
 * Note keeping the line breaks, as Forms' does: a review note is typed in a
 * text area.
 */
import * as React from "react";
import { Note as ThemeNote, Shell } from "./theme";

/** Forms' site; a form opens at SITE + "/" + its id. */
export const SITE = "https://forms.yildizskylab.com";

/** Forms passes firstName and recipientName (forms-backend MailNames); either may be empty. */
export const greeting = "{{if .firstName}}Merhaba {{.firstName}},{{else if .recipientName}}Merhaba {{.recipientName}},{{else}}Merhaba,{{end}}";

/** `node` only when the Go condition `cond` holds. */
export const when = (cond: string, node: React.ReactNode) => (
  <>
    {`{{if ${cond}}}`}
    {node}
    {"{{end}}"}
  </>
);

/** `node` only for the given `.kind`. */
export const whenKind = (kind: string, node: React.ReactNode) => when("eq .kind `" + kind + "`", node);

export function Layout({ preview, reason, children }: { preview: string; reason: React.ReactNode; children: React.ReactNode }) {
  return (
    <Shell preview={preview} brand="forms" reason={reason}>
      {children}
    </Shell>
  );
}

export function Note(props: Omit<React.ComponentProps<typeof ThemeNote>, "keepLines">) {
  return <ThemeNote {...props} keepLines />;
}
