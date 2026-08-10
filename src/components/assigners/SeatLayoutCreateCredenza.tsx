import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Credenza,
  CredenzaBody,
  CredenzaClose,
  CredenzaContent,
  CredenzaDescription,
  CredenzaFooter,
  CredenzaHeader,
  CredenzaTitle,
} from "@/components/ui/credenza";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSeatLayouts } from "@/hooks/assigners/useSeatLayouts";
import { useActiveClasses } from "@/hooks/classes/useClasses";
import { isClassArchived, sortClasses } from "@/lib/classes/classes";
import type { Id } from "../../../convex/_generated/dataModel";

const MAX_NAME = 80;

type CreateTab = "create" | "copy";

type SeatLayoutCreateCredenzaProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: Id<"classes">;
  onCreate: (name: string) => Promise<void>;
  onCopy: (args: {
    name: string;
    sourceClassId: Id<"classes">;
    sourceLayoutId: Id<"seatLayouts">;
  }) => Promise<void>;
};

export function SeatLayoutCreateCredenza({
  open,
  onOpenChange,
  classId,
  onCreate,
  onCopy,
}: SeatLayoutCreateCredenzaProps) {
  const { t, i18n } = useTranslation("assigners");
  const { data: classes, isPending: classesPending } = useActiveClasses();
  const [tab, setTab] = useState<CreateTab>("create");
  const [name, setName] = useState("");
  const [sourceClassId, setSourceClassId] = useState<Id<"classes"> | "">(classId);
  const [sourceLayoutId, setSourceLayoutId] = useState<Id<"seatLayouts"> | "">("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const classOptions = useMemo(() => {
    const list = (classes ?? []).filter((classDoc) => !isClassArchived(classDoc));
    return sortClasses(list, i18n.language);
  }, [classes, i18n.language]);

  const { data: sourceLayouts, isPending: layoutsPending } = useSeatLayouts(
    tab === "copy" && sourceClassId ? sourceClassId : null,
  );

  const sortedLayouts = useMemo(
    () => (sourceLayouts ? [...sourceLayouts].sort((a, b) => a.name.localeCompare(b.name)) : []),
    [sourceLayouts],
  );

  useEffect(() => {
    if (!open) return;
    setTab("create");
    setName("");
    setSourceClassId(classId);
    setSourceLayoutId("");
    setError(null);
    setIsSubmitting(false);
  }, [open, classId]);

  const selectedClassName = classOptions.find((classDoc) => classDoc._id === sourceClassId)?.name;
  const selectedLayoutName = sortedLayouts.find((layout) => layout._id === sourceLayoutId)?.name;

  const validateName = (trimmed: string): string | null => {
    if (!trimmed) return t("nameRequired");
    if (trimmed.length > MAX_NAME) return t("nameTooLong", { max: MAX_NAME });
    return null;
  };

  const handleSubmit = async () => {
    const trimmed = name.trim();
    const nameError = validateName(trimmed);
    if (nameError) {
      setError(nameError);
      return;
    }
    if (isSubmitting) return;

    if (tab === "create") {
      setIsSubmitting(true);
      onOpenChange(false);
      try {
        await onCreate(trimmed);
      } catch {
        onOpenChange(true);
        setIsSubmitting(false);
      }
      return;
    }

    if (!sourceClassId) {
      setError(t("copySourceClassRequired"));
      return;
    }
    if (!sourceLayoutId) {
      setError(t("copySourceLayoutRequired"));
      return;
    }

    setIsSubmitting(true);
    onOpenChange(false);
    try {
      await onCopy({
        name: trimmed,
        sourceClassId,
        sourceLayoutId,
      });
    } catch {
      onOpenChange(true);
      setIsSubmitting(false);
    }
  };

  return (
    <Credenza open={open} onOpenChange={onOpenChange}>
      <CredenzaContent className="sm:max-w-md">
        <CredenzaHeader>
          <CredenzaTitle>{t("createLayoutTitle")}</CredenzaTitle>
          <CredenzaDescription>
            {tab === "create" ? t("createLayoutDescription") : t("copyLayoutDescription")}
          </CredenzaDescription>
        </CredenzaHeader>
        <CredenzaBody>
          <Tabs
            value={tab}
            onValueChange={(value) => {
              if (value !== "create" && value !== "copy") return;
              setTab(value);
              setError(null);
              if (value === "copy" && !sourceClassId) {
                setSourceClassId(classId);
              }
            }}
            className="gap-3"
          >
            <TabsList className="w-full">
              <TabsTrigger value="create">{t("createLayoutTabCreate")}</TabsTrigger>
              <TabsTrigger value="copy">{t("createLayoutTabCopy")}</TabsTrigger>
            </TabsList>

            <TabsContent value="create" className="mt-0">
              <FieldGroup>
                <Field data-invalid={error ? true : undefined}>
                  <FieldLabel htmlFor="seat-layout-create-name">{t("nameLabel")}</FieldLabel>
                  <Input
                    id="seat-layout-create-name"
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value);
                      setError(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void handleSubmit();
                      }
                    }}
                    autoFocus
                    maxLength={MAX_NAME}
                  />
                  {error && tab === "create" ? <FieldError>{error}</FieldError> : null}
                </Field>
              </FieldGroup>
            </TabsContent>

            <TabsContent value="copy" className="mt-0">
              <FieldGroup>
                <Field data-invalid={error && !name.trim() ? true : undefined}>
                  <FieldLabel htmlFor="seat-layout-copy-name">{t("nameLabel")}</FieldLabel>
                  <Input
                    id="seat-layout-copy-name"
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value);
                      setError(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void handleSubmit();
                      }
                    }}
                    maxLength={MAX_NAME}
                  />
                </Field>

                <Field>
                  <FieldLabel>{t("copySourceClassLabel")}</FieldLabel>
                  <Select
                    value={sourceClassId || undefined}
                    onValueChange={(next) => {
                      if (next == null) return;
                      setSourceClassId(next as Id<"classes">);
                      setSourceLayoutId("");
                      setError(null);
                    }}
                    disabled={classesPending || classOptions.length === 0}
                  >
                    <SelectTrigger className="w-full" aria-label={t("copySourceClassLabel")}>
                      <SelectValue placeholder={t("copySourceClassPlaceholder")}>
                        {selectedClassName}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {classOptions.map((classDoc) => (
                          <SelectItem key={classDoc._id} value={classDoc._id}>
                            {classDoc.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel>{t("copySourceLayoutLabel")}</FieldLabel>
                  {!sourceClassId ? (
                    <p className="text-sm text-muted-foreground">
                      {t("copySourceClassPlaceholder")}
                    </p>
                  ) : layoutsPending ? (
                    <Skeleton className="h-9 w-full rounded-xl" />
                  ) : sortedLayouts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("copyNoSourceLayouts")}</p>
                  ) : (
                    <Select
                      value={sourceLayoutId || undefined}
                      onValueChange={(next) => {
                        if (next == null) return;
                        setSourceLayoutId(next as Id<"seatLayouts">);
                        setError(null);
                        const layoutName = sortedLayouts.find(
                          (layout) => layout._id === next,
                        )?.name;
                        if (layoutName && !name.trim()) {
                          setName(layoutName);
                        }
                      }}
                    >
                      <SelectTrigger className="w-full" aria-label={t("copySourceLayoutLabel")}>
                        <SelectValue placeholder={t("copySourceLayoutPlaceholder")}>
                          {selectedLayoutName}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {sortedLayouts.map((layout) => (
                            <SelectItem key={layout._id} value={layout._id}>
                              {layout.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  )}
                </Field>

                {error && tab === "copy" ? <FieldError>{error}</FieldError> : null}
              </FieldGroup>
            </TabsContent>
          </Tabs>
        </CredenzaBody>
        <CredenzaFooter className="flex-row justify-between gap-2">
          <CredenzaClose render={<Button type="button" variant="outline" className="flex-1" />}>
            {t("cancel")}
          </CredenzaClose>
          <Button
            type="button"
            className="flex-1"
            disabled={
              isSubmitting ||
              (tab === "copy" &&
                (classesPending ||
                  !sourceClassId ||
                  layoutsPending ||
                  sortedLayouts.length === 0 ||
                  !sourceLayoutId))
            }
            onClick={() => {
              void handleSubmit();
            }}
          >
            {tab === "copy" ? t("copyAction") : t("saveAction")}
          </Button>
        </CredenzaFooter>
      </CredenzaContent>
    </Credenza>
  );
}
