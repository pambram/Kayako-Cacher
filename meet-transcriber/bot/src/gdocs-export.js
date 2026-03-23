import { google } from 'googleapis';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SA_PATH = path.resolve(__dirname, '..', 'pambram-automations-sa.json');

const SCOPES = [
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/drive'
];

function buildJwtClient() {
  if (!fs.existsSync(SA_PATH)) {
    throw new Error(`Service account file not found at ${SA_PATH}`);
  }
  const key = JSON.parse(fs.readFileSync(SA_PATH, 'utf8'));
  // Only use domain-wide delegation when no Shared Drive is configured.
  const sharedDriveId = process.env.GDOCS_SHARED_DRIVE_ID || '';
  const impersonate = sharedDriveId ? '' : (process.env.GDOCS_IMPERSONATE_USER || '');
  console.log(`[gdocs] Using service account: ${key.client_email}${impersonate ? ` (impersonating ${impersonate})` : ''}`);
  const jwt = new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: SCOPES,
    ...(impersonate ? { subject: impersonate } : {})
  });
  return jwt;
}

function esc(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Parse an S3 URL (presigned or plain) into { bucket, key, region }.
 * Supports both path-style and virtual-hosted URLs.
 */
function parseS3Url(url) {
  try {
    const parsed = new URL(url.split('?')[0]); // strip query string
    // Virtual-hosted: <bucket>.s3[.<region>].amazonaws.com/<key>
    const vhMatch = parsed.hostname.match(/^(.+?)\.s3(?:\.([^.]+))?\.amazonaws\.com$/);
    if (vhMatch) {
      return { bucket: vhMatch[1], key: parsed.pathname.slice(1), region: vhMatch[2] || 'us-east-1' };
    }
    // Path-style: s3[.<region>].amazonaws.com/<bucket>/<key>
    const pathMatch = parsed.hostname.match(/^s3(?:\.([^.]+))?\.amazonaws\.com$/);
    if (pathMatch) {
      const [, bucket, ...rest] = parsed.pathname.slice(1).split('/');
      return { bucket, key: rest.join('/'), region: pathMatch[1] || 'us-east-1' };
    }
  } catch (_) { /* ignore */ }
  return null;
}

/**
 * Download an image and return a base64 data URI.
 * For S3 URLs (presigned or not), uses the AWS SDK directly so expired presigned
 * URLs are no problem — we authenticate with the bot's own IAM credentials.
 */
async function fetchImageAsDataUri(url) {
  const s3Info = parseS3Url(url);
  if (s3Info) {
    try {
      const s3 = new S3Client({ region: s3Info.region });
      const res = await s3.send(new GetObjectCommand({ Bucket: s3Info.bucket, Key: s3Info.key }));
      const chunks = [];
      for await (const chunk of res.Body) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      const buf = Buffer.concat(chunks);
      const ct = res.ContentType || 'image/jpeg';
      const imageType = ct.startsWith('image/') ? ct : 'image/jpeg';
      console.log(`[gdocs] S3 image fetched (${s3Info.key.split('/').pop()}, ${Math.round(buf.length / 1024)}KB)`);
      return `data:${imageType};base64,${buf.toString('base64')}`;
    } catch (err) {
      console.warn(`[gdocs] S3 fetch error for ${s3Info.key}: ${err.message}`);
      return null;
    }
  }
  // Non-S3 URL — plain HTTP fetch.
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) { console.warn(`[gdocs] HTTP fetch failed (${res.status}): ${url.slice(0, 80)}…`); return null; }
    const buf = await res.arrayBuffer();
    const ct = res.headers.get('content-type') || 'image/jpeg';
    const imageType = ct.startsWith('image/') ? ct : 'image/jpeg';
    return `data:${imageType};base64,${Buffer.from(buf).toString('base64')}`;
  } catch (err) {
    console.warn(`[gdocs] HTTP fetch error: ${err.message}`);
    return null;
  }
}

/**
 * Collect all image URLs from markdown, download them, and return a Map<url, dataUri>.
 */
async function prefetchImages(markdown) {
  const urlSet = new Set();
  const re = /!\[[^\]]*\]\(([^)\s]+)\)/g;
  let m;
  while ((m = re.exec(markdown)) !== null) {
    urlSet.add(m[1]);
  }
  const map = new Map();
  for (const url of urlSet) {
    const dataUri = await fetchImageAsDataUri(url);
    map.set(url, dataUri);
  }
  console.log(`[gdocs] Pre-fetched ${map.size} image(s) (${[...map.values()].filter(Boolean).length} succeeded)`);
  return map;
}

/**
 * Convert markdown to HTML for import into Google Docs via the Drive API.
 */
async function markdownToHtml(markdown) {
  const imageMap = await prefetchImages(markdown);
  return markdownToHtmlSync(markdown, imageMap);
}

function markdownToHtmlSync(markdown, imageMap) {
  const lines = markdown.split('\n');
  const out = [];
  let inUl = false;
  let inOl = false;

  const closeList = () => {
    if (inUl) { out.push('</ul>'); inUl = false; }
    if (inOl) { out.push('</ol>'); inOl = false; }
  };

  const inlineHtml = (text) => {
    return text
      // Images — use prefetched base64 data URI; fall back to original URL.
      .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, url) => {
        const src = imageMap?.get(url) || url;
        return `<img src="${src}" alt="${esc(alt)}" style="max-width:100%;margin:12px 0;display:block;border-radius:4px;">`;
      })
      // Links
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, linkText, url) =>
        `<a href="${url}">${esc(linkText)}</a>`)
      // Bold **text** or __text__
      .replace(/\*\*([^*]+)\*\*/g, (_, t) => `<strong>${esc(t)}</strong>`)
      .replace(/__([^_]+)__/g, (_, t) => `<strong>${esc(t)}</strong>`)
      // Italic *text* or _text_
      .replace(/\*([^*\n]+)\*/g, (_, t) => `<em>${esc(t)}</em>`)
      .replace(/_([^_\n]+)_/g, (_, t) => `<em>${esc(t)}</em>`)
      // Inline code
      .replace(/`([^`]+)`/g, (_, t) => `<code style="background:#f4f4f4;padding:2px 4px;font-family:monospace;font-size:0.9em">${esc(t)}</code>`);
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      closeList();
      out.push('<hr style="border:none;border-top:2px solid #e0e0e0;margin:16px 0">');
      continue;
    }

    // Headings
    const hMatch = trimmed.match(/^(#{1,6})\s+(.+)/);
    if (hMatch) {
      closeList();
      const level = hMatch[1].length;
      const styles = [
        '', // h0 unused
        'font-size:2em;font-weight:700;color:#1a1a1a;margin:24px 0 8px',
        'font-size:1.5em;font-weight:700;color:#1a1a1a;margin:20px 0 6px',
        'font-size:1.2em;font-weight:700;color:#333;margin:16px 0 4px',
        'font-size:1em;font-weight:700;color:#333;margin:12px 0 4px',
        'font-size:0.9em;font-weight:700;color:#555;margin:8px 0 2px',
        'font-size:0.85em;font-weight:700;color:#555;margin:8px 0 2px'
      ];
      out.push(`<h${level} style="${styles[level]}">${inlineHtml(hMatch[2])}</h${level}>`);
      continue;
    }

    // Unordered list
    const ulMatch = line.match(/^(\s*)[*\-]\s+(.+)/);
    if (ulMatch) {
      if (!inUl) { if (inOl) { out.push('</ol>'); inOl = false; } out.push('<ul style="margin:4px 0;padding-left:24px">'); inUl = true; }
      out.push(`<li style="margin:2px 0">${inlineHtml(ulMatch[2])}</li>`);
      continue;
    }

    // Ordered list
    const olMatch = line.match(/^(\s*)\d+\.\s+(.+)/);
    if (olMatch) {
      if (!inOl) { if (inUl) { out.push('</ul>'); inUl = false; } out.push('<ol style="margin:4px 0;padding-left:24px">'); inOl = true; }
      out.push(`<li style="margin:2px 0">${inlineHtml(olMatch[2])}</li>`);
      continue;
    }

    closeList();

    // Blank line
    if (!trimmed) {
      out.push('<br>');
      continue;
    }

    // Normal paragraph
    out.push(`<p style="margin:4px 0;line-height:1.5">${inlineHtml(trimmed)}</p>`);
  }

  closeList();

  const body = out.join('\n');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.6; color: #1a1a1a; max-width: 800px; margin: 0 auto; padding: 24px; }
  img { max-width: 100%; height: auto; display: block; margin: 12px 0; border-radius: 4px; }
  a { color: #1155cc; }
  code { background: #f4f4f4; padding: 2px 4px; border-radius: 3px; font-family: monospace; font-size: 0.9em; }
  hr { border: none; border-top: 2px solid #e0e0e0; margin: 16px 0; }
  ul, ol { padding-left: 24px; margin: 4px 0; }
  li { margin: 2px 0; }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

/**
 * Create a Google Doc from markdown inside a Shared Drive by uploading HTML
 * and letting Google's importer handle all formatting + image embedding.
 */
export async function createGoogleDocFromMarkdown(title, markdownContent, shareEmails = []) {
  const sharedDriveId = process.env.GDOCS_SHARED_DRIVE_ID || '';
  if (!sharedDriveId) {
    throw new Error(
      'GDOCS_SHARED_DRIVE_ID is not configured. ' +
      'Create a Shared Drive, add automation-ai-first@pambram-automations.iam.gserviceaccount.com ' +
      'as a member, and set GDOCS_SHARED_DRIVE_ID=<driveId> in .env.'
    );
  }

  const jwt = buildJwtClient();
  await jwt.authorize();
  console.log(`[gdocs] JWT authorized`);

  const drive = google.drive({ version: 'v3', auth: jwt });

  // Convert markdown to HTML — Google's importer handles headings, bold, images, links.
  const imageCount = (markdownContent.match(/!\[/g) || []).length;
  console.log(`[gdocs] Converting markdown → HTML (${Math.round(markdownContent.length / 1024)}KB, ${imageCount} images to embed)`);
  const html = await markdownToHtml(markdownContent);
  console.log(`[gdocs] HTML ready (${Math.round(html.length / 1024)}KB, images embedded as base64)`);

  // Upload HTML with conversion to Google Docs format.
  // Single-step: content + metadata in one multipart request, parents set upfront.
  let docId;
  try {
    const driveFile = await drive.files.create({
      supportsAllDrives: true,
      requestBody: {
        name: title,
        mimeType: 'application/vnd.google-apps.document',
        parents: [sharedDriveId]
      },
      media: {
        mimeType: 'text/html',
        body: Readable.from([html])
      },
      fields: 'id'
    });
    docId = driveFile.data.id;
  } catch (err) {
    const detail = err?.response?.data?.error?.message || err.message;
    throw new Error(`drive.files.create (HTML import) failed: ${detail}`);
  }
  console.log(`[gdocs] Created + populated document "${title}" (${docId})`);

  // Share. Try "anyone with link" first; fall back to specific user emails.
  let sharedPublicly = false;
  try {
    await drive.permissions.create({
      fileId: docId,
      supportsAllDrives: true,
      requestBody: { role: 'reader', type: 'anyone' },
      fields: 'id'
    });
    sharedPublicly = true;
    console.log(`[gdocs] Shared as "anyone with link" (reader)`);
  } catch (anyoneErr) {
    const detail = anyoneErr?.response?.data?.error?.message || anyoneErr.message || String(anyoneErr);
    console.warn(`[gdocs] "anyone" sharing blocked (${detail}); falling back to user-level sharing`);

    const emails = shareEmails.length ? shareEmails
      : [process.env.NOTIFY_EMAIL, process.env.SES_FROM_EMAIL].filter(Boolean);
    const deduped = [...new Set(emails)];

    for (const email of deduped) {
      try {
        await drive.permissions.create({
          fileId: docId,
          supportsAllDrives: true,
          requestBody: { role: 'writer', type: 'user', emailAddress: email },
          sendNotificationEmail: false,
          fields: 'id'
        });
        console.log(`[gdocs] Shared with user: ${email}`);
      } catch (userErr) {
        const umsg = userErr?.response?.data?.error?.message || userErr.message || String(userErr);
        console.error(`[gdocs] Failed to share with ${email}: ${umsg}`);
      }
    }
    if (!deduped.length) {
      throw new Error(`Cannot share Google Doc: "anyone" blocked and NOTIFY_EMAIL not set. ${detail}`);
    }
  }

  const docUrl = `https://docs.google.com/document/d/${docId}/edit?usp=sharing`;
  console.log(`[gdocs] Document ready (public=${sharedPublicly}): ${docUrl}`);
  return { docId, docUrl, sharedPublicly };
}
