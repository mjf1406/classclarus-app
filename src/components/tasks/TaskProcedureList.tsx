import { useTranslation } from "react-i18next";

export function TaskProcedureList({ steps }: { steps: Array<{ key: string; body: string }> }) {
  const { t } = useTranslation("tasks");
  if (steps.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-medium">{t("procedureLabel")}</h2>
      <ol className="list-decimal space-y-2 pl-5 text-sm">
        {steps.map((step) => (
          <li key={step.key} className="whitespace-pre-wrap">
            {step.body}
          </li>
        ))}
      </ol>
    </section>
  );
}
