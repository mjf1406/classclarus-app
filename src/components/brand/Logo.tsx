/** @format */

import logo from "/brand/icon-left-of-text-different-sizes-removebg-preview.webp";
import icon from "/brand/icon-removebg.webp";
import textLogo from "/brand/text-removebg-preview.webp";
import logoXS from "/brand/icon-removebg-xs.webp";
import { ImageSkeleton } from "../ui/image-skeleton";

export function LogoBig() {
  return <ImageSkeleton src={logo} alt="ClassClarus Logo" width={399} height={125} />;
}

export function Logo() {
  return <ImageSkeleton src={logo} alt="ClassClarus Logo" width={217} height={53} />;
}

export function Icon({ className }: { className?: string } = {}) {
  const width = className ? undefined : 64;
  const height = className ? undefined : 64;
  return (
    <ImageSkeleton
      src={icon}
      alt="ClassClarus Icon"
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
      alt="ClassClarus Text Logo"
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
      alt="ClassClarus Logo"
      width={width}
      height={height}
      className={className}
    />
  );
}
