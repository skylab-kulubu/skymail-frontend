import { clubSwitcherLinks } from "../lib/club-switcher";

export function ClubSwitcher() {
  return (
    <nav aria-label="Kulüp konsolları" style={{ padding: "8px 16px 16px" }}>
      {clubSwitcherLinks("mail").map((app) => (
        <a
          key={app.id}
          href={app.href}
          style={{
            display: "block",
            padding: "8px 12px",
            color: "rgba(255,255,255,0.65)",
            textDecoration: "none",
            fontSize: 14,
          }}
        >
          {app.label}
        </a>
      ))}
    </nav>
  );
}
