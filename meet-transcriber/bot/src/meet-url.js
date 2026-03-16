const MEET_ID_REGEX = /\b([a-z]{3}-[a-z]{4}-[a-z]{3})\b/i;

export function normalizeMeetUrlInput(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';

  const directId = raw.match(MEET_ID_REGEX);
  if (directId?.[1]) {
    return `https://meet.google.com/${directId[1].toLowerCase()}`;
  }

  let candidate = raw;
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  try {
    const parsed = new URL(candidate);
    const fromPath = parsed.pathname.match(MEET_ID_REGEX);
    if (fromPath?.[1]) {
      return `https://meet.google.com/${fromPath[1].toLowerCase()}`;
    }
  } catch (_error) {
    // Fallback to regex scan below.
  }

  const anywhere = raw.match(MEET_ID_REGEX);
  if (anywhere?.[1]) {
    return `https://meet.google.com/${anywhere[1].toLowerCase()}`;
  }

  throw new Error('Invalid Meet link or meeting code. Expected format like zzo-gpgq-okp.');
}
