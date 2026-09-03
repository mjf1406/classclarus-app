import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QRCodeSVG } from "qrcode.react";

import { APP_CONFIG } from "@/config/app";
import { getLanguageOption, toIntlLocale, type AppLanguage } from "@/lib/languages";
import { formatJoinCodeDisplay, joinCodeShareUrl } from "@/lib/invitations/joinCodes";
import {
  buildPrintDocumentClose,
  buildPrintDocumentOpen,
  escapePrintHtml,
  resolveAppAssetUrl,
} from "@/lib/print/printDocument";
import { printHtmlDocument } from "@/lib/print/printFrame";

export const GUARDIAN_INVITE_PRINT_LOGO_PATH = "/brand/logo/icon-above-text.webp";
export const GUARDIAN_INVITE_SLIPS_PER_PAGE = 9;
const QR_SIZE = 112;

export type GuardianInviteSlip = {
  studentName: string;
  code: string;
  shareUrl: string;
  expiresAt: number;
};

export type GuardianInvitePrintLabels = {
  documentTitle: string;
  studentLabel: string;
  codeLabel: string;
  expiresLabel: (date: string) => string;
  step1: string;
  step2: string;
  step3: string;
  logoAlt: string;
  lang: AppLanguage;
};

export function chunkGuardianInviteSlips<T>(
  items: Array<T>,
  size = GUARDIAN_INVITE_SLIPS_PER_PAGE,
) {
  const pages: Array<Array<T>> = [];
  for (let index = 0; index < items.length; index += size) {
    pages.push(items.slice(index, index + size));
  }
  return pages;
}

export function formatGuardianInviteExpiry(expiresAt: number, language: AppLanguage): string {
  return new Intl.DateTimeFormat(toIntlLocale(language), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(expiresAt));
}

export function renderGuardianInviteQrSvg(shareUrl: string): string {
  return renderToStaticMarkup(
    createElement(QRCodeSVG, {
      value: shareUrl,
      size: QR_SIZE,
      level: "M",
      marginSize: 1,
      bgColor: "#FFFFFF",
      fgColor: "#000000",
    }),
  );
}

function buildSlipHtml(
  slip: GuardianInviteSlip,
  labels: GuardianInvitePrintLabels,
  logoUrl: string,
) {
  const qrSvg = renderGuardianInviteQrSvg(slip.shareUrl);
  const expires = labels.expiresLabel(formatGuardianInviteExpiry(slip.expiresAt, labels.lang));
  return `<article class="slip">
  <img class="logo" src="${escapePrintHtml(logoUrl)}" alt="${escapePrintHtml(labels.logoAlt)}" />
  <div class="qr">${qrSvg}</div>
  <p class="student"><span class="label">${escapePrintHtml(labels.studentLabel)}</span> ${escapePrintHtml(slip.studentName)}</p>
  <p class="code"><span class="label">${escapePrintHtml(labels.codeLabel)}</span> ${escapePrintHtml(formatJoinCodeDisplay(slip.code))}</p>
  <ol class="steps">
    <li>${escapePrintHtml(labels.step1)}</li>
    <li>${escapePrintHtml(labels.step2)}</li>
    <li>${escapePrintHtml(labels.step3)}</li>
  </ol>
  <p class="expires">${escapePrintHtml(expires)}</p>
</article>`;
}

export function buildGuardianInviteSheetHtml(
  slips: Array<GuardianInviteSlip>,
  labels: GuardianInvitePrintLabels,
  logoUrl: string,
): string {
  const pages = chunkGuardianInviteSlips(slips);
  const pageHtml = pages
    .map((pageSlips, pageIndex) => {
      const last = pageIndex === pages.length - 1;
      const cells = pageSlips.map((slip) => buildSlipHtml(slip, labels, logoUrl)).join("");
      return `<section class="page${last ? " page-last" : ""}">${cells}</section>`;
    })
    .join("");

  return `${buildPrintDocumentOpen({
    title: labels.documentTitle,
    bodyClass: "print-guardian-invites",
    lang: getLanguageOption(labels.lang).htmlLang,
  })}
${pageHtml}${buildPrintDocumentClose()}`;
}

export async function printGuardianInviteSheets(
  slips: Array<GuardianInviteSlip>,
  labels: GuardianInvitePrintLabels,
): Promise<void> {
  if (slips.length === 0) {
    throw new Error("Nothing to print");
  }
  const logoUrl = resolveAppAssetUrl(GUARDIAN_INVITE_PRINT_LOGO_PATH);
  const html = buildGuardianInviteSheetHtml(slips, labels, logoUrl);
  await printHtmlDocument({ documentTitle: labels.documentTitle, html });
}

export function toGuardianInviteSlips(
  codes: Array<{ code: string; studentUserId: string; expiresAt: number }>,
  namesByStudentId: Map<string, string>,
  unnamedFallback: string,
): Array<GuardianInviteSlip> {
  return codes.map((code) => ({
    studentName: namesByStudentId.get(code.studentUserId) ?? unnamedFallback,
    code: code.code,
    shareUrl: joinCodeShareUrl(code.code),
    expiresAt: code.expiresAt,
  }));
}

export function guardianInvitePrintLogoAlt(): string {
  return `${APP_CONFIG.name} logo`;
}
