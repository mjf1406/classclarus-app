import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from "@/components/ui/combobox";
import {
  listIanaTimeZones,
  timezoneCityLabel,
  timezoneMatchesQuery,
} from "../../../convex/lib/calendar/timeZone";

type TimezoneOption = {
  value: string;
  label: string;
};

type TimezoneSelectProps = {
  value?: string;
  onValueChange: (timezone: string) => void;
  disabled?: boolean;
  id?: string;
};

export function TimezoneSelect({ value, onValueChange, disabled, id }: TimezoneSelectProps) {
  const { t } = useTranslation("classes");
  const items = useMemo(
    (): Array<TimezoneOption> =>
      listIanaTimeZones().map((zone) => ({
        value: zone,
        label: timezoneCityLabel(zone),
      })),
    [],
  );
  const selected = items.find((item) => item.value === value) ?? null;

  return (
    <Combobox
      items={items}
      value={selected}
      isItemEqualToValue={(a, b) => a.value === b.value}
      itemToStringValue={(item) => item.label}
      filter={(item, query) => timezoneMatchesQuery(item.value, query)}
      onValueChange={(next) => {
        if (next && typeof next === "object" && typeof next.value === "string" && next.value) {
          onValueChange(next.value);
        }
      }}
      disabled={disabled}
    >
      <ComboboxTrigger
        id={id}
        disabled={disabled}
        className="flex h-9 w-full min-w-64 items-center justify-between gap-1.5 rounded-4xl border border-input bg-input/30 px-3 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-input/50"
      >
        <span className="min-w-0 flex-1 truncate text-left">
          <ComboboxValue placeholder={t("timezonePlaceholder")} />
        </span>
      </ComboboxTrigger>
      <ComboboxContent>
        <ComboboxInput
          placeholder={t("timezonePlaceholder")}
          disabled={disabled}
          showTrigger={false}
          className="w-auto"
        />
        <ComboboxEmpty>{t("timezoneNoMatches")}</ComboboxEmpty>
        <ComboboxList className="max-h-72">
          {(item: TimezoneOption) => (
            <ComboboxItem key={item.value} value={item}>
              {item.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
