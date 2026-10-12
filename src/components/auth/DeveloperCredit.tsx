/**
 * Who built SkyMail. The Refine panel signed this on its sign-in screen
 * until the Next.js rewrite (#25) dropped it; Forms and the e-skylab sign-in
 * page carry the same "Developed by" line. It sits under the sign-in task and
 * at the foot of the sidebar.
 */
export function DeveloperCredit() {
  return (
    <a
      href="https://enesgenc.dev"
      target="_blank"
      rel="noopener noreferrer"
      className="text-3xs text-subtle-foreground hover:text-foreground focus-visible:ring-ring rounded-sm transition-colors outline-hidden focus-visible:ring-2"
    >
      Developed by Enes Genç
    </a>
  );
}
