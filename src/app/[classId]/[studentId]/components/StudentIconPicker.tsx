"use client";

import React from "react";
import type { IconName, IconPrefix } from "@fortawesome/fontawesome-svg-core";
import ShadcnFontAwesomeIconPicker from "@/components/ShadcnFontAwesomeIconPicker";
import { useSSRSafeLocalStorage } from "@/hooks/useSsrSafeLocalStorage";

interface SelectedIcon {
  name: IconName;
  prefix: IconPrefix;
}

const StudentIconPicker: React.FC = () => {
  const [selectedIcon, setSelectedIcon] =
    useSSRSafeLocalStorage<SelectedIcon | null>("selectedIcon", null);

  const handleSelectIcon = (iconName: IconName, prefix: IconPrefix) => {
    setSelectedIcon({ name: iconName, prefix });
  };

  return (
    <ShadcnFontAwesomeIconPicker
      onSelectIcon={handleSelectIcon}
      selectedIcon={selectedIcon ?? undefined}
    />
  );
};

export default StudentIconPicker;
