export type ClubConsole = 'admin' | 'forms' | 'mail';

export type ClubSwitcherLink = {
  id: ClubConsole;
  label: string;
  href: string;
};

function envOr(value: string | undefined, fallback: string): string {
  return value && value.length > 0 ? value : fallback;
}

function clubConsoles(): ClubSwitcherLink[] {
  return [
    {
      id: 'admin',
      label: 'Yönetim',
      href: envOr(import.meta.env.VITE_ADMIN_URL, 'https://admin.yildizskylab.com'),
    },
    {
      id: 'forms',
      label: 'Forms',
      href: envOr(
        import.meta.env.VITE_FORMS_ADMIN_URL,
        'https://forms.yildizskylab.com/admin',
      ),
    },
    {
      id: 'mail',
      label: 'Mail',
      href: envOr(import.meta.env.VITE_MAIL_URL, 'https://mail.yildizskylab.com'),
    },
  ];
}

export function clubSwitcherLinks(current: ClubConsole): ClubSwitcherLink[] {
  return clubConsoles().filter((app) => app.id !== current);
}
