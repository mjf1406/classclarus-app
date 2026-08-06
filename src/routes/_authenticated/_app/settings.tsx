import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { LanguageSelect } from "@/components/i18n/LanguageSelect";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useAppLanguage } from "@/i18n/language-context";

export const Route = createFileRoute("/_authenticated/_app/settings")({
  component: function SettingsPage() {
    const { t } = useTranslation(["settings", "common"]);
    const { language, setLanguage, isSaving } = useAppLanguage();

    return (
      <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-6 px-4 py-8 text-center">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <div className="flex w-full flex-col items-center gap-2">
          <h2 className="text-sm font-medium">{t("languageLabel")}</h2>
          <p id="language-description" className="text-sm text-muted-foreground">
            {t("languageDescription")}
          </p>
          <LanguageSelect
            value={language}
            onValueChange={setLanguage}
            disabled={isSaving}
            triggerClassName="w-auto min-w-40"
          />
        </div>
        <div className="flex w-full flex-col items-center gap-2">
          <h2 className="text-sm font-medium">{t("themeLabel")}</h2>
          <p id="theme-description" className="text-sm text-muted-foreground">
            {t("themeDescription")}
          </p>
          <ThemeToggle descriptionId="theme-description" />
        </div>
      </div>
    );
  },
});
