/** @format */

import { useState, useEffect } from "react";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { resolveIconId } from "./fontawesome-icon-catalog";
import { cn } from "@/lib/utils";

interface FontAwesomeIconFromIdProps {
  id?: string | null;
  className?: string;
  style?: React.CSSProperties;
  fallback?: React.ReactNode;
}

export function FontAwesomeIconFromId({
  id,
  className,
  style,
  fallback,
}: FontAwesomeIconFromIdProps) {
  const [def, setDef] = useState<IconDefinition | null>(null);

  useEffect(() => {
    if (!id) {
      setDef(null);
      return;
    }
    let cancelled = false;
    void resolveIconId(id).then((resolved) => {
      if (!cancelled) setDef(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!id) return <>{fallback}</>;
  if (!def) return <>{fallback}</>;
  return (
    <FontAwesomeIcon
      icon={def}
      className={cn(className)}
      style={style as (React.CSSProperties & Record<string, string>) | undefined}
    />
  );
}
