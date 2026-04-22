/**
 * Helpers compartihados de UI
 */
export function normalizePhotoUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return '';
  if (url.startsWith('data:image')) return url;
  if (url.startsWith('/storage/')) return url;
  
  try {
    const match = url.match(/^https?:\/\/[^\/]+\/(.+)$/);
    if (match) return `/storage/${match[1]}`;
  } catch(e) {}
  
  return url;
}
