const HEIC_TYPE = /^image\/hei[cf]/i;
const HEIC_NAME = /\.hei[cf]$/i;

function isHeic(type, name) {
  return HEIC_TYPE.test(type ?? '') || HEIC_NAME.test(name ?? '');
}

export function isPhotoFile(file) {
  return file.type.startsWith('image/') || isHeic(file.type, file.name);
}

function readPhoto(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ uri: reader.result, base64: reader.result.split(',')[1] });
    reader.onerror = () => reject(new Error('Photo could not be read'));
    reader.readAsDataURL(blob);
  });
}

async function toJpeg(blob) {
  const { heicTo } = await import('heic-to');
  return heicTo({ blob, type: 'image/jpeg', quality: 0.85 });
}

export async function photoFromFile(file) {
  return readPhoto(isHeic(file.type, file.name) ? await toJpeg(file) : file);
}

export function pickPhotos(room) {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.heic,.heif';
    input.multiple = room > 1;
    input.addEventListener('cancel', () => resolve(null));
    input.addEventListener('change', async () => {
      const files = [...(input.files ?? [])].filter(isPhotoFile);
      if (files.length === 0) { resolve(null); return; }
      try {
        resolve({ photos: await Promise.all(files.slice(0, room).map(photoFromFile)), extra: files.length > room });
      } catch (err) {
        reject(err);
      }
    });
    input.click();
  });
}
