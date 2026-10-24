export function formatKda(match) {
  return [match.kills, match.deaths, match.assists]
    .map((value) => Number.isInteger(value) ? value : "—")
    .join(" / ");
}
