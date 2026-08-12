import { describe, expect, test } from "vite-plus/test";

import {
  detectContentType,
  isEnabledUploadPreset,
  UPLOAD_PRESET_DEFINITIONS,
  validateDetectedContentType,
} from "./uploadPresets";

/** CRC-32 (IEEE) for stored ZIP entries. */
function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    crc ^= data[i]!;
    for (let j = 0; j < 8; j += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint16LE(target: number[], value: number): void {
  target.push(value & 0xff, (value >>> 8) & 0xff);
}

function writeUint32LE(target: number[], value: number): void {
  target.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

type ZipEntry = { name: string; data: Uint8Array };

function buildStoredZip(entries: ZipEntry[]): Uint8Array {
  const localParts: number[] = [];
  const centralParts: number[] = [];
  const localOffsets: number[] = [];

  for (const entry of entries) {
    const nameBytes = Array.from(entry.name, (ch) => ch.charCodeAt(0));
    const data = entry.data;
    const checksum = crc32(data);
    localOffsets.push(localParts.length);

    writeUint32LE(localParts, 0x04034b50);
    writeUint16LE(localParts, 20);
    writeUint16LE(localParts, 0);
    writeUint16LE(localParts, 0);
    writeUint16LE(localParts, 0);
    writeUint16LE(localParts, 0);
    writeUint32LE(localParts, checksum);
    writeUint32LE(localParts, data.length);
    writeUint32LE(localParts, data.length);
    writeUint16LE(localParts, nameBytes.length);
    writeUint16LE(localParts, 0);
    localParts.push(...nameBytes);
    localParts.push(...data);

    writeUint32LE(centralParts, 0x02014b50);
    writeUint16LE(centralParts, 20);
    writeUint16LE(centralParts, 20);
    writeUint16LE(centralParts, 0);
    writeUint16LE(centralParts, 0);
    writeUint16LE(centralParts, 0);
    writeUint16LE(centralParts, 0);
    writeUint32LE(centralParts, checksum);
    writeUint32LE(centralParts, data.length);
    writeUint32LE(centralParts, data.length);
    writeUint16LE(centralParts, nameBytes.length);
    writeUint16LE(centralParts, 0);
    writeUint16LE(centralParts, 0);
    writeUint16LE(centralParts, 0);
    writeUint16LE(centralParts, 0);
    writeUint32LE(centralParts, 0);
    writeUint32LE(centralParts, localOffsets[localOffsets.length - 1]!);
    centralParts.push(...nameBytes);
  }

  const cdOffset = localParts.length;
  const eocd: number[] = [];
  writeUint32LE(eocd, 0x06054b50);
  writeUint16LE(eocd, 0);
  writeUint16LE(eocd, 0);
  writeUint16LE(eocd, entries.length);
  writeUint16LE(eocd, entries.length);
  writeUint32LE(eocd, centralParts.length);
  writeUint32LE(eocd, cdOffset);
  writeUint16LE(eocd, 0);

  return new Uint8Array([...localParts, ...centralParts, ...eocd]);
}

const emptyXml = new TextEncoder().encode("<Types/>");
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

describe("documents upload preset", () => {
  test("documents preset is enabled", () => {
    expect(isEnabledUploadPreset("documents")).toBe(true);
  });

  test("allowlist is PDF, DOCX, TXT only", () => {
    expect(UPLOAD_PRESET_DEFINITIONS.documents.allowedExtensions).toEqual([
      ".pdf",
      ".docx",
      ".txt",
    ]);
    expect(UPLOAD_PRESET_DEFINITIONS.documents.allowedMimeTypes).not.toContain(
      "application/msword",
    );
  });

  test("detects PDF magic", () => {
    const bytes = new TextEncoder().encode("%PDF-1.4\n%âãÏÓ\n");
    expect(detectContentType(bytes)).toBe("application/pdf");
    expect(validateDetectedContentType("documents", "application/pdf")).toBeNull();
  });

  test("detects ASCII text", () => {
    const bytes = new TextEncoder().encode("hello world\nline two");
    expect(detectContentType(bytes)).toBe("text/plain");
    expect(validateDetectedContentType("documents", "text/plain")).toBeNull();
  });

  test("detects OOXML DOCX", () => {
    const zip = buildStoredZip([
      { name: "[Content_Types].xml", data: emptyXml },
      { name: "word/document.xml", data: emptyXml },
    ]);
    expect(detectContentType(zip)).toBe(DOCX_MIME);
    expect(validateDetectedContentType("documents", DOCX_MIME)).toBeNull();
  });

  test("rejects bare ZIP", () => {
    const zip = buildStoredZip([{ name: "readme.txt", data: new TextEncoder().encode("hi") }]);
    expect(detectContentType(zip)).toBeNull();
  });

  test("rejects XLSX-shaped ZIP", () => {
    const zip = buildStoredZip([
      { name: "[Content_Types].xml", data: emptyXml },
      { name: "xl/workbook.xml", data: emptyXml },
    ]);
    expect(detectContentType(zip)).toBeNull();
  });

  test("rejects truncated PK and random bytes", () => {
    expect(detectContentType(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toBeNull();
    expect(detectContentType(new Uint8Array([0x00, 0x01, 0x02, 0x03, 0xff]))).toBeNull();
  });

  test("rejects legacy OLE compound files", () => {
    const ole = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00]);
    expect(detectContentType(ole)).toBeNull();
  });
});
