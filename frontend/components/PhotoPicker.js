import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { useFonts } from 'expo-font';
import { DMSans_400Regular } from '@expo-google-fonts/dm-sans/400Regular';
import { DMSans_700Bold } from '@expo-google-fonts/dm-sans/700Bold';
import Ionicons from '@expo/vector-icons/Ionicons';
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
  const [fontsLoaded] = useFonts({ DMSans_400Regular, DMSans_700Bold });
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
  const removePhoto = (index) => onChange(photos.filter((_, i) => i !== index));
  return <View ref={setDropNode} style={[styles.box, dragging && styles.dragging]}>
    <View style={styles.caption}><Text style={[styles.hint, fontsLoaded && styles.sans]}>Up to 5 photos of the same plant.</Text><Text style={[styles.count, fontsLoaded && styles.sans]}>{photos.length}/{MAX_PHOTOS}</Text></View>
    <View style={styles.lead}>
      {photos.length ? <><Image source={{ uri: photos[0].uri }} style={styles.leadImage} resizeMode="cover" accessibilityLabel="Plant photo 1" />
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Remove photo 1" disabled={disabled || busy} accessibilityState={{ disabled: disabled || busy }} aria-disabled={disabled || busy} onPress={() => removePhoto(0)} style={[styles.remove, styles.leadRemove]}><Ionicons name="close" size={20} color="#1e3a1e" /></TouchableOpacity></>
        : <View style={styles.empty}><Ionicons name={dragging ? 'download-outline' : 'leaf-outline'} size={42} color="#7d9272" /><Text style={[styles.emptyText, fontsLoaded && styles.sans]}>{dragging ? 'Drop photos here' : 'Add a plant photo'}</Text></View>}
    </View>
    {photos.length > 1 && <View style={styles.photos}>{photos.slice(1).map((photo, index) => <View key={`${photo.uri}-${index}`} style={styles.photo}>
      <Image source={{ uri: photo.uri }} style={styles.thumbnail} resizeMode="cover" accessibilityLabel={`Plant photo ${index + 2}`} />
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Remove photo ${index + 2}`} disabled={disabled || busy} accessibilityState={{ disabled: disabled || busy }} aria-disabled={disabled || busy} onPress={() => removePhoto(index + 1)} style={styles.remove}><Ionicons name="close" size={16} color="#1e3a1e" /></TouchableOpacity>
    </View>)}</View>}
    {busy && <View style={styles.busy}><ActivityIndicator color="#1e3a1e" /><Text accessibilityLiveRegion="polite" style={[styles.hint, fontsLoaded && styles.sans]}>Preparing photos…</Text></View>}
    <View style={styles.buttons}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Take a plant photo" accessibilityState={{ disabled: unavailable }} aria-disabled={unavailable} disabled={unavailable} onPress={() => choose(true)} style={[styles.button, styles.filled, unavailable && styles.disabled]}><Ionicons name="camera-outline" size={20} color="#fffdf8" /><Text style={[styles.buttonText, styles.lightText, fontsLoaded && styles.sansBold]}>Take photo</Text></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Upload plant photos" accessibilityState={{ disabled: unavailable }} aria-disabled={unavailable} disabled={unavailable} onPress={() => choose(false)} style={[styles.button, unavailable && styles.disabled]}><Ionicons name="image-outline" size={20} color="#1e3a1e" /><Text style={[styles.buttonText, fontsLoaded && styles.sansBold]}>Upload</Text></TouchableOpacity>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  box: { gap: 12 },
  dragging: { backgroundColor: '#e3eedb', borderColor: '#1e3a1e' },
  sans: { fontFamily: 'DMSans_400Regular' }, sansBold: { fontFamily: 'DMSans_700Bold' },
  caption: { flexDirection: 'row', gap: 8, justifyContent: 'space-between', alignItems: 'center' },
  hint: { color: '#646454', fontSize: 12, lineHeight: 19, flexShrink: 1 }, count: { color: '#646454', fontSize: 12 },
  lead: { width: '100%', height: 260, borderRadius: 16, backgroundColor: '#eaeee6', overflow: 'hidden', borderWidth: 1, borderColor: '#d9dfd2' },
  leadImage: { width: '100%', height: '100%' }, empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }, emptyText: { fontSize: 14, color: '#646454' },
  photos: { flexDirection: 'row', gap: 10 }, photo: { flex: 1, maxWidth: 96, height: 76, borderRadius: 10, overflow: 'hidden' },
  thumbnail: { width: '100%', height: '100%' },
  remove: { position: 'absolute', top: 0, right: 0, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,253,248,0.92)', borderBottomLeftRadius: 12 }, leadRemove: { top: 8, right: 8, borderRadius: 22 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  button: { flex: 1, minWidth: 115, minHeight: 48, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#1e3a1e', flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  filled: { backgroundColor: '#1e3a1e' },
  buttonText: { fontSize: 14, fontWeight: '600', color: '#1e3a1e' },
  lightText: { color: '#fffdf8' },
  disabled: { opacity: 0.45 },
  busy: { flexDirection: 'row', gap: 8, alignItems: 'center' },
});
