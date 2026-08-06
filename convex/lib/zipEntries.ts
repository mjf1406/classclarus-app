/**
 * Minimal ZIP central-directory reader for OOXML sniffing.
 * Pure TypeScript — no inflate, no npm ZIP libs, safe in Convex isolate actions.
 */

const EOCD_SIG = 0x06054b50;
const CDFH_SIG = 0x02014b50;
const LOCAL_FILE_SIG = 0x04034b50;
/** EOCD is 22 bytes + optional comment (max 65535). */
const MAX_EOCD_SEARCH = 22 + 65535;

function readUint16LE(bytes: Uint8Array, offset: number): number | null {
  if (offset + 2 > bytes.length) {
    return null;
  }
  return bytes[offset]! | (bytes[offset + 1]! << 8);
}

function readUint32LE(bytes: Uint8Array, offset: number): number | null {
  if (offset + 4 > bytes.length) {
    return null;
  }
  return (
    (bytes[offset]! |
      (bytes[offset + 1]! << 8) |
      (bytes[offset + 2]! << 16) |
      (bytes[offset + 3]! << 24)) >>>
    0
  );
}

function findEocdOffset(bytes: Uint8Array): number | null {
  if (bytes.length < 22) {
    return null;
  }
  const searchStart = Math.max(0, bytes.length - MAX_EOCD_SEARCH);
  for (let i = bytes.length - 22; i >= searchStart; i -= 1) {
    const sig = readUint32LE(bytes, i);
    if (sig !== EOCD_SIG) {
      continue;
    }
    const commentLen = readUint16LE(bytes, i + 20);
    if (commentLen === null) {
      return null;
    }
    if (i + 22 + commentLen === bytes.length) {
      return i;
    }
  }
  return null;
}

/**
 * List entry names from the ZIP central directory.
 * Returns null when the archive is truncated, malformed, or ZIP64 (unsupported here).
 */
export function listZipCentralDirectoryNames(bytes: Uint8Array): string[] | null {
  const eocd = findEocdOffset(bytes);
  if (eocd === null) {
    return null;
  }

  const diskNumber = readUint16LE(bytes, eocd + 4);
  const cdDisk = readUint16LE(bytes, eocd + 6);
  const entriesOnDisk = readUint16LE(bytes, eocd + 8);
  const totalEntries = readUint16LE(bytes, eocd + 10);
  const cdSize = readUint32LE(bytes, eocd + 12);
  const cdOffset = readUint32LE(bytes, eocd + 16);
  if (
    diskNumber === null ||
    cdDisk === null ||
    entriesOnDisk === null ||
    totalEntries === null ||
    cdSize === null ||
    cdOffset === null
  ) {
    return null;
  }

  // Multi-disk / ZIP64 markers — fail closed for our small document uploads.
  if (diskNumber !== 0 || cdDisk !== 0) {
    return null;
  }
  if (totalEntries === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
    return null;
  }
  if (entriesOnDisk !== totalEntries) {
    return null;
  }
  if (cdOffset + cdSize > eocd) {
    return null;
  }

  const names: string[] = [];
  let offset = cdOffset;
  const cdEnd = cdOffset + cdSize;

  for (let i = 0; i < totalEntries; i += 1) {
    if (offset + 46 > cdEnd) {
      return null;
    }
    const sig = readUint32LE(bytes, offset);
    if (sig !== CDFH_SIG) {
      return null;
    }
    const nameLen = readUint16LE(bytes, offset + 28);
    const extraLen = readUint16LE(bytes, offset + 30);
    const commentLen = readUint16LE(bytes, offset + 32);
    if (nameLen === null || extraLen === null || commentLen === null) {
      return null;
    }
    const nameStart = offset + 46;
    const nameEnd = nameStart + nameLen;
    if (nameEnd + extraLen + commentLen > cdEnd) {
      return null;
    }
    // OOXML part names are ASCII; decode as latin1-safe bytes.
    let name = "";
    for (let j = nameStart; j < nameEnd; j += 1) {
      name += String.fromCharCode(bytes[j]!);
    }
    names.push(name);
    offset = nameEnd + extraLen + commentLen;
  }

  if (offset !== cdEnd) {
    return null;
  }

  return names;
}

/**
 * True when bytes look like a DOCX OOXML package:
 * local ZIP header + `[Content_Types].xml` + at least one `word/` entry.
 */
export function isDocxOoxml(bytes: Uint8Array): boolean {
  if (bytes.length < 4) {
    return false;
  }
  const localSig = readUint32LE(bytes, 0);
  if (localSig !== LOCAL_FILE_SIG) {
    return false;
  }

  const names = listZipCentralDirectoryNames(bytes);
  if (names === null || names.length === 0) {
    return false;
  }

  const hasContentTypes = names.includes("[Content_Types].xml");
  const hasWordPart = names.some((name) => name.startsWith("word/"));
  return hasContentTypes && hasWordPart;
}
