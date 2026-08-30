import { z } from "zod";

import type { AudioCues } from "./audioCues.js";

export const MAX_ROTATION_NAME_LENGTH = 120;
export const MAX_ROTATION_DURATION_SECONDS = 24 * 60 * 60;
export const MAX_ROTATION_COUNT = 48;
export const DEFAULT_ROTATION_DURATION_SECONDS = 300;
export const DEFAULT_TRANSITION_DURATION_SECONDS = 30;
export const DEFAULT_NUMBER_OF_ROTATIONS = 4;
export const DEFAULT_ROTATION_BG_COLOR = "#1e40af";
export const DEFAULT_TRANSITION_BG_COLOR = "#6b7280";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export type DurationUnit = "seconds" | "minutes";

export type RotationFormMessages = {
  nameRequired: string;
  nameTooLong: string;
  durationInvalid: string;
  transitionDurationInvalid: string;
  countInvalid: string;
  colorInvalid: string;
};

export const ROTATION_FORM_MESSAGES_EN: RotationFormMessages = {
  nameRequired: "Name is required",
  nameTooLong: `Name must be at most ${MAX_ROTATION_NAME_LENGTH} characters`,
  durationInvalid: "Rotation duration must be between 1 second and 24 hours",
  transitionDurationInvalid: "Transition duration must be between 0 seconds and 24 hours",
  countInvalid: `Number of rotations must be a whole number from 1 to ${MAX_ROTATION_COUNT}`,
  colorInvalid: "Choose a valid color",
};

export type RotationInput = {
  name: string;
  rotationDurationSeconds: number;
  numberOfRotations: number;
  transitionDurationSeconds: number;
  rotationBgColor: string;
  transitionBgColor: string;
  finalTransition: boolean;
  bgTransition?: string;
  audioCues?: AudioCues;
  workCues?: AudioCues;
  transitionCues?: AudioCues;
};

export type RotationFormValues = {
  name: string;
  rotationDuration: string;
  rotationDurationUnit: DurationUnit;
  numberOfRotations: number;
  transitionDuration: string;
  transitionDurationUnit: DurationUnit;
  rotationBgColor: string;
  transitionBgColor: string;
  finalTransition: boolean;
  bgTransition: string;
  audioCues: AudioCues;
  workCues: AudioCues;
  transitionCues: AudioCues;
};

function durationToSeconds(value: string, unit: DurationUnit): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return Number.NaN;
  return unit === "minutes" ? Math.round(numeric * 60) : Math.round(numeric);
}

const audioCuesSchema = z.custom<AudioCues>(
  (value) => value === undefined || (typeof value === "object" && value !== null),
);

export function createRotationInputSchema(messages: RotationFormMessages) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, messages.nameRequired)
      .max(MAX_ROTATION_NAME_LENGTH, messages.nameTooLong),
    rotationDurationSeconds: z
      .number()
      .int(messages.durationInvalid)
      .min(1, messages.durationInvalid)
      .max(MAX_ROTATION_DURATION_SECONDS, messages.durationInvalid),
    numberOfRotations: z
      .number()
      .int(messages.countInvalid)
      .min(1, messages.countInvalid)
      .max(MAX_ROTATION_COUNT, messages.countInvalid),
    transitionDurationSeconds: z
      .number()
      .int(messages.transitionDurationInvalid)
      .min(0, messages.transitionDurationInvalid)
      .max(MAX_ROTATION_DURATION_SECONDS, messages.transitionDurationInvalid),
    rotationBgColor: z.string().regex(HEX_COLOR, messages.colorInvalid),
    transitionBgColor: z.string().regex(HEX_COLOR, messages.colorInvalid),
    finalTransition: z.boolean(),
    bgTransition: z.string().trim().min(1).optional(),
    audioCues: audioCuesSchema.optional(),
    workCues: audioCuesSchema.optional(),
    transitionCues: audioCuesSchema.optional(),
  });
}

export function createRotationFormSchema(messages: RotationFormMessages) {
  const inputSchema = createRotationInputSchema(messages);
  return z
    .object({
      name: z.string(),
      rotationDuration: z.string(),
      rotationDurationUnit: z.enum(["seconds", "minutes"]),
      numberOfRotations: z.number(),
      transitionDuration: z.string(),
      transitionDurationUnit: z.enum(["seconds", "minutes"]),
      rotationBgColor: z.string(),
      transitionBgColor: z.string(),
      finalTransition: z.boolean(),
      bgTransition: z.string(),
      audioCues: audioCuesSchema,
      workCues: audioCuesSchema,
      transitionCues: audioCuesSchema,
    })
    .superRefine((value, ctx) => {
      const parsed = inputSchema.safeParse(toRotationInput(value));
      if (parsed.success) return;
      for (const issue of parsed.error.issues) {
        const rawPath = issue.path[0];
        const path = mapInputPathToFormPath(
          typeof rawPath === "string" || typeof rawPath === "number" ? rawPath : undefined,
        );
        ctx.addIssue({
          code: "custom",
          message: issue.message,
          path: [path],
        });
      }
    })
    .transform((value) => toRotationInput(value));
}

function toRotationInput(value: RotationFormValues): RotationInput {
  return {
    name: value.name,
    rotationDurationSeconds: durationToSeconds(value.rotationDuration, value.rotationDurationUnit),
    numberOfRotations: value.numberOfRotations,
    transitionDurationSeconds: durationToSeconds(
      value.transitionDuration,
      value.transitionDurationUnit,
    ),
    rotationBgColor: value.rotationBgColor,
    transitionBgColor: value.transitionBgColor,
    finalTransition: value.finalTransition,
    bgTransition: value.bgTransition.trim() || undefined,
    audioCues: value.audioCues,
    workCues: value.workCues,
    transitionCues: value.transitionCues,
  };
}

function mapInputPathToFormPath(path: string | number | undefined): keyof RotationFormValues {
  switch (path) {
    case "rotationDurationSeconds":
      return "rotationDuration";
    case "transitionDurationSeconds":
      return "transitionDuration";
    default:
      return (typeof path === "string" ? path : "name") as keyof RotationFormValues;
  }
}

export function parseRotationInput(
  input: unknown,
  messages: RotationFormMessages = ROTATION_FORM_MESSAGES_EN,
): RotationInput {
  const parsed = createRotationInputSchema(messages).safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid rotation");
  }
  return parsed.data;
}

export const rotationInputSchemaEn = createRotationInputSchema(ROTATION_FORM_MESSAGES_EN);
export const rotationFormSchemaEn = createRotationFormSchema(ROTATION_FORM_MESSAGES_EN);
