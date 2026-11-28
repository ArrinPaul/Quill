/**
 * Validates a redirect query parameter so only safe, relative in-app paths are honored.
 * Rejects protocol-relative URLs, external URLs, and backslash bypasses.
 */
export function getSafeRedirect(raw: string | null | undefined, fallback = "/dashboard"): string {
  if (!raw) return fallback;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/\\")) {
    return fallback;
  }
  return trimmed;
}
