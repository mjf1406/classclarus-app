"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconName, IconPrefix } from "@fortawesome/fontawesome-svg-core";
import { library } from "@fortawesome/fontawesome-svg-core";
import { faGift, fas } from "@fortawesome/free-solid-svg-icons";
import { far } from "@fortawesome/free-regular-svg-icons";

// Add them all to the library
library.add(fas, far);

// ------------------------------------------------------------------
// FontAwesomeIconClient
// ------------------------------------------------------------------
interface FontAwesomeIconClientProps {
  icon: string | null | undefined;
  size?: number;
  className?: string;
}

export function FontAwesomeIconClient({
  icon,
  size = 32,
  className = "",
}: FontAwesomeIconClientProps) {
  const iconStyle = {
    width: `${size}px`,
    height: `${size}px`,
  };

  // If no icon is provided, use faGift as a fallback
  if (!icon) {
    return (
      <FontAwesomeIcon icon={faGift} style={iconStyle} className={className} />
    );
  }

  try {
    // icon is something like "fas seedling"
    // so iconParts = ["fas", "seedling"]
    const iconParts = icon.split(" ");
    const prefix = iconParts[0] as IconPrefix;
    const iconName = iconParts[1] as IconName;

    return (
      <FontAwesomeIcon
        icon={[prefix, iconName]}
        style={iconStyle}
        className={className}
      />
    );
  } catch (error) {
    console.error("Error rendering icon:", error);
    return (
      <FontAwesomeIcon icon={faGift} style={iconStyle} className={className} />
    );
  }
}
