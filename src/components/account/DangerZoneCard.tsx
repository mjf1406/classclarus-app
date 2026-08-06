import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { DeleteAccountCredenza } from "@/components/account/DeleteAccountCredenza";
import { DeleteClassCredenza } from "@/components/classes/DeleteClassCredenza";
import { TransferOwnershipCredenza } from "@/components/classes/TransferOwnershipCredenza";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeleteClass } from "@/hooks/classes/useDeleteClass";
import { useOwnedClasses } from "@/hooks/classes/useOwnedClasses";
import { useTransferOwnership } from "@/hooks/classes/useTransferOwnership";
import { useAccountDeletionBlockers } from "@/hooks/user/useAccountDeletionBlockers";
import { useDeleteAccount } from "@/hooks/user/useDeleteAccount";
import type { Id } from "../../../convex/_generated/dataModel";

type DangerZoneCardProps = {
  email: string | null | undefined;
};

type OwnedClassAction = {
  classId: Id<"classes">;
  name: string;
  mode: "transfer" | "delete";
};

export function DangerZoneCard({ email }: DangerZoneCardProps) {
  const { t } = useTranslation("account");
  const { t: tClasses } = useTranslation("classes");
  const [open, setOpen] = useState(false);
  const [classAction, setClassAction] = useState<OwnedClassAction | null>(null);
  const deleteAccount = useDeleteAccount();
  const deleteClass = useDeleteClass();
  const transferOwnership = useTransferOwnership();
  const {
    data: blockers,
    isPending: blockersPending,
    isError: blockersError,
  } = useAccountDeletionBlockers();
  const { data: ownedClasses = [] } = useOwnedClasses();

  const blocked = (blockers?.length ?? 0) > 0;
  const ownsClasses = blockers?.includes("owns_classes") ?? false;
  const hasSubscription = blockers?.includes("active_subscription") ?? false;

  return (
    <>
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">{t("dangerTitle")}</CardTitle>
          <CardDescription>{t("dangerDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {blockersPending ? (
            <Skeleton className="h-16 w-full" />
          ) : blockersError ? (
            <p className="text-sm text-muted-foreground">{t("blockersLoadFailed")}</p>
          ) : blocked ? (
            <div className="flex flex-col gap-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">{t("deleteBlockedTitle")}</p>
              {ownsClasses ? (
                <div className="flex flex-col gap-2">
                  <p>
                    {ownedClasses.length > 0
                      ? t("deleteBlockedOwnsClassesCount", { count: ownedClasses.length })
                      : t("deleteBlockedOwnsClasses")}
                  </p>
                  {ownedClasses.length > 0 ? (
                    <ul className="flex flex-col gap-2">
                      {ownedClasses.map((classDoc) => (
                        <li
                          key={classDoc._id}
                          className="flex flex-col gap-2 rounded-md border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <span className="font-medium text-foreground">{classDoc.name}</span>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setClassAction({
                                  classId: classDoc._id,
                                  name: classDoc.name,
                                  mode: "transfer",
                                })
                              }
                            >
                              {t("transferOwnership")}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              className="bg-destructive text-white hover:bg-destructive/90 dark:bg-destructive dark:hover:bg-destructive/90"
                              onClick={() =>
                                setClassAction({
                                  classId: classDoc._id,
                                  name: classDoc.name,
                                  mode: "delete",
                                })
                              }
                            >
                              {tClasses("deleteAction")}
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <Link to="/" className="underline underline-offset-2">
                      {t("deleteBlockedManageClasses")}
                    </Link>
                  )}
                </div>
              ) : null}
              {hasSubscription ? (
                <p>
                  {t("deleteBlockedActiveSubscription")}{" "}
                  <Link to="/billing" className="underline underline-offset-2">
                    {t("manageBilling")}
                  </Link>
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("deleteReadyBody")}</p>
          )}

          <Button
            type="button"
            variant="destructive"
            className="w-full justify-center bg-destructive text-white hover:bg-destructive/90 sm:w-auto dark:bg-destructive dark:hover:bg-destructive/90"
            disabled={blockersPending || blocked || deleteAccount.isPending}
            onClick={() => setOpen(true)}
          >
            {t("deleteAccount")}
          </Button>
        </CardContent>
      </Card>

      <DeleteAccountCredenza
        open={open}
        onOpenChange={setOpen}
        email={email}
        onConfirm={async (confirmation) => {
          await deleteAccount.mutateAsync({ confirmation });
        }}
      />

      {classAction?.mode === "delete" ? (
        <DeleteClassCredenza
          open
          onOpenChange={(next) => {
            if (!next) setClassAction(null);
          }}
          className={classAction.name}
          onConfirm={async (confirmation) => {
            await deleteClass.mutateAsync({
              classId: classAction.classId,
              confirmation,
            });
            setClassAction(null);
          }}
        />
      ) : null}

      {classAction?.mode === "transfer" ? (
        <TransferOwnershipCredenza
          open
          onOpenChange={(next) => {
            if (!next) setClassAction(null);
          }}
          classId={classAction.classId}
          className={classAction.name}
          onConfirm={async (toUserId) => {
            await transferOwnership.mutateAsync({
              classId: classAction.classId,
              toUserId,
            });
            setClassAction(null);
          }}
        />
      ) : null}
    </>
  );
}
