import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LanguageFlag } from "@/components/i18n/LanguageFlag";
import { useAppLanguage } from "@/i18n/language-context";
import { getLanguageOption, isAppLanguage, LANGUAGE_OPTIONS } from "@/lib/languages";

type LanguageSwitcherProps = {
  descriptionId?: string;
};

export function LanguageSwitcher({ descriptionId }: LanguageSwitcherProps) {
  const { t } = useTranslation("common");
  const { language, setLanguage, isSaving } = useAppLanguage();
  const currentLanguage = getLanguageOption(language);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            disabled={isSaving}
            aria-describedby={descriptionId}
          />
        }
      >
        <Languages aria-hidden="true" />
        <span className="sr-only">
          {t("chooseLanguage")}: {currentLanguage.label}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" aria-label={t("chooseLanguage")}>
        <DropdownMenuRadioGroup
          value={language}
          onValueChange={(value) => {
            if (isAppLanguage(value)) {
              setLanguage(value);
            }
          }}
        >
          <DropdownMenuLabel>{t("chooseLanguage")}</DropdownMenuLabel>
          {LANGUAGE_OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value} closeOnClick>
              <LanguageFlag countryCode={option.countryCode} />
              <span lang={option.htmlLang}>{option.label}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
