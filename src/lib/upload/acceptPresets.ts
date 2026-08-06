import {
  getUploadPresetDefinition,
  type UploadPresetKey,
  UPLOAD_PRESET_DEFINITIONS,
} from "../../../convex/lib/uploadPresets";

export type { UploadPresetKey };

export type UploadPreset = {
  key: UploadPresetKey;
  accept: string;
  allowedExtensions: readonly string[];
  maxSizeBytes: number;
  descriptionKey: string;
  buttonLabelKey: string;
};

const UI_KEYS: Record<UploadPresetKey, { descriptionKey: string; buttonLabelKey: string }> = {
  images: { descriptionKey: "supportsImages", buttonLabelKey: "selectImages" },
  documents: { descriptionKey: "supportsDocuments", buttonLabelKey: "selectDocuments" },
  audio: { descriptionKey: "supportsAudio", buttonLabelKey: "selectAudio" },
};

function toUiPreset(key: UploadPresetKey): UploadPreset {
  const def = getUploadPresetDefinition(key);
  const ui = UI_KEYS[key];
  return {
    key,
    accept: def.allowedMimeTypes.join(","),
    allowedExtensions: def.allowedExtensions,
    maxSizeBytes: def.maxSizeBytes,
    descriptionKey: ui.descriptionKey,
    buttonLabelKey: ui.buttonLabelKey,
  };
}

export const UPLOAD_PRESETS: Record<UploadPresetKey, UploadPreset> = {
  images: toUiPreset("images"),
  documents: toUiPreset("documents"),
  audio: toUiPreset("audio"),
};

export function getUploadPreset(presetKey: UploadPresetKey): UploadPreset {
  return UPLOAD_PRESETS[presetKey];
}

/** Re-export definitions for callers that need MIME lists. */
export { UPLOAD_PRESET_DEFINITIONS };
