import { useConvexAuth } from "@convex-dev/auth/react";
import { Link } from "@tanstack/react-router";
import type { ReactNode, SVGProps } from "react";
import { useTranslation } from "react-i18next";

import { Logo, LogoAboveText } from "@/components/brand/Logo";
import { LanguageSelect } from "@/components/i18n/LanguageSelect";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { APP_CONFIG } from "@/config/app";
import { useAppLanguage } from "@/i18n/language-context";
import { isSelfHosted } from "@/lib/selfHosted";

/** Lucide no longer ships a GitHub mark; keep a simple brand SVG. */
function GithubIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.083-.73.083-.73 1.205.085 1.84 1.237 1.84 1.237 1.07 1.834 2.807 1.304 3.492.997.108-.775.418-1.305.762-1.605-2.665-.305-5.467-1.334-5.467-5.93 0-1.31.468-2.38 1.236-3.22-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.29-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.91 1.235 3.22 0 4.61-2.807 5.624-5.48 5.92.43.37.823 1.102.823 2.222 0 1.606-.015 2.896-.015 3.286 0 .32.216.694.825.576C20.565 21.795 24 17.295 24 12 24 5.37 18.63 0 12 0z" />
    </svg>
  );
}

function FooterExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Button
      variant="link"
      size="sm"
      className="h-auto justify-start px-0 text-muted-foreground"
      nativeButton={false}
      render={<a href={href} target="_blank" rel="noopener noreferrer" />}
    >
      {children}
    </Button>
  );
}

function FooterInternalLink({
  to,
  children,
}: {
  to: "/join" | "/settings" | "/account" | "/billing" | "/feedback";
  children: ReactNode;
}) {
  return (
    <Button
      variant="link"
      size="sm"
      className="h-auto justify-start px-0 text-muted-foreground"
      nativeButton={false}
      render={<Link to={to} />}
    >
      {children}
    </Button>
  );
}

function FooterColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="flex flex-col items-start gap-2">{children}</div>
    </div>
  );
}

export function AppFooter() {
  const { t } = useTranslation("common");
  const { isAuthenticated } = useConvexAuth();
  const { language, setLanguage, isSaving } = useAppLanguage();
  const year = new Date().getFullYear();
  const showFeedback = isAuthenticated && !isSelfHosted();

  return (
    <footer className="mt-64 shrink-0 border-t bg-background">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div className="@container/footer-brand col-span-2 flex flex-col gap-4 md:col-span-1">
            <a
              href={APP_CONFIG.marketingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-fit outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {/* Horizontal when the brand column is wide enough; stacked when narrow (sidebar). */}
              <span className="hidden @[16rem]/footer-brand:block">
                <Logo />
              </span>
              <span className="@[16rem]/footer-brand:hidden">
                <LogoAboveText />
              </span>
            </a>
            <p className="max-w-xs text-sm text-muted-foreground">{t("footerTagline")}</p>
            <Button
              variant="outline"
              size="icon"
              nativeButton={false}
              render={
                <a
                  href={APP_CONFIG.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t("github")}
                />
              }
            >
              <GithubIcon />
            </Button>
            <Separator />
            <div className="flex flex-col items-start gap-2">
              <FooterExternalLink href={APP_CONFIG.roadMap}>{t("roadmap")}</FooterExternalLink>
              <FooterExternalLink href={APP_CONFIG.changeLog}>{t("changelog")}</FooterExternalLink>
            </div>
          </div>

          <FooterColumn title={t("footerProduct")}>
            <FooterInternalLink to="/join">{t("join")}</FooterInternalLink>
            {isAuthenticated ? (
              <>
                <FooterInternalLink to="/settings">{t("settings")}</FooterInternalLink>
                <FooterInternalLink to="/account">{t("account")}</FooterInternalLink>
                <FooterInternalLink to="/billing">{t("billing")}</FooterInternalLink>
                {showFeedback ? (
                  <FooterInternalLink to="/feedback">{t("feedback")}</FooterInternalLink>
                ) : null}
              </>
            ) : null}
          </FooterColumn>

          <FooterColumn title={t("footerResources")}>
            <FooterExternalLink href={APP_CONFIG.marketingUrl}>{t("website")}</FooterExternalLink>
            <FooterExternalLink href={APP_CONFIG.github}>{t("github")}</FooterExternalLink>
          </FooterColumn>

          <FooterColumn title={t("footerLegal")}>
            <FooterExternalLink href={APP_CONFIG.privacyUrl}>
              {t("privacyPolicy")}
            </FooterExternalLink>
            <FooterExternalLink href={APP_CONFIG.termsUrl}>
              {t("termsAndConditions")}
            </FooterExternalLink>
            <FooterExternalLink href={APP_CONFIG.cookieUrl}>{t("cookiePolicy")}</FooterExternalLink>
          </FooterColumn>
        </div>

        <Separator />

        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-xs text-muted-foreground">{t("copyright", { year })}</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <LanguageSelect
              value={language}
              onValueChange={setLanguage}
              disabled={isSaving}
              triggerClassName="w-auto min-w-40"
            />
            <ThemeToggle />
          </div>
        </div>
      </div>
    </footer>
  );
}
