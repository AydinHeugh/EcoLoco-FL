export const MAX_PHOTOS = 5;
export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
export const MAX_PREPARED_BYTES = 4 * 1024 * 1024;

export function ensurePhotoCount(photos, existingCount = 0) {
  if (!photos?.length) throw new Error('Choose at least one photo of the plant.');
  if (photos.length + existingCount > MAX_PHOTOS) throw new Error('Use up to five photos of the same plant. Remove a photo before adding another.');
}

export function validatePhotoFiles(files, existingCount = 0) {
  const chosen = Array.from(files || []);
  ensurePhotoCount(chosen, existingCount);
  for (const file of chosen) {
    if (!['image/jpeg', 'image/png'].includes(file.type)) throw new Error('Choose JPEG or PNG images. Export HEIC photos as JPEG before uploading in a browser.');
    if (!Number.isFinite(file.size) || file.size <= 0 || file.size > MAX_UPLOAD_BYTES) throw new Error('Each original photo must be a nonempty image smaller than 12 MB.');
  }
  return chosen;
}

export function base64ByteLength(value) {
  const data = String(value || '').replace(/^data:[^,]+,/, '');
  const padding = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor(data.length * 3 / 4) - padding);
}
