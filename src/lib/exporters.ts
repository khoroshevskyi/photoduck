// Final export: single 35x45mm photo (300 DPI) and a tiled 10x15cm print sheet.

import type { DocumentPreset } from '../presets/documentPresets';

const DPI = 300;

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type = 'image/jpeg',
  quality = 0.95,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
      type,
      quality,
    );
  });
}

export interface SheetLayout {
  sheetW: number;
  sheetH: number;
  cols: number;
  rows: number;
  cellW: number;
  cellH: number;
  gapX: number;
  gapY: number;
}

/** Pure layout math for the 4x6in print sheet at a given DPI. */
export function sheetLayout(preset: DocumentPreset, sheetDpi: number = DPI): SheetLayout {
  const mmToPx = (mm: number) => Math.round((mm / 25.4) * sheetDpi);
  const sheetW = Math.round(4 * sheetDpi);
  const sheetH = Math.round(6 * sheetDpi);
  const cellW = mmToPx(preset.photoMm.w);
  const cellH = mmToPx(preset.photoMm.h);
  // Fit as many cells as physically possible (epsilon absorbs float rounding on
  // exact fits like 2x2in on 4x6in); leftover space becomes even gaps.
  const cols = Math.max(1, Math.floor(sheetW / cellW + 1e-6));
  const rows = Math.max(1, Math.floor(sheetH / cellH + 1e-6));
  const gapX = (sheetW - cols * cellW) / (cols + 1);
  const gapY = (sheetH - rows * cellH) / (rows + 1);
  return { sheetW, sheetH, cols, rows, cellW, cellH, gapX, gapY };
}

/**
 * Tile copies of the photo on a 4x6 inch sheet with thin cut guides.
 * Rendered at `sheetDpi` so each cell can hold the photo at (near) 1:1 — pass the
 * photo's native DPI to avoid downscaling the copies.
 */
export function renderSheet(
  photo: HTMLCanvasElement,
  preset: DocumentPreset,
  sheetDpi = DPI,
): HTMLCanvasElement {
  const { sheetW, sheetH, cols, rows, cellW, cellH, gapX, gapY } = sheetLayout(preset, sheetDpi);

  const canvas = document.createElement('canvas');
  canvas.width = sheetW;
  canvas.height = sheetH;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, sheetW, sheetH);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = Math.max(1, Math.round(sheetDpi / 300));

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = Math.round(gapX + c * (cellW + gapX));
      const y = Math.round(gapY + r * (cellH + gapY));
      ctx.drawImage(photo, x, y, cellW, cellH);
      ctx.strokeRect(x + 0.5, y + 0.5, cellW, cellH);
    }
  }
  return canvas;
}

export async function downloadCanvas(
  canvas: HTMLCanvasElement,
  filename: string,
  type = 'image/jpeg',
  quality = 0.95,
): Promise<void> {
  const blob = await canvasToBlob(canvas, type, quality);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a tick before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
