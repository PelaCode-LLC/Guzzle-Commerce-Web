/**
 * Object storage service backed by Cloudflare R2 (S3-compatible).
 *
 * When R2 env vars are not set the service falls back to local disk so that
 * local development continues to work without any credentials.
 */

const path = require('path');
const fs = require('fs');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

// ──────────────────────────────────────────────
// Configuration
// ──────────────────────────────────────────────

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.R2_BUCKET;
// Public URL prefix for the bucket – either the r2.dev subdomain or a custom domain.
// e.g. https://pub-abc123.r2.dev  or  https://cdn.yourdomain.com
const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');

const useR2 =
  Boolean(R2_ACCOUNT_ID) &&
  Boolean(R2_ACCESS_KEY_ID) &&
  Boolean(R2_SECRET_ACCESS_KEY) &&
  Boolean(R2_BUCKET) &&
  Boolean(R2_PUBLIC_URL);

// Warn in production if R2 is not configured – uploads will be lost on redeploy.
if (process.env.NODE_ENV === 'production' && !useR2) {
  console.warn(
    '⚠️  R2 storage is not configured. File uploads will be written to local disk ' +
      'and WILL be lost on redeploy. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, ' +
      'R2_SECRET_ACCESS_KEY, R2_BUCKET, and R2_PUBLIC_URL.'
  );
}

// ──────────────────────────────────────────────
// S3 client (R2 endpoint)
// ──────────────────────────────────────────────

let s3Client = null;

if (useR2) {
  s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
}

// ──────────────────────────────────────────────
// Local disk fallback helpers
// ──────────────────────────────────────────────

const LOCAL_UPLOADS_DIR = path.join(__dirname, '../../uploads');

const ensureDir = dirPath => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

/**
 * Upload a file buffer to Cloudflare R2 or local disk.
 *
 * @param {Object} params
 * @param {Buffer} params.buffer       - File content
 * @param {string} params.key          - Storage path/key, e.g. "avatars/avatar-1-168000.jpg"
 * @param {string} params.mimeType     - MIME type, e.g. "image/jpeg"
 * @returns {Promise<string>}          - Public URL of the uploaded file
 */
const uploadFile = async ({ buffer, key, mimeType }) => {
  if (useR2) {
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      // Files should be publicly readable via the R2 public URL
      CacheControl: 'public, max-age=31536000, immutable',
    });

    await s3Client.send(command);
    return `${R2_PUBLIC_URL}/${key}`;
  }

  // ── Local disk fallback ──
  const fullPath = path.join(LOCAL_UPLOADS_DIR, key);
  ensureDir(path.dirname(fullPath));
  fs.writeFileSync(fullPath, buffer);
  // Return a relative URL that the Express static middleware serves
  return `/uploads/${key}`;
};

/**
 * Delete a file from R2 or local disk.
 *
 * @param {string} key - Storage key used when the file was uploaded
 * @returns {Promise<void>}
 */
const deleteFile = async key => {
  if (useR2) {
    const command = new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key });
    await s3Client.send(command);
    return;
  }

  // ── Local disk fallback ──
  const fullPath = path.join(LOCAL_UPLOADS_DIR, key);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }
};

/**
 * Given a public URL that was returned by uploadFile, derive the storage key.
 * Returns null if the URL cannot be parsed.
 *
 * @param {string} publicUrl
 * @returns {string|null}
 */
const keyFromUrl = publicUrl => {
  if (!publicUrl) return null;

  if (useR2 && R2_PUBLIC_URL && publicUrl.startsWith(R2_PUBLIC_URL)) {
    return publicUrl.slice(R2_PUBLIC_URL.length + 1); // strip leading slash
  }

  // Local fallback: /uploads/avatars/avatar-1.jpg → avatars/avatar-1.jpg
  const match = publicUrl.match(/^\/uploads\/(.+)$/);
  return match ? match[1] : null;
};

module.exports = { uploadFile, deleteFile, keyFromUrl, useR2 };
