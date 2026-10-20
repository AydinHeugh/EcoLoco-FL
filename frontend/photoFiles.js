import * as ImagePicker from 'expo-image-picker';

export function isPhotoFile() {
  return false;
}

export async function photoFromFile() {
  throw new Error('Dropping files only works on the web');
}

export async function pickPhotos(room) {
  const res = await ImagePicker.launchImageLibraryAsync({
    base64: true, quality: 0.8, allowsMultipleSelection: room > 1, selectionLimit: room,
  });
  if (res.canceled) return null;
  return { photos: res.assets.slice(0, room).map(a => ({ uri: a.uri, base64: a.base64 })), extra: res.assets.length > room };
}
