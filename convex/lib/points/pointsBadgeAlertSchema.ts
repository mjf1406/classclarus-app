import { z } from "zod";

import {
  MAX_POINTS_BADGE_ALERT_ACTION_LENGTH,
  MAX_POINTS_BADGE_ALERT_COUNT,
  MAX_POINTS_BADGE_ALERTS,
  MIN_POINTS_BADGE_ALERT_COUNT,
} from "./pointsBadgeAlert.js";

export type PointsBadgeAlertMessages = {
  countInvalid: string;
  countRange: string;
  actionRequired: string;
  actionTooLong: string;
  duplicateCount: string;
  tooMany: string;
};

export const POINTS_BADGE_ALERT_MESSAGES_EN: PointsBadgeAlertMessages = {
  countInvalid: "Notification count must be a whole number",
  countRange: `Count must be between ${MIN_POINTS_BADGE_ALERT_COUNT} and ${MAX_POINTS_BADGE_ALERT_COUNT}`,
  actionRequired: "Notification action is required",
  actionTooLong: `Action must be at most ${MAX_POINTS_BADGE_ALERT_ACTION_LENGTH} characters`,
  duplicateCount: "Each notification count must be unique",
  tooMany: `At most ${MAX_POINTS_BADGE_ALERTS} custom notifications are allowed`,
};

export function createPointsBadgeAlertItemSchema(messages: PointsBadgeAlertMessages) {
  return z.object({
    count: z
      .number({ error: messages.countInvalid })
      .refine((value) => Number.isFinite(value) && Number.isInteger(value), {
        message: messages.countInvalid,
      })
      .refine(
        (value) => value >= MIN_POINTS_BADGE_ALERT_COUNT && value <= MAX_POINTS_BADGE_ALERT_COUNT,
        { message: messages.countRange },
      ),
    action: z
      .string()
      .trim()
      .min(1, messages.actionRequired)
      .max(MAX_POINTS_BADGE_ALERT_ACTION_LENGTH, messages.actionTooLong),
  });
}

export function createPointsBadgeAlertsSchema(messages: PointsBadgeAlertMessages) {
  const itemSchema = createPointsBadgeAlertItemSchema(messages);
  return z
    .array(itemSchema)
    .max(MAX_POINTS_BADGE_ALERTS, messages.tooMany)
    .superRefine((alerts, ctx) => {
      const seen = new Set<number>();
      alerts.forEach((alert, index) => {
        if (seen.has(alert.count)) {
          ctx.addIssue({
            code: "custom",
            message: messages.duplicateCount,
            path: [index, "count"],
          });
        }
        seen.add(alert.count);
      });
    });
}

export const pointsBadgeAlertItemSchemaEn = createPointsBadgeAlertItemSchema(
  POINTS_BADGE_ALERT_MESSAGES_EN,
);
export const pointsBadgeAlertsSchemaEn = createPointsBadgeAlertsSchema(
  POINTS_BADGE_ALERT_MESSAGES_EN,
);
