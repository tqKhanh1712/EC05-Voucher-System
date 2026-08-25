export function getSafeInternalRedirect(
  value: string | null | undefined,
  fallback?: string,
): string | undefined {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return fallback;
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';
    const target = new URL(value, baseUrl);
    if (target.origin !== baseUrl) {
      return fallback;
    }

    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return fallback;
  }
}
