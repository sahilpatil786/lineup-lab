export const slice = (p: number, start: number, len: number) => Math.min(1, Math.max(0, (p - start) / len));
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
