import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clubConsoles } from "./club-consoles";

describe("the club console switcher", () => {
  const consoles = clubConsoles([
    { id: "admin", label: "Yönetim", href: "https://admin.example.test" },
    { id: "forms", label: "Forms", href: "https://forms.example.test/admin" },
  ]);

  it("lists the other consoles at their configured addresses, then SkyMail itself", () => {
    assert.deepEqual(
      consoles.map(({ id, label, href }) => ({ id, label, href })),
      [
        { id: "admin", label: "Yönetim", href: "https://admin.example.test" },
        { id: "forms", label: "Forms", href: "https://forms.example.test/admin" },
        { id: "mail", label: "Mail", href: "/" },
      ],
    );
  });

  it("gives every console an icon and a line", () => {
    for (const app of consoles) {
      assert.ok(app.icon, app.id);
      assert.ok(app.description.length > 0, app.id);
    }
  });
});
