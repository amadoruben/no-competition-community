/** Browser-side photo preparation, shared by the feed composer and stories. */

export const MAX_SIDE = 1600;

export type Photo = { blob: Blob; url: string; width: number; height: number };

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) return createImageBitmap(file, { imageOrientation: "from-image" });
  const img = new Image();
  img.src = URL.createObjectURL(file);
  await img.decode();
  return img;
}

/** Resizes in the browser (long side ≤ 1600 px, JPEG) so uploads are small and orientation is applied. */
export async function preparePhoto(file: File): Promise<Photo> {
  const src = await decode(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(src.width, src.height));
  const width = Math.max(1, Math.round(src.width * scale));
  const height = Math.max(1, Math.round(src.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff"; // transparent PNGs get a white background, not black
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(src, 0, 0, width, height);
  if ("close" in src) src.close();
  const encode = (q: number) => new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", q));
  let blob = await encode(0.85);
  if (blob && blob.size > 1.8 * 1024 * 1024) blob = await encode(0.7);
  if (!blob) throw new Error("encode");
  return { blob, url: URL.createObjectURL(blob), width, height };
}
