// Load a user file into a decoded HTMLImageElement. Modern browsers apply EXIF
// orientation automatically when decoding and when drawing to canvas.

import type { Size } from '../types';

export interface LoadedImage {
  image: HTMLImageElement;
  size: Size;
}

const ACCEPTED = /^image\/(jpeg|png|webp|heic|heif)$/i;

export async function loadImageFile(file: File): Promise<LoadedImage> {
  if (file.type && !ACCEPTED.test(file.type)) {
    throw new Error('Please choose a JPEG, PNG or WebP image.');
  }
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
  try {
    await image.decode();
  } catch {
    throw new Error('Could not read this image. Try a different file.');
  }
  const size: Size = { w: image.naturalWidth, h: image.naturalHeight };
  if (size.w < 300 || size.h < 300) {
    // Not fatal, but warn-worthy — surfaced by the resolution compliance check.
    console.warn('[loadImageFile] low resolution source:', size);
  }
  return { image, size };
}
