export type SuffixArray = {
  input: Uint8Array;
  sa: number[];
};

export function suffixArray(data: Uint8Array): SuffixArray {
  return {
    input: data,
    sa: inducedSort(data),
  };
}

export function suffixArrayFind(
  sa: number[],
  input: Uint8Array,
  match: Uint8Array,
): { result: boolean; length: number; offset: number } {
  let length = 0;
  let offset = 0;
  let l = 0;
  let r = input.length;

  while (l < r - 1) {
    const m = (l + r) >> 1;
    const s = sa[m];
    let k = 0;

    while (k < match.length && s + k < input.length) {
      if (match[k] !== input[s + k]) break;
      k++;
    }

    if (k > length) {
      length = k;
      offset = s;
      if (k === match.length) return { result: true, length, offset };
    }

    if (k === match.length || s + k === input.length) k--;

    if (match[k] < input[s + k]) {
      r = m;
    } else {
      l = m;
    }
  }

  return { result: false, length, offset };
}

// O(n) time, O(n) space SA-IS suffix array construction.
export function inducedSort(data: Uint8Array | number[], characters = 256): number[] {
  const size = data?.length ?? 0;
  if (size === 0) return [0];
  if (size === 1) return [1, 0];

  // 0 = S-suffix (sort before next suffix), 1 = L-suffix (sort after next suffix)
  const types = new Uint8Array(size + 1);
  types[size] = 0;
  types[size - 1] = 1;

  for (let n = size - 2; n >= 0; n--) {
    const curr = data[n];
    const next = data[n + 1];

    if (curr < next) {
      types[n] = 0;
    } else if (curr > next) {
      types[n] = 1;
    } else {
      types[n] = types[n + 1];
    }
  }

  const isLMS = (n: number): boolean => {
    if (n === 0) return false;
    return !types[n] && !!types[n - 1];
  };

  const isEqual = (lhs: number, rhs: number): boolean => {
    if (lhs === size || rhs === size) return false;

    let n = 0;
    while (true) {
      const lhsLMS = isLMS(lhs + n);
      const rhsLMS = isLMS(rhs + n);
      if (n && lhsLMS && rhsLMS) return true;
      if (lhsLMS !== rhsLMS) return false;
      if (data[lhs + n] !== data[rhs + n]) return false;
      n++;
    }
  };

  const counts: number[] = new Array(characters).fill(0);
  for (let n = 0; n < size; n++) counts[data[n]]++;

  const heads: number[] = new Array(characters).fill(0);
  const getHeads = () => {
    let headOffset = 1;
    for (let n = 0; n < characters; n++) {
      heads[n] = headOffset;
      headOffset += counts[n];
    }
  };

  const tails: number[] = new Array(characters).fill(0);
  const getTails = () => {
    let tailOffset = 1;
    for (let n = 0; n < characters; n++) {
      tailOffset += counts[n];
      tails[n] = tailOffset - 1;
    }
  };

  const suffixes: number[] = new Array(size + 1).fill(-1);

  getTails();
  for (let n = 0; n < size; n++) {
    if (!isLMS(n)) continue;
    const di = data[n];
    suffixes[tails[di]] = n;
    tails[di]--;
  }
  suffixes[0] = size;

  const sortL = () => {
    getHeads();
    for (let n = 0; n < size + 1; n++) {
      if (suffixes[n] === -1) continue;
      const l = suffixes[n] - 1;
      if (l < 0 || !types[l]) continue;
      suffixes[heads[data[l]]] = l;
      heads[data[l]]++;
    }
  };

  const sortS = () => {
    getTails();
    for (let n = size; n >= 0; n--) {
      const l = suffixes[n] - 1;
      if (l < 0 || types[l]) continue;
      suffixes[tails[data[l]]] = l;
      tails[data[l]]--;
    }
  };

  sortL();
  sortS();

  const names: number[] = new Array(size + 1).fill(-1);
  let currentName = 0;
  let lastLMSOffset = suffixes[0];
  names[lastLMSOffset] = currentName;

  for (let n = 1; n < size + 1; n++) {
    const offset = suffixes[n];
    if (!isLMS(offset)) continue;
    if (!isEqual(lastLMSOffset, offset)) currentName++;
    lastLMSOffset = offset;
    names[lastLMSOffset] = currentName;
  }

  const summaryOffsets: number[] = [];
  const summaryData: number[] = [];
  for (let n = 0; n < size + 1; n++) {
    if (names[n] === -1) continue;
    summaryOffsets.push(n);
    summaryData.push(names[n]);
  }

  const summaryCharacters = currentName + 1;
  let summaries: number[];
  if (summaryData.length === summaryCharacters) {
    summaries = new Array(summaryData.length).fill(-1);
    summaries[0] = summaryData.length;
    for (let x = 0; x < summaryData.length; x++) {
      summaries[summaryData[x] + 1] = x;
    }
  } else {
    summaries = inducedSort(summaryData, summaryCharacters);
  }

  suffixes.fill(-1);

  getTails();
  for (let n = summaries.length - 1; n >= 2; n--) {
    const index = summaryOffsets[summaries[n]];
    suffixes[tails[data[index]]] = index;
    tails[data[index]]--;
  }
  suffixes[0] = size;

  sortL();
  sortS();

  return suffixes;
}
