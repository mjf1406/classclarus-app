import { useState } from "react";
import type { ComponentProps } from "react";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";

type PasswordInputProps = Omit<ComponentProps<"input">, "type">;

export function PasswordInput({ disabled, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const { t } = useTranslation("common");

  return (
    <InputGroup data-disabled={disabled ? true : undefined}>
      <InputGroupInput type={visible ? "text" : "password"} disabled={disabled} {...props} />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          type="button"
          size="icon-xs"
          disabled={disabled}
          aria-label={visible ? t("hidePassword") : t("showPassword")}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}
