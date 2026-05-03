/** Sanitize a redirect path — only allow same-origin relative paths. */
export function safeRedirectPath(next: string | null | undefined): string {
  if (next && next.startsWith('/') && !next.startsWith('//')) return next
  return '/'
}
