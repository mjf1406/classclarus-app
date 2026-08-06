import { ClipboardPasteIcon, OctagonXIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup } from "@/components/ui/field";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Spinner } from "@/components/ui/spinner";
import { useRedeemJoinCode } from "@/hooks/invitations/useRedeemJoinCode";
import {
  clearPendingJoinCode,
  resolveJoinCodePrefill,
  stashPendingJoinCode,
} from "@/lib/auth/pendingJoinCode";
import {
  isCompleteJoinCode,
  JOIN_CODE_LENGTH,
  normalizeJoinCodeInput,
  redeemJoinCodeSchema,
} from "@/lib/invitations/joinCodeFormSchema";
import { JOIN_CODE_PARAM } from "@/lib/invitations/joinCodes";
import { canReadAsyncClipboard, readClipboardText } from "@/lib/clipboard";
import { isSubscriptionRequiredError } from "@/lib/billing/errors";
import { codeFromError, messageFromError } from "@/lib/errors/convexError";

const joinSearchSchema = z.object({
  [JOIN_CODE_PARAM]: z.string().optional().catch(undefined),
});

function locationHasCodeParam(searchStr: string): boolean {
  return new URLSearchParams(searchStr).has(JOIN_CODE_PARAM);
}

export const Route = createFileRoute("/_authenticated/_app/join")({
  validateSearch: joinSearchSchema,
  component: function JoinPage() {
    const { t } = useTranslation("classes");
    const { t: tCommon } = useTranslation("common");
    const { t: tBilling } = useTranslation("billing");
    const navigate = useNavigate();
    const searchStr = useRouterState({ select: (state) => state.location.searchStr });
    const { [JOIN_CODE_PARAM]: codeFromSearch } = Route.useSearch();
    const redeemMutation = useRedeemJoinCode();
    const didStripQueryRef = useRef(false);

    const [code, setCode] = useState(() =>
      resolveJoinCodePrefill({
        searchCode: codeFromSearch,
        locationSearch: typeof window !== "undefined" ? window.location.search : searchStr,
      }),
    );
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
      document.title = t("joinPageTitle");
    }, [t]);

    useEffect(() => {
      const resolved = resolveJoinCodePrefill({
        searchCode: codeFromSearch,
        locationSearch: searchStr,
      });

      if (resolved) {
        setCode((current) => (current === resolved ? current : resolved));
        // Keep a fallback until the query is stripped / submit runs.
        stashPendingJoinCode(resolved);
      }

      const shouldStripQuery = Boolean(codeFromSearch) || locationHasCodeParam(searchStr || "");
      if (!shouldStripQuery) {
        didStripQueryRef.current = false;
        if (resolved) {
          clearPendingJoinCode();
        }
        return;
      }

      if (didStripQueryRef.current) return;
      didStripQueryRef.current = true;

      void navigate({
        to: "/join",
        search: {},
        replace: true,
      }).finally(() => {
        clearPendingJoinCode();
      });
    }, [codeFromSearch, searchStr, navigate]);

    const clearJoinQuery = async () => {
      clearPendingJoinCode();
      if (!codeFromSearch && !locationHasCodeParam(searchStr || "")) {
        return;
      }
      await navigate({
        to: "/join",
        search: {},
        replace: true,
      });
    };

    const handlePaste = async () => {
      setError(null);
      if (!canReadAsyncClipboard()) {
        setError(t("joinPasteUseKeyboard"));
        return;
      }
      try {
        const text = await readClipboardText();
        const normalized = normalizeJoinCodeInput(text).slice(0, JOIN_CODE_LENGTH);
        if (!isCompleteJoinCode(normalized)) {
          setError(t("joinPasteInvalid"));
          return;
        }
        setCode(normalized);
      } catch {
        setError(t("joinPasteFailed"));
      }
    };

    const handleSubmit = async () => {
      setError(null);
      const parsed = redeemJoinCodeSchema.safeParse(code);
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? t("joinFailed"));
        return;
      }

      await clearJoinQuery();

      try {
        const result = await redeemMutation.mutateAsync({ code: parsed.data });
        await navigate({
          to: "/class/$classId",
          params: { classId: result.classId },
        });
      } catch (submitError) {
        const code = codeFromError(submitError);
        if (isSubscriptionRequiredError(submitError)) {
          setError(tBilling("errorSubscriptionRequired"));
        } else if (code === "ALREADY_MEMBER") {
          setError(t("joinAlreadyMember"));
        } else if (code === "INVALID_JOIN_CODE") {
          setError(t("joinInvalidCode"));
        } else if (code === "CLASS_ARCHIVED") {
          setError(t("joinClassArchived"));
        } else {
          setError(messageFromError(submitError, t("joinFailed"), tCommon("rateLimited")));
        }
      }
    };

    const isSubmitting = redeemMutation.isPending;
    const canSubmit = isCompleteJoinCode(code) && !isSubmitting;

    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center p-4 sm:p-6">
        <div className="flex w-full flex-col items-center gap-6 text-center">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">{t("joinPageTitle")}</h1>
            <p className="text-sm text-muted-foreground">{t("joinPageDescription")}</p>
            <p className="text-sm text-muted-foreground">{t("joinRateLimitHint")}</p>
          </div>

          <form
            className="flex w-full flex-col items-center gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSubmit();
            }}
          >
            <FieldGroup className="w-full items-center">
              <Field className="items-center" data-invalid={error ? true : undefined}>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={isSubmitting}
                    aria-label={t("joinPasteCode")}
                    onClick={() => {
                      void handlePaste();
                    }}
                  >
                    <ClipboardPasteIcon />
                  </Button>
                  <InputOTP
                    id="join-code"
                    maxLength={JOIN_CODE_LENGTH}
                    value={code}
                    disabled={isSubmitting}
                    inputMode="text"
                    autoComplete="one-time-code"
                    containerClassName="justify-center font-mono"
                    aria-invalid={error ? true : undefined}
                    onChange={(next) => {
                      setError(null);
                      setCode(normalizeJoinCodeInput(next).slice(0, JOIN_CODE_LENGTH));
                    }}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot className="last:rounded-r-none" index={2} />
                    </InputOTPGroup>
                    <InputOTPSeparator className="mx-2" />
                    <InputOTPGroup>
                      <InputOTPSlot className="first:rounded-l-none" index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={isSubmitting || code.length === 0}
                    aria-label={t("joinClearCode")}
                    onClick={() => {
                      setError(null);
                      setCode("");
                    }}
                  >
                    <XIcon />
                  </Button>
                </div>
              </Field>
            </FieldGroup>

            {error ? (
              <Alert variant="destructive" className="w-full">
                <OctagonXIcon />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <Button type="submit" size="lg" className="w-full" disabled={!canSubmit}>
              {isSubmitting ? <Spinner data-icon="inline-start" /> : null}
              {isSubmitting ? t("joining") : t("join")}
            </Button>
          </form>
        </div>
      </div>
    );
  },
});
