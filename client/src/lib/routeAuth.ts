export function accessTokenForRoute(pathname: string, memberToken: string | null, staffToken: string | null) {
  return pathname.startsWith("/portal") ? memberToken : staffToken;
}

export function isMemberPortalRoute(pathname: string) {
  return pathname.startsWith("/portal");
}
