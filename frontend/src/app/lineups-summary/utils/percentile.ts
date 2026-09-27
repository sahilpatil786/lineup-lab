export function percentileRanks(values: (number | null)[]): (number | null)[] {
  const sorted = values.filter((v): v is number => v != null).sort((a, b) => a - b);
  const n = sorted.length;
  return values.map((v) => {
    if (v == null || n < 2) return null;
    let lo = 0, hi = n;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid] < v) lo = mid + 1; else hi = mid; }
    let eq = lo; while (eq < n && sorted[eq] === v) eq++;
    return ((lo + eq - 1) / 2) / (n - 1);
  });
}
