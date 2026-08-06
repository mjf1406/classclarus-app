import { LanguageFlag } from "@/components/i18n/LanguageFlag";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getLanguageOption,
  isAppLanguage,
  LANGUAGE_OPTIONS,
  type AppLanguage,
} from "@/lib/languages";
import { cn } from "@/lib/utils";

type LanguageSelectProps = {
  value: AppLanguage;
  onValueChange: (language: AppLanguage) => void;
  id?: string;
  triggerClassName?: string;
  disabled?: boolean;
};

export function LanguageSelect({
  value,
  onValueChange,
  id,
  triggerClassName,
  disabled,
}: LanguageSelectProps) {
  const selected = getLanguageOption(value);

  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        if (next != null && isAppLanguage(next)) {
          onValueChange(next);
        }
      }}
    >
      <SelectTrigger id={id} className={cn("w-full", triggerClassName)}>
        <SelectValue>
          <span className="flex items-center gap-2">
            <LanguageFlag countryCode={selected.countryCode} />
            <span lang={selected.htmlLang}>{selected.label}</span>
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {LANGUAGE_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <span className="flex items-center gap-2">
              <LanguageFlag countryCode={option.countryCode} />
              <span lang={option.htmlLang}>{option.label}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
