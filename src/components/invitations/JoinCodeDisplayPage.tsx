import { useEffect, useState, type ReactNode } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useTranslation } from "react-i18next";

import { useClassroomSession } from "@/hooks/classroom/useClassroomSession";
import {
  formatJoinCodeDisplay,
  joinCodeShareUrl,
  joinPageUrl,
  syncJoinOriginFromClassroom,
} from "@/lib/invitations/joinCodes";
import { isCompleteJoinCode, normalizeJoinCodeInput } from "@/lib/invitations/joinCodeFormSchema";

type JoinCodeDisplayPageProps = {
  codeFromSearch: string | undefined;
};

const QR_STEP_KEYS = [
  "inviteDisplayQrStep1",
  "inviteDisplayQrStep2",
  "inviteDisplayQrStep3",
  "inviteDisplayQrStep4",
] as const;

function StepItem({ index, children }: { index: number; children: ReactNode }) {
  return (
    <li className="flex gap-4 sm:gap-5">
      <span
        aria-hidden="true"
        className="flex size-12 shrink-0 items-center justify-center rounded-full bg-foreground text-xl font-bold text-background sm:size-14 sm:text-2xl"
      >
        {index}
      </span>
      <span className="pt-2 text-xl leading-snug sm:pt-2.5 sm:text-2xl xl:text-3xl">
        {children}
      </span>
    </li>
  );
}

export function JoinCodeDisplayPage({ codeFromSearch }: JoinCodeDisplayPageProps) {
  const { t, i18n } = useTranslation("classes");
  const classroomSession = useClassroomSession();
  const normalized = codeFromSearch ? normalizeJoinCodeInput(codeFromSearch) : "";
  const valid = isCompleteJoinCode(normalized);
  const displayCode = valid ? formatJoinCodeDisplay(normalized) : "";
  const [qrSize, setQrSize] = useState(280);

  useEffect(() => {
    syncJoinOriginFromClassroom(classroomSession);
  }, [classroomSession]);

  const shareUrl = valid ? joinCodeShareUrl(normalized) : "";
  const joinUrl = joinPageUrl();

  useEffect(() => {
    document.title = t("inviteDisplayTitle");
  }, [t, i18n.language]);

  useEffect(() => {
    const updateSize = () => {
      const halfWidth = window.innerWidth / 2;
      const next = Math.min(halfWidth * 0.55, window.innerHeight * 0.42, 420);
      setQrSize(Math.max(200, Math.floor(next)));
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  if (!valid) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background px-3 text-center">
        <p className="text-xl text-muted-foreground sm:text-2xl">{t("inviteDisplayInvalid")}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <section className="flex flex-1 flex-col border-border px-3 py-6 md:w-1/2 md:border-r md:px-4 md:py-8">
          <div className="flex shrink-0 flex-col items-center gap-5 sm:gap-6">
            <h1 className="text-center text-4xl font-semibold tracking-tight sm:text-5xl xl:text-6xl">
              {t("inviteDisplayCodeHeading")}
            </h1>
            <ol className="w-full max-w-3xl list-none space-y-5 sm:space-y-6">
              <StepItem index={1}>
                <span className="font-mono break-all tracking-tight">{joinUrl}</span>
              </StepItem>
              <StepItem index={2}>{t("inviteDisplayCodeStep2")}</StepItem>
              <StepItem index={3}>{t("inviteDisplayCodeStep3")}</StepItem>
            </ol>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <p
              className="font-mono text-[clamp(2.75rem,9vw,6.5rem)] font-bold leading-none tracking-[0.2em]"
              aria-label={displayCode}
            >
              {displayCode}
            </p>
          </div>
        </section>

        <section className="flex flex-1 flex-col border-t border-border px-3 py-6 md:w-1/2 md:border-t-0 md:px-4 md:py-8">
          <div className="flex shrink-0 flex-col items-center gap-5 sm:gap-6">
            <h1 className="text-center text-4xl font-semibold tracking-tight sm:text-5xl xl:text-6xl">
              {t("inviteDisplayQrHeading")}
            </h1>
            <ol className="w-full max-w-3xl list-none space-y-5 sm:space-y-6">
              {QR_STEP_KEYS.map((key, index) => (
                <StepItem key={key} index={index + 1}>
                  {t(key)}
                </StepItem>
              ))}
            </ol>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <div
              className="rounded-lg bg-white p-3 shadow-sm sm:p-4"
              role="img"
              aria-label={t("inviteDisplayQrLabel")}
            >
              <QRCodeSVG
                value={shareUrl}
                size={qrSize}
                level="M"
                marginSize={2}
                bgColor="#FFFFFF"
                fgColor="#000000"
                title={t("inviteDisplayQrLabel")}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
