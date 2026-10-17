import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { MAX_PHOTOS, MAX_PREPARED_BYTES, MAX_UPLOAD_BYTES, ensurePhotoCount, validatePhotoFiles, base64ByteLength } from '../utils/photoInput';

export async function preparePickerAssets(assets) {
  ensurePhotoCount(assets);
  const prepared = [];
  for (const asset of assets) {
    if (!asset.uri || (asset.fileSize && asset.fileSize > MAX_UPLOAD_BYTES)) throw new Error('Choose a photo smaller than 12 MB.');
    const context = ImageManipulator.manipulate(asset.uri);
    let rendered;
    try {
      if (asset.width > 1600 || asset.height > 1600) context.resize(asset.width >= asset.height ? { width: 1600 } : { height: 1600 });
      rendered = await context.renderAsync();
      const photo = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
      if (Platform.OS === 'web' && photo.uri?.startsWith('blob:')) URL.revokeObjectURL(photo.uri);
      if (!photo.base64 || base64ByteLength(photo.base64) > MAX_PREPARED_BYTES) throw new Error('This photo is still too large. Choose a smaller image.');
      prepared.push({ uri: Platform.OS === 'web' ? `data:image/jpeg;base64,${photo.base64}` : photo.uri, base64: photo.base64, width: photo.width, height: photo.height });
    } finally {
      if (Platform.OS === 'web' && rendered?.uri?.startsWith('blob:')) URL.revokeObjectURL(rendered.uri);
      rendered?.release?.();
      context.release?.();
    }
  }
  return prepared;
}

async function readDroppedFile(file) {
  const uri = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('This image could not be read. Try choosing it again.'));
    reader.readAsDataURL(file);
  });
  const dimensions = await new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error('This file is not a readable JPEG or PNG image.'));
    image.src = uri;
  });
  return { uri, ...dimensions, fileSize: file.size };
}

export default function PhotoPicker({ photos = [], onChange, onError, disabled = false }) {
  const [dropNode, setDropNode] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const live = useRef(true);
  const sequence = useRef(0);
  const current = useRef({ photos, onChange, onError, disabled, busy });
  current.current = { photos, onChange, onError, disabled, busy };
  useEffect(() => { live.current = true; return () => { live.current = false; sequence.current++; }; }, []);

  async function appendAssets(assets, requestId) {
    ensurePhotoCount(assets, current.current.photos.length);
    if (Platform.OS === 'web') {
      const webFiles = assets.map((asset) => asset.file).filter(Boolean);
      if (webFiles.length) validatePhotoFiles(webFiles, current.current.photos.length);
    }
    const prepared = await preparePickerAssets(assets);
    if (!live.current || sequence.current !== requestId || current.current.disabled) return;
    ensurePhotoCount(prepared, current.current.photos.length);
    current.current.onChange([...current.current.photos, ...prepared]);
  }

  async function choose(camera = false) {
    if (disabled || busy || photos.length >= MAX_PHOTOS) return;
    const id = ++sequence.current;
    current.current.onError?.(null);
    try {
      if (camera && Platform.OS !== 'web') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) throw new Error('Camera permission is needed to take a photo. You can also upload one.');
      }
      // Browser pickers must open inside the button's user gesture.
      const result = camera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: MAX_PHOTOS - photos.length, quality: 0.8 });
      if (result.canceled || !live.current || sequence.current !== id) return;
      setBusy(true);
      await appendAssets(result.assets, id);
    } catch (error) {
      if (live.current && sequence.current === id) current.current.onError?.(error.message || 'Could not prepare the photo. Please try again.');
    } finally {
      if (live.current && sequence.current === id) setBusy(false);
    }
  }

  useEffect(() => {
    if (Platform.OS !== 'web' || !dropNode?.addEventListener) return undefined;
    const dragOver = (event) => { event.preventDefault(); if (!current.current.disabled && !current.current.busy) setDragging(true); };
    const dragLeave = () => setDragging(false);
    const drop = async (event) => {
      event.preventDefault();
      event.stopPropagation();
      setDragging(false);
      if (current.current.disabled || current.current.busy) return;
      const id = ++sequence.current;
      setBusy(true);
      current.current.onError?.(null);
      try {
        const files = validatePhotoFiles(event.dataTransfer?.files, current.current.photos.length);
        const assets = await Promise.all(files.map(readDroppedFile));
        await appendAssets(assets, id);
      } catch (error) {
        if (live.current && sequence.current === id) current.current.onError?.(error.message);
      } finally {
        if (live.current && sequence.current === id) setBusy(false);
      }
    };
    dropNode.addEventListener('dragover', dragOver);
    dropNode.addEventListener('dragleave', dragLeave);
    dropNode.addEventListener('drop', drop);
    return () => {
      dropNode.removeEventListener('dragover', dragOver);
      dropNode.removeEventListener('dragleave', dragLeave);
      dropNode.removeEventListener('drop', drop);
    };
  }, [dropNode]);

  const unavailable = disabled || busy || photos.length >= MAX_PHOTOS;
  return <View ref={setDropNode} style={[styles.box, dragging && styles.dragging]}>
    <Text style={styles.heading}>Photos of one plant · {photos.length}/{MAX_PHOTOS}</Text>
    <Text style={styles.hint}>Include the whole plant and clear leaves, flowers or fruit. Up to five photos; each original under 12 MB.{Platform.OS === 'web' ? ' Use JPEG/PNG files. Drag images here or choose Upload photos.' : ' Photos are resized and converted to JPEG for identification.'}</Text>
    {!!photos.length && <View style={styles.photos}>{photos.map((photo, index) => <View key={`${photo.uri}-${index}`} style={styles.photo}>
      <Image source={{ uri: photo.uri }} style={styles.thumbnail} resizeMode="cover" accessibilityLabel={`Plant photo ${index + 1}`} />
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Remove photo ${index + 1}`} disabled={disabled || busy} accessibilityState={{ disabled: disabled || busy }} aria-disabled={disabled || busy} onPress={() => onChange(photos.filter((_, i) => i !== index))} style={styles.remove}><Text style={styles.removeText}>Remove {index + 1}</Text></TouchableOpacity>
    </View>)}</View>}
    {busy && <View style={styles.busy}><ActivityIndicator color="#1e3a1e" /><Text accessibilityLiveRegion="polite" style={styles.hint}>Preparing photos…</Text></View>}
    <View style={styles.buttons}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Take a plant photo" accessibilityState={{ disabled: unavailable }} aria-disabled={unavailable} disabled={unavailable} onPress={() => choose(true)} style={[styles.button, unavailable && styles.disabled]}><Text style={styles.buttonText}>Take photo</Text></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Upload plant photos" accessibilityState={{ disabled: unavailable }} aria-disabled={unavailable} disabled={unavailable} onPress={() => choose(false)} style={[styles.button, styles.filled, unavailable && styles.disabled]}><Text style={[styles.buttonText, styles.lightText]}>Upload photos</Text></TouchableOpacity>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  box: { padding: 16, borderWidth: 1, borderColor: '#b9c3ad', borderStyle: 'dashed', borderRadius: 16, backgroundColor: '#fffdf8', gap: 12 },
  dragging: { backgroundColor: '#e3eedb', borderColor: '#1e3a1e' },
  heading: { color: '#1e3a1e', fontWeight: '700', fontSize: 16 },
  hint: { color: '#646454', fontSize: 13, lineHeight: 20 },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  photo: { width: 120 },
  thumbnail: { width: 120, height: 100, borderRadius: 10 },
  remove: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  removeText: { fontSize: 12, color: '#80452b', textDecorationLine: 'underline' },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  button: { flex: 1, minWidth: 115, minHeight: 48, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#1e3a1e', alignItems: 'center', justifyContent: 'center' },
  filled: { backgroundColor: '#1e3a1e' },
  buttonText: { fontSize: 14, fontWeight: '600', color: '#1e3a1e' },
  lightText: { color: '#fffdf8' },
  disabled: { opacity: 0.45 },
  busy: { flexDirection: 'row', gap: 8, alignItems: 'center' },
});
