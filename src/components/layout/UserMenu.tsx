'use client';

// Copied from the admin panel (core-frontend src/components/layout/UserMenu.tsx, PR #144) so
// the account sits in the same place, with the same rows in the same order, in every console:
// the person, Hesap merkezi, Tema, Çıkış yap. Goes away once skylcn-ui ships an AccountMenu and
// an `account` slot in AppShell (top bar standard, S1; Kaan). SkyMail's token carries no
// Keycloak groups, so the club role line the panel shows is left out.

import {
  Avatar,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  MenuItem,
  MenuLinkItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
  useTheme,
  type ThemePreference,
} from '@skylab-kulubu/skylcn-ui';
import { LogOut, Palette, UserRound } from 'lucide-react';
import { useRef } from 'react';
import { signOutOfKeycloak } from '@/lib/auth/actions';
import { displayPersonName } from '@/lib/chrome-role';

/** The signed-in person at the top right of every page, as in Entra and Microsoft 365. */
export function UserMenu({
  name: rawName,
  email,
  accountUrl,
}: {
  name?: string | null;
  email?: string | null;
  /** The account center, where the person edits their own profile and sign-in. */
  accountUrl: string;
}) {
  const name = rawName ? displayPersonName(rawName) : 'Kullanıcı';
  const { theme, setTheme } = useTheme();
  // The sign-out is a Server Action; the menu item submits this form.
  const signOutForm = useRef<HTMLFormElement>(null);
  return (
    <>
      <form ref={signOutForm} action={signOutOfKeycloak} hidden />
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Hesap: ${name}`}
          title={name}
          className="hover:bg-accent data-popup-open:bg-accent focus-visible:ring-ring grid size-8 shrink-0 place-items-center rounded-full outline-hidden focus-visible:ring-2"
        >
          <Avatar name={name} email={email} size="sm" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-64">
          <div className="flex items-center gap-3 px-2 py-2">
            <Avatar name={name} email={email} size="md" />
            <div className="min-w-0">
              <p className="text-foreground-strong truncate text-sm font-medium">{name}</p>
              {email ? <p className="text-subtle-foreground truncate text-[13px]/5">{email}</p> : null}
            </div>
          </div>
          <MenuSeparator />
          <MenuLinkItem href={accountUrl} icon={UserRound}>
            Hesap merkezi
          </MenuLinkItem>
          <MenuSub>
            <MenuSubTrigger icon={Palette}>Tema</MenuSubTrigger>
            <MenuSubContent>
              <MenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as ThemePreference)}>
                <MenuRadioItem value="dark">Koyu</MenuRadioItem>
                <MenuRadioItem value="light">Açık</MenuRadioItem>
                <MenuRadioItem value="system">Sistem</MenuRadioItem>
              </MenuRadioGroup>
            </MenuSubContent>
          </MenuSub>
          <MenuSeparator />
          <MenuItem icon={LogOut} destructive onClick={() => signOutForm.current?.requestSubmit()}>
            Çıkış yap
          </MenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
