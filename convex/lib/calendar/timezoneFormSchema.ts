import { z } from "zod";

import { isValidTimeZone } from "./timeZone.js";

export type TimezoneFormValues = {
  timezone: string;
};

export function createTimezoneFormSchema(messages: {
  timezoneRequired: string;
  timezoneInvalid: string;
}) {
  return z.object({
    timezone: z
      .string()
      .trim()
      .min(1, messages.timezoneRequired)
      .refine((value) => isValidTimeZone(value), messages.timezoneInvalid),
  });
}
