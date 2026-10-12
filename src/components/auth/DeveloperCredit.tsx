/**
 * Who built SkyMail. The Refine panel signed this on its sign-in screen
 * until the Next.js rewrite (#25) dropped it; Forms and the e-skylab sign-in
 * page carry the same "Developed by" line.
 */
export function DeveloperCredit() {
  return (
    <a
      href="https://enesgenc.dev"
      target="_blank"
      rel="noopener noreferrer"
      className="hover:text-skylab-300 focus-visible:ring-skylab-400/40 rounded text-xs text-neutral-500 transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      Developed by Enes Genç
    </a>
  );
}
