import { useRef, useState } from "react";
import { ArrowLeftRight, RefreshCw, Shield, UserRound } from "lucide-react";
import { api } from "../api.js";

const MEDALS = ["Рекрут", "Страж", "Рыцарь", "Герой", "Легенда", "Властелин", "Божество", "Титан"];

function rankLabel(rankTier) {
  if (!Number.isInteger(rankTier) || rankTier < 10) return "Ранг не опубликован";
  const medal = MEDALS[Math.min(7, Math.floor(rankTier / 10) - 1)];
  const stars = rankTier % 10;
  return `${medal}${stars ? ` · ${stars}★` : ""}`;
}

function formatValue(value, suffix = "") {
  return value == null ? "—" : `${value.toLocaleString("ru-RU")}${suffix}`;
}

function ComparePlayer({ player }) {
  const { analysis } = player;
  const metrics = [
    ["Рейтинговые матчи в выборке", formatValue(analysis.matches)],
    ["Победы · поражения", `${analysis.wins} · ${analysis.losses}`],
    ["Винрейт", formatValue(analysis.winRate, "%")],
    ["KDA", formatValue(analysis.averageKda)],
    ["Средний GPM", formatValue(analysis.averageGpm.value)],
    ["Средний XPM", formatValue(analysis.averageXpm.value)],
    ["Средние ластхиты", formatValue(analysis.averageLastHits.value)],
    ["Средние денайи", formatValue(analysis.averageDenies.value)],
  ];

  return (
    <article className="card compare-player">
      <header className="compare-player-header">
        {player.avatarUrl
          ? <img src={player.avatarUrl} alt="" onError={(event) => { event.currentTarget.hidden = true; }} />
          : <span className="compare-avatar-fallback" aria-hidden="true">{player.name.slice(0, 1).toUpperCase()}</span>}
        <div>
          <h2>{player.name}</h2>
          <p><Shield size={13} aria-hidden="true" />{rankLabel(player.rankTier)}</p>
          <small>Steam account ID: {player.accountId}</small>
        </div>
      </header>
      <div className="compare-metrics">
        {metrics.map(([label, value]) => (
          <div className="compare-metric" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      {analysis.matches === 0 && <p className="analytics-note">В доступных публичных данных нет рейтинговых матчей для расчёта показателей.</p>}
    </article>
  );
}

function ComparisonPage({ accountId, onConnect }) {
  const [opponentId, setOpponentId] = useState("");
  const [comparison, setComparison] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const requestSequence = useRef(0);

  const comparePlayers = async (event) => {
    event.preventDefault();
    if (!accountId) {
      setError("Сначала подключите свой профиль Steam.");
      return;
    }
    if (!opponentId.trim()) {
      setError("Введите Steam account ID или SteamID64 второго игрока.");
      return;
    }
    const requestId = ++requestSequence.current;
    setComparison(null);
    setLoading(true);
    setError("");
    try {
      const result = await api.compare(accountId, opponentId.trim());
      if (requestId === requestSequence.current) setComparison(result);
    } catch (requestError) {
      if (requestId === requestSequence.current) setError(requestError.message || "Не удалось сравнить профили.");
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  };

  return (
    <section className="view-transition comparison-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">DOTA 2 · ПУБЛИЧНАЯ СТАТИСТИКА</p>
          <h1>Сравнение игроков</h1>
          <p className="heading-subtitle">Сравнение по последним доступным рейтинговым матчам OpenDota. Профили не сохраняются.</p>
        </div>
      </header>

      <form className="card compare-form" onSubmit={comparePlayers}>
        <div className="compare-form-copy">
          <ArrowLeftRight size={18} aria-hidden="true" />
          <div><b>С кем сравним?</b><small>Можно указать числовой account ID или SteamID64.</small></div>
        </div>
        <label className="visually-hidden" htmlFor="compare-opponent-id">Steam ID второго игрока</label>
        <input
          id="compare-opponent-id"
          inputMode="numeric"
          autoComplete="off"
          value={opponentId}
          onChange={(event) => setOpponentId(event.target.value)}
          placeholder="Steam account ID / SteamID64"
          required
        />
        <button className="button primary" type="submit" disabled={loading}>
          <RefreshCw size={14} aria-hidden="true" />
          {loading ? "Сравниваем…" : "Сравнить"}
        </button>
      </form>

      {error && <div className="notice" role="alert">{error}</div>}
      {!accountId && !error && (
        <div className="card analytics-empty">
          <Shield size={24} aria-hidden="true" />
          <h2>Сначала подключите свой профиль</h2>
          <p>Сравнение загружает свежую выборку матчей для обоих публичных Steam-профилей.</p>
          <button className="button primary" type="button" onClick={onConnect}>
            <UserRound size={15} aria-hidden="true" />Подключить профиль
          </button>
        </div>
      )}
      {loading && <div className="card analytics-empty" role="status">Загружаем публичные профили и последние матчи…</div>}
      {comparison && !loading && (
        <>
          <p className="compare-sample-note">Учитываются только рейтинговые матчи; выборка — до {comparison.sampleLimit} последних матчей для каждого игрока. Доступность метрик зависит от данных OpenDota.</p>
          <div className="comparison-grid">
            {comparison.players.map((player) => <ComparePlayer key={player.accountId} player={player} />)}
          </div>
        </>
      )}
    </section>
  );
}

export default ComparisonPage;
