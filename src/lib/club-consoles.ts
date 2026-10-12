import { ClipboardList, Mail, ShieldCheck, type LucideIcon } from "lucide-react";
import type { ConsoleLink } from "@/lib/runtime-config";

export type ClubConsoleEntry = Readonly<{
  id: ConsoleLink["id"] | "mail";
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
}>;

// The same names, icons and lines as the admin panel's switcher (core-frontend), so the menu reads alike in every console.
const ICON: Record<ClubConsoleEntry["id"], LucideIcon> = { admin: ShieldCheck, forms: ClipboardList, mail: Mail };
const DESCRIPTION: Record<ClubConsoleEntry["id"], string> = {
  admin: "Üyeler ve etkinlikler",
  forms: "Formlar ve başvurular",
  mail: "Toplu e-posta ve listeler",
};

/** Every club console for skylcn's SidebarBrand switcher, SkyMail ("mail", the current one) included. */
export function clubConsoles(others: readonly ConsoleLink[]): ClubConsoleEntry[] {
  const all = [...others, { id: "mail" as const, label: "Mail", href: "/" }];
  return all.map((app) => ({ ...app, icon: ICON[app.id], description: DESCRIPTION[app.id] }));
}
