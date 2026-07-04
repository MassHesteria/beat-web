import { suffixArray, type SuffixArray } from "./suffix-array";

export type LpfArray = SuffixArray & {
  lengths: number[];
  offsets: number[];
};

export function lpfArray(input: Uint8Array): LpfArray {
  const sa = suffixArray(input);
  const lengths = new Array(sa.input.length + 1);
  const offsets = new Array(sa.input.length + 1);

  suffixArrayLpf(sa.sa, lengths, offsets, sa.input);

  return { ...sa, lengths, offsets };
}

export function lpfPrevious(lpf: LpfArray, address: number): { length: number; offset: number } {
  return {
    length: lpf.lengths[address],
    offset: lpf.offsets[address],
  };
}

// Longest previous factor, O(n).
function suffixArrayLpf(sa: number[], lengths: number[], offsets: number[], input: Uint8Array) {
  let k = 0;
  const size = input.length;

  lengths.fill(-1);
  offsets.fill(-1);

  const phi = new Int32Array(sa.length);
  for (let i = 1; i < sa.length; i++) phi[sa[i]] = sa[i - 1];

  type Frame = { type: "call" | "post"; i: number; j: number; k: number };
  const stack: Frame[] = [];
  const call = (x: number, y: number, z: number) => {
    stack.push({ type: "call", i: Math.max(x, y), j: Math.min(x, y), k: z });
  };
  const post = (x: number, y: number, z: number) => {
    stack.push({ type: "post", i: x, j: y, k: z });
  };

  for (let i = 0; i < size; i++) {
    const j = phi[i];

    while (i + k < size && j + k < size && input[i + k] === input[j + k]) k++;

    call(i, j, k);

    while (stack.length) {
      const frame = stack.pop() as Frame;
      if (frame.type === "post") {
        lengths[frame.i] = frame.k;
        offsets[frame.i] = frame.j;
        continue;
      }

      const { i: ii, j: jj, k: kk } = frame;
      if (lengths[ii] < 0) {
        lengths[ii] = kk;
        offsets[ii] = jj;
      } else if (lengths[ii] < kk) {
        post(ii, jj, kk);
        call(offsets[ii], jj, lengths[ii]);
      } else {
        call(offsets[ii], jj, kk);
      }
    }

    if (k) k--;
  }

  lengths[0] = 0;
  offsets[0] = 0;
}
