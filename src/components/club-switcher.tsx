import { clubSwitcherLinks } from "../lib/club-switcher";
import "./club-switcher.css";

export function ClubSwitcher() {
  return (
    <nav aria-label="Kulüp konsolları" className="club-switcher">
      {clubSwitcherLinks("mail").map((app) => (
        <a key={app.id} href={app.href} className="club-switcher-link">
          {app.label}
        </a>
      ))}
    </nav>
  );
}
