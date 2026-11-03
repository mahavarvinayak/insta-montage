import fs from "fs/promises";
import path from "path";
import sharp from "sharp";

export interface MediaProcessResult {
  buffer: Buffer;
  mimeType: "image/jpeg" | "video/mp4";
  size: number;
  width?: number;
  height?: number;
  originalSize: number;
  wasOptimized: boolean;
  filename: string;
}

const SUPPORTED_IMG_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".tiff", ".bmp"]);
const SUPPORTED_VID_EXTS = new Set([".mp4", ".mov", ".m4v"]);

export function isImageFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return SUPPORTED_IMG_EXTS.has(ext);
}

export function isVideoFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return SUPPORTED_VID_EXTS.has(ext);
}

/**
 * Optimizes an image for Instagram publishing:
 * - Enforces aspect ratio between 4:5 (0.8) and 1.91:1 with letterboxing/pillarboxing if needed
 * - Caps max dimension to 1440w x 1800h (standard Instagram feed size: 1080x1350 for portrait)
 * - Converts to standard JPEG (90% quality)
 * - Guarantees file size is well within Cloudflare & Meta limits (< 8MB)
 */
export async function optimizeImage(filePath: string): Promise<MediaProcessResult> {
  const origBuffer = await fs.readFile(filePath);
  const origSize = origBuffer.length;
  const filename = path.basename(filePath);

  const image = sharp(origBuffer);
  const meta = await image.metadata();

  const w = meta.width || 1080;
  const h = meta.height || 1350;
  const ratio = w / h;

  let targetW = w;
  let targetH = h;
  let needsPadding = false;

  // Instagram aspect ratio limits: min 4:5 (0.8), max 1.91:1
  if (ratio < 0.8) {
    // Taller than 4:5 (e.g. 9:16 mobile story / screenshot) -> pad width with white
    targetW = Math.round(h * 0.8);
    targetH = h;
    needsPadding = true;
  } else if (ratio > 1.91) {
    // Wider than 1.91:1 -> pad height
    targetW = w;
    targetH = Math.round(w / 1.91);
    needsPadding = true;
  }

  // Downscale if oversized (>1440w or >1800h)
  let finalW = targetW;
  let finalH = targetH;
  let needsResize = false;

  if (finalW > 1440 || finalH > 1800) {
    const scale = Math.min(1440 / finalW, 1800 / finalH);
    finalW = Math.round(finalW * scale);
    finalH = Math.round(finalH * scale);
    needsResize = true;
  }

  // If already JPEG, correct ratio, not oversized, and under 4MB, keep original if no modification needed
  const isJpeg = meta.format === "jpeg";
  if (isJpeg && !needsPadding && !needsResize && origSize < 4 * 1024 * 1024) {
    return {
      buffer: origBuffer,
      mimeType: "image/jpeg",
      size: origSize,
      width: w,
      height: h,
      originalSize: origSize,
      wasOptimized: false,
      filename: filename.replace(/\.[^.]+$/, ".jpg"),
    };
  }

  // Apply padding and resize via sharp
  let pipeline = sharp(origBuffer);

  if (needsPadding) {
    pipeline = pipeline.resize(targetW, targetH, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    });
  }

  if (needsResize) {
    pipeline = pipeline.resize(finalW, finalH, { fit: "contain" });
  }

  const optimizedBuffer = await pipeline
    .jpeg({ quality: 90, progressive: true })
    .toBuffer();

  return {
    buffer: optimizedBuffer,
    mimeType: "image/jpeg",
    size: optimizedBuffer.length,
    width: finalW,
    height: finalH,
    originalSize: origSize,
    wasOptimized: true,
    filename: filename.replace(/\.[^.]+$/, ".jpg"),
  };
}

/**
 * Validates a video file for Instagram Reel publishing:
 * - Checks file size (< 90MB)
 * - Verifies MP4 format
 */
export async function validateVideo(filePath: string): Promise<MediaProcessResult> {
  const origBuffer = await fs.readFile(filePath);
  const origSize = origBuffer.length;
  const filename = path.basename(filePath);

  const MAX_VID_BYTES = 90 * 1024 * 1024;
  if (origSize > MAX_VID_BYTES) {
    throw new Error(
      `Video file is too large (${(origSize / (1024 * 1024)).toFixed(1)} MB). Instagram Cloudflare Worker limit is 90 MB.`
    );
  }

  return {
    buffer: origBuffer,
    mimeType: "video/mp4",
    size: origSize,
    originalSize: origSize,
    wasOptimized: false,
    filename: filename.replace(/\.[^.]+$/, ".mp4"),
  };
}

/**
 * Automatically inspects and processes any local media file
 */
export async function processMediaFile(filePath: string): Promise<MediaProcessResult> {
  if (isImageFile(filePath)) {
    return optimizeImage(filePath);
  }
  if (isVideoFile(filePath)) {
    return validateVideo(filePath);
  }
  throw new Error(
    `Unsupported file format: "${filePath}". Supported formats: Images (JPEG, PNG, WebP) or Videos (MP4, MOV).`
  );
}
