import { describe, expect, test } from "vite-plus/test";

import { isDocxOoxml, listZipCentralDirectoryNames } from "./zipEntries";

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

/** Build a minimal stored (method 0) ZIP archive. */
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

describe("listZipCentralDirectoryNames", () => {
  test("lists entry names from a stored ZIP", () => {
    const zip = buildStoredZip([
      { name: "[Content_Types].xml", data: emptyXml },
      { name: "word/document.xml", data: emptyXml },
    ]);
    expect(listZipCentralDirectoryNames(zip)).toEqual(["[Content_Types].xml", "word/document.xml"]);
  });

  test("returns null for truncated PK header", () => {
    expect(listZipCentralDirectoryNames(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toBeNull();
  });
});

describe("isDocxOoxml", () => {
  test("accepts a mini DOCX-shaped archive", () => {
    const zip = buildStoredZip([
      { name: "[Content_Types].xml", data: emptyXml },
      { name: "word/document.xml", data: emptyXml },
    ]);
    expect(isDocxOoxml(zip)).toBe(true);
  });

  test("rejects bare ZIP without OOXML parts", () => {
    const zip = buildStoredZip([{ name: "readme.txt", data: new TextEncoder().encode("hi") }]);
    expect(isDocxOoxml(zip)).toBe(false);
  });

  test("rejects XLSX-shaped archive (xl/ without word/)", () => {
    const zip = buildStoredZip([
      { name: "[Content_Types].xml", data: emptyXml },
      { name: "xl/workbook.xml", data: emptyXml },
    ]);
    expect(isDocxOoxml(zip)).toBe(false);
  });

  test("rejects Content_Types without word/", () => {
    const zip = buildStoredZip([{ name: "[Content_Types].xml", data: emptyXml }]);
    expect(isDocxOoxml(zip)).toBe(false);
  });

  test("rejects empty EOCD-only archive", () => {
    const eocd = [0x50, 0x4b, 0x05, 0x06, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    expect(isDocxOoxml(new Uint8Array(eocd))).toBe(false);
  });
});
