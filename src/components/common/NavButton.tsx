'use client';

import { Button, type ButtonProps } from '@skylab-kulubu/skylcn-ui';
import { useRouter } from 'next/navigation';

/**
 * A skylcn Button that opens `href` in the panel: a button rather than a link,
 * so it can be disabled while a form saves (İptal), as the copied kit's
 * `<Button href>` was.
 */
export function NavButton({ href, onClick, ...props }: Omit<ButtonProps, 'type'> & { href: string }) {
  const router = useRouter();
  return (
    <Button
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) router.push(href);
      }}
    />
  );
}
