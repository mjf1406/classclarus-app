/**
 * Shared upload preset definitions.
 * No Convex imports — safe to import from `src/` (same pattern as authzModel).
 */

import { APP_CONFIG } from "../appConfig.js";
import { isDocxOoxml } from "./zipEntries.js";

export const UPLOAD_PRESET_KEYS = ["images", "documents", "audio"] as const;

export type UploadPresetKey = (typeof UPLOAD_PRESET_KEYS)[number];

/** Presets accepted by finalize/register. DOCX requires OOXML ZIP entry checks. */
export const ENABLED_UPLOAD_PRESETS = ["images", "documents", "audio"] as const;

export type EnabledUploadPresetKey = (typeof ENABLED_UPLOAD_PRESETS)[number];

export type UploadPresetDefinition = {
  key: UploadPresetKey;
  allowedMimeTypes: readonly string[];
  allowedExtensions: readonly string[];
  maxSizeBytes: number;
};

export const UPLOAD_PRESET_DEFINITIONS: Record<UploadPresetKey, UploadPresetDefinition> = {
  images: {
    key: "images",
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/avif",
      "image/x-icon",
      "image/vnd.microsoft.icon",
    ],
    allowedExtensions: [".jpg", ".jpeg", ".png", ".webp", ".avif", ".ico"],
    maxSizeBytes: APP_CONFIG.uploads.maxSizeBytes.images,
  },
  documents: {
    key: "documents",
    allowedMimeTypes: [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ],
    allowedExtensions: [".pdf", ".docx", ".txt"],
    maxSizeBytes: APP_CONFIG.uploads.maxSizeBytes.documents,
  },
  audio: {
    key: "audio",
    allowedMimeTypes: [
      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
      "audio/x-wav",
      "audio/ogg",
      "audio/flac",
      "audio/mp4",
      "audio/m4a",
      "audio/aac",
    ],
    allowedExtensions: [".mp3", ".wav", ".ogg", ".flac", ".m4a", ".aac", ".mp4"],
    maxSizeBytes: APP_CONFIG.uploads.maxSizeBytes.audio,
  },
};

export function isUploadPresetKey(value: string): value is UploadPresetKey {
  return (UPLOAD_PRESET_KEYS as ReadonlyArray<string>).includes(value);
}

export function isEnabledUploadPreset(value: string): value is EnabledUploadPresetKey {
  return (ENABLED_UPLOAD_PRESETS as ReadonlyArray<string>).includes(value);
}

export function getUploadPresetDefinition(presetKey: UploadPresetKey): UploadPresetDefinition {
  return UPLOAD_PRESET_DEFINITIONS[presetKey];
}

/**
 * Validate size and MIME against a preset.
 * Returns an error code string when invalid, otherwise null.
 */
export function validateUploadAgainstPreset(
  presetKey: UploadPresetKey,
  opts: { size: number; contentType: string | undefined },
): "invalid_size" | "invalid_type" | null {
  const preset = UPLOAD_PRESET_DEFINITIONS[presetKey];
  if (opts.size > preset.maxSizeBytes) {
    return "invalid_size";
  }
  const contentType = opts.contentType?.toLowerCase().split(";")[0]?.trim();
  if (!contentType || !preset.allowedMimeTypes.includes(contentType)) {
    return "invalid_type";
  }
  return null;
}

function startsWithBytes(bytes: Uint8Array, signature: readonly number[]): boolean {
  if (bytes.length < signature.length) {
    return false;
  }
  for (let i = 0; i < signature.length; i += 1) {
    if (bytes[i] !== signature[i]) {
      return false;
    }
  }
  return true;
}

function isAsciiText(bytes: Uint8Array): boolean {
  if (bytes.length === 0) {
    return false;
  }
  const sample = bytes.subarray(0, Math.min(bytes.length, 512));
  for (const byte of sample) {
    // Allow tab, LF, CR, and printable ASCII.
    if (byte === 0x09 || byte === 0x0a || byte === 0x0d) {
      continue;
    }
    if (byte < 0x20 || byte > 0x7e) {
      return false;
    }
  }
  return true;
}

/**
 * Detect content type from leading magic bytes.
 * Returns null when the payload does not match a known safe signature.
 */
export function detectContentType(bytes: Uint8Array): string | null {
  if (bytes.length === 0) {
    return null;
  }

  // JPEG
  if (startsWithBytes(bytes, [0xff, 0xd8, 0xff])) {
    return "image/jpeg";
  }
  // PNG
  if (startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  // WEBP: RIFF....WEBP
  if (
    startsWithBytes(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytes.length >= 12 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  // AVIF / HEIF brand in ftyp box
  if (
    bytes.length >= 12 &&
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  ) {
    const brand = String.fromCharCode(bytes[8]!, bytes[9]!, bytes[10]!, bytes[11]!);
    if (brand === "avif" || brand === "avis") {
      return "image/avif";
    }
    if (
      brand === "M4A " ||
      brand === "M4B " ||
      brand === "mp42" ||
      brand === "isom" ||
      brand === "iso2"
    ) {
      return "audio/mp4";
    }
  }
  // ICO
  if (startsWithBytes(bytes, [0x00, 0x00, 0x01, 0x00])) {
    return "image/x-icon";
  }
  // PDF
  if (startsWithBytes(bytes, [0x25, 0x50, 0x44, 0x46])) {
    return "application/pdf";
  }
  // DOCX (OOXML): require [Content_Types].xml + word/ — bare ZIP rejected.
  if (
    startsWithBytes(bytes, [0x50, 0x4b, 0x03, 0x04]) ||
    startsWithBytes(bytes, [0x50, 0x4b, 0x05, 0x06])
  ) {
    if (isDocxOoxml(bytes)) {
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    }
    return null;
  }
  // WAV: RIFF....WAVE
  if (
    startsWithBytes(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytes.length >= 12 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x41 &&
    bytes[10] === 0x56 &&
    bytes[11] === 0x45
  ) {
    return "audio/wav";
  }
  // FLAC
  if (startsWithBytes(bytes, [0x66, 0x4c, 0x61, 0x43])) {
    return "audio/flac";
  }
  // OGG
  if (startsWithBytes(bytes, [0x4f, 0x67, 0x67, 0x53])) {
    return "audio/ogg";
  }
  // MP3: ID3 tag or frame sync
  if (startsWithBytes(bytes, [0x49, 0x44, 0x33])) {
    return "audio/mpeg";
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0) {
    return "audio/mpeg";
  }
  // Plain text (conservative ASCII sample)
  if (isAsciiText(bytes)) {
    return "text/plain";
  }

  return null;
}

/**
 * Validate detected magic-byte content type against a preset.
 * Prefer the detected type over any client-declared Content-Type.
 */
export function validateDetectedContentType(
  presetKey: UploadPresetKey,
  detected: string | null,
): "invalid_content" | null {
  if (!detected) {
    return "invalid_content";
  }
  const preset = UPLOAD_PRESET_DEFINITIONS[presetKey];
  const normalized = detected.toLowerCase();
  if (!preset.allowedMimeTypes.includes(normalized)) {
    // Allow icon alias
    if (
      normalized === "image/x-icon" &&
      preset.allowedMimeTypes.includes("image/vnd.microsoft.icon")
    ) {
      return null;
    }
    if (
      normalized === "image/vnd.microsoft.icon" &&
      preset.allowedMimeTypes.includes("image/x-icon")
    ) {
      return null;
    }
    // audio/mpeg aliases
    if (
      (normalized === "audio/mpeg" || normalized === "audio/mp3") &&
      (preset.allowedMimeTypes.includes("audio/mpeg") ||
        preset.allowedMimeTypes.includes("audio/mp3"))
    ) {
      return null;
    }
    // wav aliases
    if (
      (normalized === "audio/wav" || normalized === "audio/x-wav") &&
      (preset.allowedMimeTypes.includes("audio/wav") ||
        preset.allowedMimeTypes.includes("audio/x-wav"))
    ) {
      return null;
    }
    return "invalid_content";
  }
  return null;
}
