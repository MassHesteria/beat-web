import { crc32 } from "./crc32";
import { lpfArray, lpfPrevious } from "./lpf";
import { suffixArray, suffixArrayFind } from "./suffix-array";

const SourceRead = 0;
const TargetRead = 1;
const SourceCopy = 2;
const TargetCopy = 3;

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
  encode(0); // empty metadata

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
