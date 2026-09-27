export function teamColorVar(teamId: string, teams?: { team_id: string; name: string }[]): string {
  if (!teams || !teamId) return 'var(--fg-muted)';
  const sorted = [...teams].sort((a, b) => a.name.localeCompare(b.name));
  const idx = sorted.findIndex((t) => t.team_id === teamId);
  if (idx === 0) return 'var(--team-1)';
  if (idx === 1) return 'var(--team-2)';
  if (idx === 2) return 'var(--team-3)';
  return 'var(--fg-muted)';
}
