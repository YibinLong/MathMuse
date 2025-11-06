import type { RefObject } from 'react';
import type { SkiaDomView, SkImage } from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';

export type ExportResult = {
  bytes: Uint8Array;
  fileUri: string;
  width: number;
  height: number;
};

function encodeImageToBytes(image: SkImage | null): Uint8Array {
  if (!image) throw new Error('No image to encode');
  const bytes = image.encodeToBytes();
  if (!bytes || bytes.byteLength === 0) throw new Error('Failed to encode image');
  return bytes;
}

export async function snapshotCanvasToPng(
  canvasRef: RefObject<SkiaDomView>,
  opts?: { filename?: string }
): Promise<ExportResult> {
  const image = await canvasRef.current?.makeImageSnapshotAsync();
  if (!image) throw new Error('Snapshot failed');
  const bytes = encodeImageToBytes(image);
  const name = opts?.filename ?? `mm-step-${Date.now()}.png`;
  const file = new File(Paths.cache, name);
  file.write(bytes);
  return { bytes, fileUri: file.uri, width: image.width(), height: image.height() };
}


