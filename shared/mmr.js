export function formatEstimatedMmrChange(value) {
  if (!Number.isFinite(value)) return "—";
  return `≈ ${value > 0 ? "+" : ""}${value} MMR`;
}
