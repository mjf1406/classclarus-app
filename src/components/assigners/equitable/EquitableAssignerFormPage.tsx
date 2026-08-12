import { Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { ArrowLeft, ListPlus, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { RandomAssignerItemPresetsCredenza } from "@/components/assigners/random/RandomAssignerItemPresetsCredenza";
import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateEquitableAssigner } from "@/hooks/assigners/equitable/useCreateEquitableAssigner";
import { useUpdateEquitableAssigner } from "@/hooks/assigners/equitable/useUpdateEquitableAssigner";
import {
  rowFocusKeyProps,
  rowFocusTargetProps,
  usePendingRowFocus,
} from "@/hooks/usePendingRowFocus";
import {
  createClientEquitableAssignerFormSchema,
  emptyEquitableAssignerFormValues,
  equitableAssignerFormValuesFromDetail,
  type EquitableAssignerDetail,
  type EquitableAssignerFormValues,
  type EquitableAssignerScope,
} from "@/lib/assigners/equitableAssigners";
import type { Id } from "../../../../convex/_generated/dataModel";

type EquitableAssignerFormPageProps = {
  classId: Id<"classes">;
  mode: "create" | "edit";
  initial?: EquitableAssignerDetail | null;
};

function fieldErrorMessage(errors: unknown): string | undefined {
  if (!Array.isArray(errors) || errors.length === 0) return undefined;
  const first = errors[0];
  if (typeof first === "string") return first;
  if (first && typeof first === "object" && "message" in first) {
    const message = (first as { message?: unknown }).message;
    return typeof message === "string" ? message : undefined;
  }
  return undefined;
}

export function EquitableAssignerFormPage({
  classId,
  mode,
  initial,
}: EquitableAssignerFormPageProps) {
  const { t } = useTranslation("assigners");
  const navigate = useNavigate();
  const createAssigner = useCreateEquitableAssigner();
  const updateAssigner = useUpdateEquitableAssigner();
  const { queueRowFocus } = usePendingRowFocus();
  const [presetsOpen, setPresetsOpen] = useState(false);
  const schema = useMemo(
    () =>
      createClientEquitableAssignerFormSchema({
        nameRequired: t("equitableNameRequired"),
        nameTooLong: t("equitableNameTooLong"),
        itemsRequired: t("equitableItemsRequired"),
        tooManyItems: t("equitableTooManyItems"),
        itemRequired: t("equitableItemRequired"),
        itemTooLong: t("equitableItemTooLong"),
        duplicateItem: t("equitableDuplicateItem"),
      }),
    [t],
  );

  const form = useForm({
    defaultValues: initial
      ? equitableAssignerFormValuesFromDetail(initial)
      : emptyEquitableAssignerFormValues(),
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      const normalized: EquitableAssignerFormValues = {
        ...value,
        items: value.items.map((item) => item.trim()).filter((item) => item.length > 0),
      };
      const parsed = schema.parse(normalized) as EquitableAssignerFormValues;
      if (mode === "create") {
        const assignerId = await createAssigner.mutateAsync({ classId, values: parsed });
        void navigate({
          to: "/class/$classId/assigners/equitable/$assignerId",
          params: { classId, assignerId },
        });
        return;
      }
      if (!initial) return;
      await updateAssigner.mutateAsync({
        classId,
        assignerId: initial._id,
        values: parsed,
      });
      void navigate({
        to: "/class/$classId/assigners/equitable/$assignerId",
        params: { classId, assignerId: initial._id },
      });
    },
  });

  useEffect(() => {
    if (initial) {
      form.reset(equitableAssignerFormValuesFromDetail(initial));
    }
  }, [form, initial]);

  const pending = createAssigner.isPending || updateAssigner.isPending;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-8">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          nativeButton={false}
          render={
            <Link
              to={
                mode === "edit" && initial
                  ? "/class/$classId/assigners/equitable/$assignerId"
                  : "/class/$classId/assigners/equitable"
              }
              params={
                mode === "edit" && initial ? { classId, assignerId: initial._id } : { classId }
              }
              aria-label={t("equitableBackToList")}
            />
          }
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {mode === "create" ? t("equitableCreateTitle") : t("equitableEditTitle")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "create" ? t("equitableCreateDescription") : t("equitableEditDescription")}
          </p>
        </div>
      </div>

      <form
        className="flex flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <FieldGroup>
          <form.Field name="name">
            {(field) => {
              const error = fieldErrorMessage(field.state.meta.errors);
              return (
                <Field data-invalid={error ? true : undefined}>
                  <FieldLabel htmlFor="equitable-assigner-name">
                    {t("equitableNameLabel")}
                  </FieldLabel>
                  <Input
                    id="equitable-assigner-name"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    aria-invalid={error ? true : undefined}
                  />
                  {error ? <FieldError>{error}</FieldError> : null}
                </Field>
              );
            }}
          </form.Field>

          <form.Field name="items" mode="array">
            {(field) => {
              const items = field.state.value;
              const arrayError = fieldErrorMessage(field.state.meta.errors);
              const addItem = () => {
                const nextIndex = field.state.value.length;
                field.pushValue("");
                queueRowFocus(String(nextIndex));
              };
              return (
                <Field data-invalid={arrayError ? true : undefined}>
                  <FieldLabel>{t("equitableItemsLabel")}</FieldLabel>
                  <div className="flex flex-col gap-2">
                    {items.map((_, index) => (
                      <form.Field key={index} name={`items[${index}]`}>
                        {(itemField) => {
                          const error = fieldErrorMessage(itemField.state.meta.errors);
                          return (
                            <div
                              className="flex items-start gap-2"
                              {...rowFocusKeyProps(String(index))}
                            >
                              <Field className="flex-1" data-invalid={error ? true : undefined}>
                                <Input
                                  {...rowFocusTargetProps()}
                                  value={itemField.state.value}
                                  onBlur={itemField.handleBlur}
                                  onChange={(event) => itemField.handleChange(event.target.value)}
                                  onKeyDown={(event) => {
                                    if (event.key !== "Enter") return;
                                    event.preventDefault();
                                    addItem();
                                  }}
                                  placeholder={t("equitableItemPlaceholder", { number: index + 1 })}
                                  aria-invalid={error ? true : undefined}
                                />
                                {error ? <FieldError>{error}</FieldError> : null}
                              </Field>
                              <Button
                                type="button"
                                variant="destructive"
                                size="icon-sm"
                                className="shrink-0"
                                disabled={items.length <= 1}
                                aria-label={t("equitableRemoveItem")}
                                onClick={() => field.removeValue(index)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          );
                        }}
                      </form.Field>
                    ))}
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" onClick={addItem}>
                        <Plus className="size-4" />
                        {t("equitableAddItem")}
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setPresetsOpen(true)}>
                        <ListPlus className="size-4" />
                        {t("randomItemPresetsOpen")}
                      </Button>
                    </div>
                  </div>
                  {arrayError ? <FieldError>{arrayError}</FieldError> : null}
                  <RandomAssignerItemPresetsCredenza
                    open={presetsOpen}
                    onOpenChange={setPresetsOpen}
                    items={field.state.value}
                    onApply={(nextItems) => field.handleChange(nextItems)}
                  />
                </Field>
              );
            }}
          </form.Field>

          <form.Field name="defaultScope">
            {(field) => (
              <Field>
                <FieldLabel>{t("equitableRunScopeLabel")}</FieldLabel>
                <Select
                  value={field.state.value}
                  onValueChange={(value) => field.handleChange(value as EquitableAssignerScope)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {field.state.value === "groups"
                        ? t("equitableScopeGroups")
                        : t("equitableScopeClass")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="class">{t("equitableScopeClass")}</SelectItem>
                    <SelectItem value="groups">{t("equitableScopeGroups")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            )}
          </form.Field>

          <form.Field name="defaultBalanceGender">
            {(field) => (
              <Field orientation="vertical">
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="default-balance-gender"
                    checked={field.state.value}
                    onCheckedChange={(checked) => field.handleChange(checked === true)}
                  />
                  <div className="grid gap-1">
                    <FieldLabel htmlFor="default-balance-gender" className="font-normal">
                      {t("equitableBalanceGenderLabel")}
                    </FieldLabel>
                    <p className="text-sm text-muted-foreground">
                      {t("equitableBalanceGenderHint")}
                    </p>
                  </div>
                </div>
              </Field>
            )}
          </form.Field>
        </FieldGroup>

        <div className="flex flex-wrap gap-2">
          <AsyncButton type="submit" pending={pending}>
            {mode === "create" ? t("equitableCreate") : t("equitableSave")}
          </AsyncButton>
          <Button
            type="button"
            variant="outline"
            nativeButton={false}
            render={
              <Link
                to={
                  mode === "edit" && initial
                    ? "/class/$classId/assigners/equitable/$assignerId"
                    : "/class/$classId/assigners/equitable"
                }
                params={
                  mode === "edit" && initial ? { classId, assignerId: initial._id } : { classId }
                }
              />
            }
          >
            {t("equitableCancel")}
          </Button>
        </div>
      </form>
    </div>
  );
}
