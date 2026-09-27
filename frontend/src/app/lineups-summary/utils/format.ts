const dash = '—';
export const fmtRating = (v: number | null | undefined) => (v == null ? dash : v.toFixed(1));
export const fmtNet = (v: number | null | undefined) => (v == null ? dash : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}`);
export const fmtPm = (v: number | null | undefined) => (v == null ? dash : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)}`);
export const fmtPct = (v: number | null | undefined, digits = 1) => (v == null ? dash : `${(v * 100).toFixed(digits)}`);
export const fmtInt = (v: number | null | undefined) => (v == null ? dash : Math.round(v).toLocaleString('en-US'));
export const fmtMinutes = (v: number | null | undefined) => (v == null ? dash : v.toFixed(1));
export const shortNames = (players: { name: string }[]) => players.map((p) => p.name).join(' · ');
