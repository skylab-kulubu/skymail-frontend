// Copied from superadmin (ADR-0017). The club role label reads Keycloak groups,
// which the skymail token does not carry, so only the name formatting is kept.

export function displayPersonName(
  firstName?: string,
  lastName?: string,
  username?: string,
): string {
  const raw = `${firstName ?? ''} ${lastName ?? ''}`.trim() || username?.trim() || 'Kullanıcı';
  return raw
    .toLocaleLowerCase('tr-TR')
    .split(/\s+/)
    .map((word) => word.replace(/^\p{L}/u, (ch) => ch.toLocaleUpperCase('tr-TR')))
    .join(' ');
}
