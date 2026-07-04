import { crc32 } from "./crc32";
import { lpfArray, lpfPrevious } from "./lpf";
import { suffixArray, suffixArrayFind } from "./suffix-array";

const SourceRead = 0;
const TargetRead = 1;
const SourceCopy = 2;
const TargetCopy = 3;

export type ApplyBpsResult = {
  target?: Uint8Array;
  manifest: string;
  result: string;
};

export function createBpsPatch(source: Uint8Array, target: Uint8Array) {
  const beat: number[] = [0x42, 0x50, 0x53, 0x31]; // "BPS1"

  const write = (byte: number) => {
    beat.push(byte & 0xff);
  };

  const write32 = (data: number) => {
    write(data);
    write(data >> 8);
    write(data >> 16);
    write(data >> 24);
  };

  const encode = (data: number) => {
    while (true) {
      const x = data & 0x7f;
      data >>= 7;
      if (data === 0) {
        write(0x80 | x);
        break;
      }
      write(x);
      data--;
    }
  };

  encode(source.length);
  encode(target.length);
  encode(0);

  const sourceArray = suffixArray(source);
  const targetLpf = lpfArray(target);

  let outputOffset = 0;
  let sourceRelativeOffset = 0;
  let targetRelativeOffset = 0;
  let targetReadLength = 0;

  const flush = () => {
    if (!targetReadLength) return;

    encode(TargetRead | ((targetReadLength - 1) << 2));
    let offset = outputOffset - targetReadLength;
    while (targetReadLength) {
      write(target[offset++]);
      targetReadLength--;
    }
  };

  const overlap = Math.min(source.length, target.length);

  while (outputOffset < target.length) {
    let mode = TargetRead;
    let longestLength = 3;
    let longestOffset = 0;
    let length = 0;
    let offset = outputOffset;

    while (offset < overlap) {
      if (source[offset] !== target[offset]) break;
      length++;
      offset++;
    }

    if (length > longestLength) {
      mode = SourceRead;
      longestLength = length;
    }

    const sourceMatch = suffixArrayFind(sourceArray.sa, sourceArray.input, target.subarray(outputOffset));
    length = sourceMatch.length;
    offset = sourceMatch.offset;

    if (length > longestLength) {
      mode = SourceCopy;
      longestLength = length;
      longestOffset = offset;
    }

    const targetMatch = lpfPrevious(targetLpf, outputOffset);
    length = targetMatch.length;
    offset = targetMatch.offset;

    if (length > longestLength) {
      mode = TargetCopy;
      longestLength = length;
      longestOffset = offset;
    }

    if (mode === TargetRead) {
      targetReadLength++;
      outputOffset++;
      continue;
    }

    flush();
    encode(mode | ((longestLength - 1) << 2));

    if (mode === SourceCopy) {
      const relativeOffset = longestOffset - sourceRelativeOffset;
      sourceRelativeOffset = longestOffset + longestLength;
      encode((relativeOffset < 0 ? 1 : 0) | (Math.abs(relativeOffset) << 1));
    }

    if (mode === TargetCopy) {
      const relativeOffset = longestOffset - targetRelativeOffset;
      targetRelativeOffset = longestOffset + longestLength;
      encode((relativeOffset < 0 ? 1 : 0) | (Math.abs(relativeOffset) << 1));
    }

    outputOffset += longestLength;
  }

  flush();

  write32(crc32(source));
  write32(crc32(target));
  write32(crc32(beat));

  return new Uint8Array(beat);
}

export function applyBpsPatch(source: Uint8Array, beat: Uint8Array): ApplyBpsResult {
  let manifest = "";
  let target = new Uint8Array(0);

  const error = (text: string): ApplyBpsResult => ({ manifest, result: `error: ${text}` });
  const warning = (text: string): ApplyBpsResult => ({ target, manifest, result: `warning: ${text}` });
  const success = (): ApplyBpsResult => ({ target, manifest, result: "" });

  if (beat.length < 19) return error("beat size mismatch");

  let beatOffset = 0;
  const read = () => beat[beatOffset++] as number;
  const decode = (): number => {
    let data = 0;
    let shift = 1;

    while (true) {
      const x = read();
      data += (x & 0x7f) * shift;
      if (x & 0x80) break;
      shift <<= 7;
      data += shift;
    }

    return data;
  };

  if (read() !== 0x42) return error("beat header invalid");
  if (read() !== 0x50) return error("beat header invalid");
  if (read() !== 0x53) return error("beat header invalid");
  if (read() !== 0x31) return error("beat version mismatch");
  if (decode() !== source.length) return error("source size mismatch");

  const targetSize = decode();
  target = new Uint8Array(targetSize);
  let outputOffset = 0;

  const metadataSize = decode();
  for (let n = 0; n < metadataSize; n++) {
    manifest += String.fromCharCode(read());
  }

  let sourceRelativeOffset = 0;
  let targetRelativeOffset = 0;

  const write = (data: number) => {
    target[outputOffset++] = data;
  };

  while (beatOffset < beat.length - 12) {
    let length = decode();
    const mode = length & 3;
    length = (length >> 2) + 1;

    if (mode === SourceRead) {
      while (length--) write(source[outputOffset] as number);
    } else if (mode === TargetRead) {
      while (length--) write(read());
    } else {
      const data = decode();
      const offset = data & 1 ? -(data >> 1) : data >> 1;

      if (mode === SourceCopy) {
        sourceRelativeOffset += offset;
        while (length--) write(source[sourceRelativeOffset++] as number);
      } else {
        targetRelativeOffset += offset;
        while (length--) write(target[targetRelativeOffset++] as number);
      }
    }
  }

  const read32 = () => read() | (read() << 8) | (read() << 16) | (read() << 24);
  const sourceHash = read32() >>> 0;
  const targetHash = read32() >>> 0;
  const beatHash = read32() >>> 0;

  if (outputOffset !== targetSize) return warning("target size mismatch");
  if (sourceHash !== crc32(source)) return warning("source hash mismatch");
  if (targetHash !== crc32(target)) return warning("target hash mismatch");
  if (beatHash !== crc32(beat.subarray(0, beat.length - 4))) return warning("beat hash mismatch");

  return success();
}
