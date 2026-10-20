import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { isPhotoFile, photoFromFile } from '../photoFiles';

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  const keepPage = (e) => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); };
  window.addEventListener('dragover', keepPage);
  window.addEventListener('drop', keepPage);
}

export default function usePhotoDrop(id, { ready = true, blocked, room, max, onPhotos, onError }) {
  const [dragging, setDragging] = useState(false);
  const latest = useRef({});
  latest.current = { blocked, room, max, onPhotos, onError };

  useEffect(() => {
    if (Platform.OS !== 'web' || !ready) return undefined;
    const el = document.getElementById(id);
    if (!el) return undefined;
    let active = true;

    const onDragOver = (e) => {
      e.preventDefault(); e.stopPropagation();
      const open = !latest.current.blocked && latest.current.room > 0;
      if (e.dataTransfer) e.dataTransfer.dropEffect = open ? 'copy' : 'none';
      if (open) setDragging(true);
    };
    const onDragLeave = (e) => {
      if (e.relatedTarget && el.contains(e.relatedTarget)) return;
      setDragging(false);
    };
    const onDrop = async (e) => {
      e.preventDefault(); e.stopPropagation();
      setDragging(false);
      const { blocked, room, max, onPhotos, onError } = latest.current;
      if (blocked) return;
      if (room <= 0) { onError(`This plant has ${max} photos. Remove one to add another.`); return; }
      const files = [...(e.dataTransfer?.files ?? [])].filter(isPhotoFile);
      if (files.length === 0) { onError('Choose an image file to add a photo.'); return; }
      try {
        const photos = await Promise.all(files.slice(0, room).map(photoFromFile));
        if (active) onPhotos(photos, files.length > room);
      } catch {
        if (active) onError('Could not read that photo. Try choosing it again.');
      }
    };

    el.addEventListener('dragover', onDragOver);
    el.addEventListener('dragleave', onDragLeave);
    el.addEventListener('drop', onDrop);
    return () => {
      active = false;
      el.removeEventListener('dragover', onDragOver);
      el.removeEventListener('dragleave', onDragLeave);
      el.removeEventListener('drop', onDrop);
    };
  }, [id, ready]);

  return dragging;
}
