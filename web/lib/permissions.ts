/**
 * Per-role page access. Roles not listed here (admin, manager, engineer, client,
 * procurement, hr, sales) keep full access — only `project` is restricted, since
 * a "Project" person handles projects only and shouldn't see breakdown/maintenance tickets.
 */
export const ROLE_ALLOWED_PATHS: Record<string, string[]> = {
  project: ['/', '/projects', '/clients', '/sites', '/part-requests'],
}

/** Settings holds organisation-wide config (branding, SLAs, HR policy, notifications) — only these roles may see or change it. */
export const SETTINGS_ROLES = ['admin', 'manager', 'hr']

export function isPathAllowed(role: string | undefined, pathname: string): boolean {
  if (pathname.startsWith('/settings') && !SETTINGS_ROLES.includes(role ?? '')) return false

  const allowed = role ? ROLE_ALLOWED_PATHS[role] : undefined
  if (!allowed) return true // no restriction defined for this role
  return allowed.some(p => pathname === p || (p !== '/' && pathname.startsWith(p)))
}

/** Where to send a restricted role if it lands somewhere it can't access. */
export function defaultPathFor(role: string | undefined): string {
  const allowed = role ? ROLE_ALLOWED_PATHS[role] : undefined
  return allowed?.[1] ?? '/'
}
