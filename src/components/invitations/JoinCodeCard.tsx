import { BanIcon, PresentationIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { ClassRoleBadge } from "@/components/badges/ClassRoleBadges";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { formatCountdownUntil, formatLocalizedDateTime } from "@/i18n/formatDate";
import {
  isPendingJoinCode,
  joinCodeDisplayUrl,
  joinCodeShareUrl,
  formatJoinCodeDisplay,
  remainingUses,
  type JoinCodePublic,
} from "@/lib/invitations/joinCodes";

type JoinCodeCardProps = {
  code: JoinCodePublic;
  classArchived: boolean;
  onRevoke: (code: JoinCodePublic) => void;
};

export function JoinCodeCard({ code, classArchived, onRevoke }: JoinCodeCardProps) {
  const { t } = useTranslation("classes");
  const [now, setNow] = useState(() => Date.now());
  const pending = isPendingJoinCode(code);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const menuItems = useMemo<Array<ActionMenuItem>>(
    () => [
      {
        id: "revoke",
        label: t("revokeInvite"),
        icon: <BanIcon />,
        permission: "invitations:revoke",
        variant: "destructive",
        onSelect: () => onRevoke(code),
      },
    ],
    [code, onRevoke, t],
  );

  const remaining = remainingUses(code);
  const countdown = formatCountdownUntil(code.expiresAt, now);
  const displayCode = formatJoinCodeDisplay(code.code);
  const shareUrl = pending ? "" : joinCodeShareUrl(code.code);

  return (
    <Card size="sm" className={pending ? "opacity-70" : undefined}>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="font-mono text-xl tracking-widest">
              {pending ? t("invitePendingCode") : displayCode}
            </CardTitle>
            {!pending ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={t("showInviteCodeDisplay")}
                  onClick={() => {
                    window.open(joinCodeDisplayUrl(code.code), "_blank", "noopener,noreferrer");
                  }}
                >
                  <PresentationIcon aria-hidden="true" />
                </Button>
                <CopyButton type="text" value={displayCode} aria-label={t("copyInviteCode")} />
                <CopyButton type="link" value={shareUrl} aria-label={t("copyInviteLink")} />
              </>
            ) : null}
          </div>
          <ClassRoleBadge role={code.role} />
        </div>
        {!pending ? <ActionMenu items={menuItems} label={t("inviteCodeActions")} /> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        {classArchived ? (
          <div className="flex flex-col gap-1">
            <Badge variant="secondary">{t("inviteArchivedBadge")}</Badge>
            <p className="text-muted-foreground">{t("inviteArchivedHint")}</p>
          </div>
        ) : null}
        <p>
          {t("inviteUsesSummary", {
            used: code.useCount,
            max: code.maxUses,
            remaining,
          })}
        </p>
        <p className="text-muted-foreground">
          {t("inviteExpiresAt", { date: formatLocalizedDateTime(code.expiresAt) })}
        </p>
        <p className="text-muted-foreground">{t("inviteTimeLeft", { countdown })}</p>
      </CardContent>
    </Card>
  );
}
