/** @format */

import { useTranslation } from "react-i18next";

import logo from "/brand/logo/icon-and-text-horizontal.webp";
import logoAboveText from "/brand/logo/icon-above-text.webp";
import icon from "/brand/logo/icon-688.webp";
import textLogo from "/brand/logo/text.webp";
import logoXS from "/brand/logo/icon-86.webp";
import { APP_CONFIG } from "@/config/app";
import { isElectronClassroom } from "@/lib/classroom/classroomSession";
import { isSelfHosted } from "@/lib/selfHosted";
import { cn } from "@/lib/utils";
import { ImageSkeleton } from "../ui/image-skeleton";

type ModeBrandMarkProps = {
  size: "sm" | "lg";
  layout?: "horizontal" | "stacked";
  className?: string;
};

/** Icon + deployment label for self-host / Electron (replaces wordmark logo). */
function ModeBrandMark({ size, layout = "horizontal", className }: ModeBrandMarkProps) {
  const { t } = useTranslation("common");
  const label = isElectronClassroom() ? t("logoElectron") : t("logoSelfHosted");
  const iconSize = size === "lg" ? 72 : 40;
  const textClassName = size === "lg" ? "text-3xl" : "text-lg";

  return (
    <span
      className={cn(
        "inline-flex items-center text-foreground",
        layout === "stacked" ? "flex-col gap-2" : "gap-2.5",
        className,
      )}
    >
      <ImageSkeleton
        src={logoXS}
        alt={`${APP_CONFIG.name} Icon`}
        width={iconSize}
        height={iconSize}
        objectFit="contain"
      />
      <span className={cn("font-semibold tracking-tight", textClassName)}>{label}</span>
    </span>
  );
}

export function LogoBig() {
  if (isSelfHosted()) {
    return <ModeBrandMark size="lg" />;
  }
  return <ImageSkeleton src={logo} alt={`${APP_CONFIG.name} Logo`} width={399} height={125} />;
}

export function Logo() {
  if (isSelfHosted()) {
    return <ModeBrandMark size="sm" />;
  }
  return (
    <ImageSkeleton
      src={logo}
      alt={`${APP_CONFIG.name} Logo`}
      width={169}
      height={53}
      objectFit="contain"
    />
  );
}

/** Stacked mark for narrow slots (e.g. footer brand column). */
export function LogoAboveText({ className }: { className?: string } = {}) {
  if (isSelfHosted()) {
    return <ModeBrandMark size="sm" layout="stacked" className={className} />;
  }
  return (
    <ImageSkeleton
      src={logoAboveText}
      alt={`${APP_CONFIG.name} Logo`}
      width={140}
      height={140}
      objectFit="contain"
      className={className}
    />
  );
}

export function Icon({ className }: { className?: string } = {}) {
  const width = className ? undefined : 64;
  const height = className ? undefined : 64;
  return (
    <ImageSkeleton
      src={icon}
      alt={`${APP_CONFIG.name} Icon`}
      width={width}
      height={height}
      className={className}
    />
  );
}

export function TextLogo({ className }: { className?: string } = {}) {
  const width = className ? undefined : 200;
  const height = className ? undefined : 40;
  return (
    <ImageSkeleton
      src={textLogo}
      alt={`${APP_CONFIG.name} Text Logo`}
      width={width}
      height={height}
      className={className}
    />
  );
}

export function LogoXS({ className }: { className?: string } = {}) {
  const width = className ? undefined : 172;
  const height = className ? undefined : 155;
  return (
    <ImageSkeleton
      src={logoXS}
      alt={`${APP_CONFIG.name} Logo`}
      width={width}
      height={height}
      className={className}
    />
  );
}
