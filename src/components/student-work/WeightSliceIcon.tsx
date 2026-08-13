import "@/components/icons/fontawesome-setup";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

import { cn } from "@/lib/utils";

type WeightSliceIconProps = {
  icon: IconDefinition;
  color: string;
  className?: string;
};

export function WeightSliceIcon({ icon, color, className }: WeightSliceIconProps) {
  return (
    <FontAwesomeIcon
      icon={icon}
      aria-hidden
      className={cn("size-5 shrink-0", className)}
      style={{ color }}
    />
  );
}

type WeightSliceSvgIconProps = {
  icon: IconDefinition;
  color: string;
  x: number;
  y: number;
  size?: number;
};

export function WeightSliceSvgIcon({ icon, color, x, y, size = 22 }: WeightSliceSvgIconProps) {
  const iconData = icon.icon;
  const width = iconData[0];
  const height = iconData[1];
  const pathData = iconData[4];
  if (typeof pathData !== "string") return null;

  const scale = size / Math.max(width, height);
  const offsetX = x - (width * scale) / 2;
  const offsetY = y - (height * scale) / 2;

  return (
    <g transform={`translate(${offsetX}, ${offsetY}) scale(${scale})`}>
      <path d={pathData} fill={color} />
    </g>
  );
}
