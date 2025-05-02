"use client";

import React from "react";
import { useLocalStorage } from "@uidotdev/usehooks";
import type { IconName, IconPrefix } from "@fortawesome/fontawesome-svg-core";
import ShadcnFontAwesomeIconPicker from "@/components/ShadcnFontAwesomeIconPicker";

interface SelectedIcon {
  name: IconName;
  prefix: IconPrefix;
}

const StudentIconPicker: React.FC = () => {
  // Note: The hook stores the selected icon under the key "selectedIcon".
  // The initial value is null (no icon selected).
  const [selectedIcon, setSelectedIcon] = useLocalStorage<SelectedIcon | null>(
    "selectedIcon",
    null,
  );

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
