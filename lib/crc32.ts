export const crcTable: Uint32Array = new Uint32Array(256);

for (let n = 0; n < 256; n++) {
  let c = n;

  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }

  crcTable[n] = c;
}

export function crc32(buffer: Uint8Array | number[]) {
  let crc = 0 ^ -1;

  for (let i = 0; i < buffer.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buffer[i]) & 0xff];
  }

  return (crc ^ -1) >>> 0;
}
