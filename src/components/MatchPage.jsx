import React, { useMemo, useState } from "react";
import { Activity, LoaderCircle, Package, RefreshCw, Search, Swords, TrendingUp, UserRound, Users } from "lucide-react";
import HeroMark from "./HeroMark";
import { formatEstimatedMmrChange } from "../../shared/mmr.js";
import { filterAndSortMatches } from "../../shared/match-filters.js";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const numberLabel = (value) => Number.isFinite(value) ? value.toLocaleString("ru-RU") : "—";
const moneyLabel = (value) => Number.isFinite(value) ? `${value.toLocaleString("ru-RU")} зол.` : "—";
const durationLabel = (seconds) => {
  if (!Number.isFinite(seconds)) return "—";
  const minutes = Math.floor(Math.abs(seconds) / 60);
  const remainder = Math.floor(Math.abs(seconds) % 60).toString().padStart(2, "0");
  return `${seconds < 0 ? "−" : ""}${minutes}:${remainder}`;
};

function MatchPage({
  matches,
  match,
  selected,
  setSelected,
  stats,
  query,
  setQuery,
  accountId,
  details,
  itemTimingBenchmarks,
  detailsLoading,
  detailsError,
  parsePending,
  parseLoading,
  onRetryDetails,
  onRequestMatchParse,
  totalMatches,
  hasMoreMatches,
  loadingMoreMatches,
  loadMoreMatchesError,
  onLoadMoreMatches,
  onConnect,
  onRefresh,
  syncing,
}) {
  const [resultFilter, setResultFilter] = useState("all");
  const [heroFilter, setHeroFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [durationFilter, setDurationFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest");

  const heroes = useMemo(() => [...new Set(matches.map((entry) => entry.hero).filter(Boolean))]
    .sort((first, second) => first.localeCompare(second, "ru")), [matches]);
  const filteredMatches = useMemo(() => {
    const periodDays = { "7d": 7, "30d": 30, "90d": 90 }[periodFilter];
    return filterAndSortMatches(matches, {
      query,
      result: resultFilter,
      hero: heroFilter,
      periodDays,
      duration: durationFilter,
      sortOrder,
    });
  }, [durationFilter, heroFilter, matches, periodFilter, query, resultFilter, sortOrder]);

  if (!matches.length) {
    return (
      <section className="view-transition match-page">
        <header className="page-heading">
          <div>
            <p className="eyebrow">ИСТОРИЯ И АНАЛИТИКА</p>
            <h1>Матчи</h1>
            <p className="heading-subtitle">Результаты, предметы и статистика обеих команд.</p>
          </div>
        </header>
        <div className="card analytics-empty">
          <Swords size={24} aria-hidden="true" />
          <h2>{accountId ? "История матчей пока пуста" : "Подключите профиль, чтобы увидеть матчи"}</h2>
          <p>{accountId
            ? "Проверьте, что в Dota 2 включена настройка Expose Public Match Data, затем обновите данные."
            : "История загрузится из OpenDota после подключения публичного профиля Steam."}</p>
          {accountId ? (
            <button className="button primary" type="button" onClick={onRefresh} disabled={syncing}>
              <RefreshCw size={14} aria-hidden="true" />{syncing ? "Обновляем…" : "Обновить историю"}
            </button>
          ) : (
            <button className="button primary" type="button" onClick={onConnect}>
              <UserRound size={15} aria-hidden="true" />Подключить профиль
            </button>
          )}
        </div>
      </section>
    );
  }
  if (!match) {
    return <div className="empty-state">Не удалось выбрать матч из сохранённой истории. Обновите данные профиля.</div>;
  }

  const goldTimeline = Array.isArray(match.gold) ? match.gold : [];
  const lastHitsTimeline = Array.isArray(match.lastHits) ? match.lastHits : [];
  const xpTimeline = Array.isArray(match.xp) ? match.xp : [];
  const timelineLength = Math.max(goldTimeline.length, lastHitsTimeline.length);
  const timeline = Array.from({ length: timelineLength }, (_, index) => ({
    minute: index,
    gold: goldTimeline[index],
    lh: lastHitsTimeline[index],
  }));
  const xpData = xpTimeline.map((xp, minute) => ({ minute, xp }));
  const goldAdvantage = details?.matchInfo?.radiantGoldAdvantage || [];
  const goldAdvantageData = goldAdvantage.map((value, minute) => ({ minute, value }));
  const teams = details?.teams;
  const allPlayers = [...(teams?.radiant?.members || []), ...(teams?.dire?.members || [])];
  const accountRosterPlayers = allPlayers.filter((player) => player.accountId === accountId);
  const heroRosterPlayers = allPlayers.filter((player) => player.heroId === match.heroId);
  const selectedRosterPlayer = accountRosterPlayers.length === 1
    ? accountRosterPlayers[0]
    : heroRosterPlayers.length === 1 ? heroRosterPlayers[0] : null;
  const hasCompleteTeams = teams?.radiant?.members?.length === 5 && teams?.dire?.members?.length === 5;
  const purchaseLog = details?.selectedPlayer?.purchaseLog || [];
  const currentPurchaseIds = new Set(purchaseLog.map((item) => item.id));
  const itemTimingById = new Map((itemTimingBenchmarks?.items || []).map((item) => [item.id, item]));
  const itemSuggestions = (itemTimingBenchmarks?.items || [])
    .filter((item) => item.win.samples >= 3
      && item.loss.samples >= 3
      && item.win.matchRate >= 60
      && item.win.matchRate - item.loss.matchRate >= 30
      && !currentPurchaseIds.has(item.id))
    .slice(0, 4);
  const hasGpmAverage = Number.isFinite(stats?.averageGpm);
  const gpmAboveAverage = hasGpmAverage && Number.isFinite(match.gpm) && match.gpm > stats.averageGpm;

  const rankLabel = (field) => {
    const ranked = allPlayers.filter((player) => Number.isFinite(player[field]))
      .sort((first, second) => second[field] - first[field]);
    const position = ranked.findIndex((player) => player.accountId === accountId);
    return position < 0 ? "—" : `${position + 1} из ${ranked.length}`;
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">ИСТОРИЯ И АНАЛИТИКА</p>
          <h1>Матчи</h1>
          <p className="heading-subtitle">Статистика игрока, предметы и составы обеих команд.</p>
        </div>
        <label className="search-field match-search">
          <Search size={15} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Герой или ID матча..." />
        </label>
      </div>

      <div className="match-layout">
        <section className="card match-list-card">
          <div className="section-head">
            <div>
              <h3>История матчей</h3>
              <p>Показано {matches.length.toLocaleString("ru-RU")} из {totalMatches.toLocaleString("ru-RU")} рейтинговых матчей</p>
            </div>
          </div>
          <div className="match-filter-bar" aria-label="Фильтры истории матчей">
            <label>
              <span>Результат</span>
              <select value={resultFilter} onChange={(event) => setResultFilter(event.target.value)}>
                <option value="all">Все результаты</option>
                <option value="win">Победы</option>
                <option value="loss">Поражения</option>
              </select>
            </label>
            <label>
              <span>Герой</span>
              <select value={heroFilter} onChange={(event) => setHeroFilter(event.target.value)}>
                <option value="all">Все герои</option>
                {heroes.map((hero) => <option key={hero} value={hero}>{hero}</option>)}
              </select>
            </label>
            <label>
              <span>Период</span>
              <select value={periodFilter} onChange={(event) => setPeriodFilter(event.target.value)}>
                <option value="all">Всё время</option>
                <option value="7d">7 дней</option>
                <option value="30d">30 дней</option>
                <option value="90d">90 дней</option>
              </select>
            </label>
            <label>
              <span>Длительность</span>
              <select value={durationFilter} onChange={(event) => setDurationFilter(event.target.value)}>
                <option value="all">Любая</option>
                <option value="short">До 30 минут</option>
                <option value="medium">30–45 минут</option>
                <option value="long">Более 45 минут</option>
              </select>
            </label>
            <label>
              <span>Сортировка</span>
              <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}>
                <option value="newest">Сначала новые</option>
                <option value="oldest">Сначала старые</option>
                <option value="longest">Сначала долгие</option>
                <option value="shortest">Сначала короткие</option>
              </select>
            </label>
          </div>
          <div className="match-list">
            {filteredMatches.length ? (
              filteredMatches.map(({ item, index }) => (
                <div
                  key={item.matchId}
                  className={`insight-card ${item.result === "Победа" ? "win" : "loss"} ${index === selected ? "selected" : ""}`}
                  role="button"
                  aria-pressed={index === selected}
                  tabIndex={0}
                  onClick={() => setSelected(index)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelected(index);
                    }
                  }}
                >
                  <div className="insight-card-header">
                    <div className="insight-card-left">
                      <HeroMark hero={item} small />
                      <div className="insight-card-info">
                        <b>{item.hero}</b>
                        <small>{item.date}</small>
                      </div>
                    </div>
                    <div className="insight-card-result">
                      <span className={`result-badge ${item.result === "Победа" ? "win" : "loss"}`}>
                        {item.result}
                      </span>
                      <span className={`mmr-delta ${item.mmr > 0 ? "positive" : item.mmr < 0 ? "negative" : ""}`} title="Расчёт приложения по модели ±25 MMR за рейтинговую игру; не официальный результат Valve">
                        {formatEstimatedMmrChange(item.mmr)}
                      </span>
                    </div>
                  </div>
                  <div className="insight-card-stats">
                    <div className="stat-item">
                      <span>KDA</span>
                      <b>{item.kda}</b>
                    </div>
                    <div className="stat-item">
                      <span>GPM</span>
                      <b>{item.gpm ?? "—"}</b>
                    </div>
                    <div className="stat-item">
                      <span>XPM</span>
                      <b>{item.xpm ?? "—"}</b>
                    </div>
                    <div className="stat-item">
                      <span>Длительность</span>
                      <b>{item.durationLabel || "—"}</b>
                    </div>
                    <div className="stat-item">
                      <span>ЛХ / Денайи</span>
                      <b>{item.lh ?? "—"} / {item.denies ?? "—"}</b>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">Нет матчей, подходящих под выбранные фильтры.</div>
            )}
          </div>
          {loadMoreMatchesError && <p className="notice" role="alert">{loadMoreMatchesError}</p>}
          {hasMoreMatches && (
            <button className="button secondary match-load-more" type="button" onClick={onLoadMoreMatches} disabled={loadingMoreMatches}>
              {loadingMoreMatches && <LoaderCircle className="match-data-spinner" size={14} />}
              {loadingMoreMatches ? "Загружаем…" : "Загрузить ещё матчи"}
            </button>
          )}
        </section>

        <section className="card match-detail-card">
          <div className="match-detail-heading">
            <HeroMark hero={match} />
            <div>
              <h2>{match.hero}</h2>
              <p className={match.result === "Победа" ? "positive" : "negative"}>
                {match.result} <i /> {match.lane} <i /> {match.date}
              </p>
            </div>
            <span className={`mmr-pill ${match.mmr > 0 ? "up" : match.mmr < 0 ? "down" : ""}`} title="Расчёт приложения по модели ±25 MMR за рейтинговую игру; не официальный результат Valve">
              {formatEstimatedMmrChange(match.mmr)}
            </span>
          </div>

          {details?.matchInfo && Number.isFinite(details.matchInfo.radiantScore) && Number.isFinite(details.matchInfo.direScore) && (
            <div className="match-breakdown-score">
              <span>Сияние</span>
              <b>{details.matchInfo.radiantScore} : {details.matchInfo.direScore}</b>
              <span>Тьма</span>
              {details.matchInfo.radiantWin != null && (
                <small>{details.matchInfo.radiantWin ? "Победа Сияния" : "Победа Тьмы"}</small>
              )}
            </div>
          )}
          {details?.matchInfo && (
            <div className="match-breakdown-meta">
              <span>{details.matchInfo.lobbyType === 7 ? "Рейтинговый матч" : Number.isInteger(details.matchInfo.lobbyType) ? `Тип лобби · ${details.matchInfo.lobbyType}` : "Тип лобби не указан"}</span>
              <a href={`https://www.opendota.com/matches/${encodeURIComponent(match.matchId)}`} target="_blank" rel="noreferrer">
                Матч #{match.matchId}
              </a>
            </div>
          )}

          <div className="match-summary">
            <MatchMetric label="K / D / A" value={match.kda} />
            <MatchMetric label="Длительность" value={match.durationLabel || "—"} />
            <MatchMetric label="GPM" value={match.gpm ?? "—"} />
            <MatchMetric label="XPM" value={match.xpm ?? "—"} />
            <MatchMetric label="Ластхиты" value={selectedRosterPlayer?.lastHits ?? match.lh ?? "—"} />
            <MatchMetric label="Денайи" value={selectedRosterPlayer?.denies ?? match.denies ?? "—"} />
            <MatchMetric label="Net worth" value={moneyLabel(details?.selectedPlayer?.netWorth ?? selectedRosterPlayer?.netWorth)} />
            <MatchMetric label="Предметы в инвентаре" value={selectedRosterPlayer?.inventory?.length ?? "—"} />
          </div>

          {(!hasCompleteTeams || detailsError) && (
            <div className={`match-data-status ${detailsError ? "has-error" : ""}`} role="status">
              <div>
                <b>{parsePending ? "OpenDota обрабатывает матч" : detailsError ? "Не удалось загрузить данные матча" : "Составы команд ещё не получены"}</b>
                <p>
                  {parsePending
                    ? "Запрос отправлен в OpenDota. Сервис ещё обрабатывает матч — можно проверить данные повторно."
                    : detailsError
                      ? detailsError
                      : teams
                        ? `OpenDota вернула ${teams.radiant.members.length + teams.dire.members.length} из 10 игроков. Запросите разбор, чтобы получить полный состав и предметы.`
                        : "Для этого матча OpenDota ещё не подготовила составы, противников и подробную статистику."}
                </p>
              </div>
              <div className="match-data-actions">
                <button
                  type="button"
                  className="match-data-button secondary"
                  onClick={onRetryDetails}
                  disabled={detailsLoading || parseLoading}
                >
                  <RefreshCw size={14} />
                  {parsePending ? "Проверить данные" : "Повторить загрузку"}
                </button>
                <button
                  type="button"
                  className="match-data-button"
                  onClick={onRequestMatchParse}
                  disabled={detailsLoading || parseLoading || parsePending}
                >
                  {parseLoading ? <LoaderCircle className="match-data-spinner" size={14} /> : <Activity size={14} />}
                  {parseLoading ? "Запрашиваем разбор…" : parsePending ? "Разбор уже запрошен" : "Запросить разбор OpenDota"}
                </button>
              </div>
            </div>
          )}

          {teams && (
            <>
              <div className="match-breakdown-section-head match-breakdown-title">
                <div className="match-breakdown-title-icon"><Users size={17} /></div>
                <div><h3>Составы и противники</h3><p>Фарм, статистика и предметы всех игроков</p></div>
              </div>
              <div className="match-breakdown-teams">
                {[teams.radiant, teams.dire].map((team, index) => (
                  <section className={`match-breakdown-team ${index === 0 ? "radiant" : "dire"}`} key={team.name}>
                    <div className="match-breakdown-team-heading">
                      <div><b>{team.name}</b><small>{index === 0 ? "Сияние" : "Тьма"}</small></div>
                      <div className="match-breakdown-networth">
                        <b>{moneyLabel(team.netWorth)}</b>
                        <small>{team.netWorth == null
                          ? `Net worth доступен для ${team.netWorthSampleCount} из 5 игроков`
                          : "Сумма net worth команды"}</small>
                      </div>
                    </div>
                    <div className="match-breakdown-roster-wrap">
                      <table className="match-breakdown-roster">
                        <thead><tr><th>Игрок</th><th>K / D / A</th><th>GPM</th><th>XPM</th><th>ЛХ</th><th>Net worth</th><th>Предметы</th></tr></thead>
                        <tbody>
                          {team.members.map((player) => (
                            <tr className={player.slot === selectedRosterPlayer?.slot ? "current-player" : ""} key={player.slot}>
                              <td>
                                <div className="match-breakdown-player">
                                  {player.heroIcon && <img src={player.heroIcon} alt="" loading="lazy" />}
                                  <span><b>{player.name}</b><small>{player.hero}{player.lane !== "Не указана" ? ` · ${player.lane}` : ""}</small></span>
                                </div>
                              </td>
                              <td>{player.kills ?? "—"} / {player.deaths ?? "—"} / {player.assists ?? "—"}</td>
                              <td>{player.gpm ?? "—"}</td>
                              <td>{player.xpm ?? "—"}</td>
                              <td>{player.lastHits ?? "—"}</td>
                              <td>{moneyLabel(player.netWorth)}</td>
                              <td>
                                <div className="match-breakdown-row-items">
                                  {player.inventory.map((item, itemIndex) => (
                                    <span key={`${item.id}-${itemIndex}`} title={item.name || `Предмет ${item.id}`}>
                                      {item.image ? <img src={item.image} alt={item.name || "Предмет"} loading="lazy" /> : item.id}
                                    </span>
                                  ))}
                                  {player.neutralItem && (
                                    <span title={player.neutralItem.name || "Нейтральный предмет"}>
                                      {player.neutralItem.image ? <img src={player.neutralItem.image} alt="" loading="lazy" /> : player.neutralItem.id}
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ))}
              </div>
            </>
          )}

          <div className="section-head compact">
            <div>
              <h3>Фарм по минутам</h3>
              <p>Золото и ластхиты игрока</p>
            </div>
            <span className="chart-legend">
              <i className="blue-dot" /> Золото <i className="gray-dot" /> Ластхиты
            </span>
          </div>

          <div className={`chart-wrap match-chart ${timeline.length ? "" : "match-chart-empty"}`}>
            {timeline.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeline} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border-color)" vertical={false} />
                  <XAxis dataKey="minute" tickFormatter={(value) => `${value}`} tick={{ fill: "var(--text-dim)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="gold" tick={{ fill: "var(--text-dim)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="lh" orientation="right" tick={{ fill: "var(--text-dim)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 8, color: "var(--text-main)" }} />
                  <Line yAxisId="gold" type="monotone" dataKey="gold" name="Золото" stroke="#DDB46A" strokeWidth={2.5} dot={false} connectNulls />
                  <Line yAxisId="lh" type="monotone" dataKey="lh" name="Ластхиты" stroke="var(--accent-win)" strokeWidth={2} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state timeline-empty">
                {detailsLoading ? "Загружаем таймлайн матча…" : "Таймлайн появится после разбора матча OpenDota."}
              </div>
            )}
          </div>

          {!!xpData.length && (
            <>
              <div className="section-head compact match-breakdown-section-head">
                <div>
                  <h3>Опыт по минутам</h3>
                  <p>Накопленный опыт игрока</p>
                </div>
              </div>
              <div className="chart-wrap match-chart match-breakdown-xp-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={xpData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="var(--border-color)" vertical={false} />
                    <XAxis dataKey="minute" tickFormatter={(value) => `${value}`} tick={{ fill: "var(--text-dim)", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "var(--text-dim)", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 8, color: "var(--text-main)" }} />
                    <Line type="monotone" dataKey="xp" name="Опыт" stroke="#8BA6E8" strokeWidth={2.5} dot={false} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          {!!goldAdvantageData.length && (
            <>
              <div className="section-head compact match-breakdown-section-head">
                <div>
                  <h3>Перевес по золоту</h3>
                  <p>Положительное значение — преимущество Сияния</p>
                </div>
              </div>
              <div className="chart-wrap match-chart match-breakdown-xp-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={goldAdvantageData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="var(--border-color)" vertical={false} />
                    <XAxis dataKey="minute" tickFormatter={(value) => `${value}`} tick={{ fill: "var(--text-dim)", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "var(--text-dim)", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 8, color: "var(--text-main)" }} />
                    <ReferenceLine y={0} stroke="var(--text-muted)" strokeDasharray="4 4" />
                    <Line type="monotone" dataKey="value" name="Преимущество Сияния" stroke="#DDB46A" strokeWidth={2.5} dot={false} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          <div className="match-stats-grid">
            <MatchMetric label="Ластхиты на 10-й" value={lastHitsTimeline[10] ?? "—"} hint="за матч" />
            <MatchMetric label="GPM" value={match.gpm ?? "—"} hint={hasGpmAverage ? `среднее ${stats.averageGpm}` : undefined} />
            <MatchMetric label="XPM" value={match.xpm ?? "—"} hint="по матчу" />
            <MatchMetric label="Линия" value={match.lane || "—"} hint="позиция" />
          </div>

          {details?.selectedPlayer && (
            <>
              <div className="match-breakdown-section-head match-breakdown-title">
                <div className="match-breakdown-title-icon"><Swords size={17} /></div>
                <div><h3>Показатели игрока</h3><p>Данные из разбора выбранного матча</p></div>
              </div>
              <div className="match-breakdown-player-stats">
                <MatchMetric label="Net worth" value={moneyLabel(details.selectedPlayer.netWorth)} />
                <MatchMetric label="Урон героям" value={numberLabel(details.selectedPlayer.heroDamage)} />
                <MatchMetric label="Урон строениям" value={numberLabel(details.selectedPlayer.towerDamage)} />
                <MatchMetric label="Лечение" value={numberLabel(details.selectedPlayer.heroHealing)} />
                <MatchMetric label="Денай" value={numberLabel(details.selectedPlayer.denies)} />
                <MatchMetric label="Стаки лагерей" value={numberLabel(details.selectedPlayer.campsStacked)} />
                <MatchMetric label="Оглушение" value={Number.isFinite(details.selectedPlayer.stuns) ? `${details.selectedPlayer.stuns.toFixed(1)} с` : "—"} />
                <MatchMetric label="Варды" value={selectedRosterPlayer?.wards ? `${numberLabel(selectedRosterPlayer.wards.observers)} / ${numberLabel(selectedRosterPlayer.wards.sentries)}` : "—"} hint="observer / sentry" />
                <MatchMetric label="Место по GPM" value={rankLabel("gpm")} />
                <MatchMetric label="Место по ластхитам" value={rankLabel("lastHits")} />
              </div>

              {(selectedRosterPlayer?.inventory?.length || match.itemImages?.length) > 0 && (
                <div className="match-breakdown-inventory">
                  <div className="match-breakdown-title-icon"><Package size={17} /></div>
                  <div className="match-breakdown-inventory-content">
                    <b>Предметы в конце матча</b>
                    <div className="match-breakdown-items">
                      {(selectedRosterPlayer?.inventory || match.itemImages || []).map((item, index) => (
                        <span key={`${item.id}-${index}`} title={item.name || `Предмет ${item.id}`}>
                          {item.image && <img src={item.image} alt={item.name || "Предмет"} loading="lazy" />}
                          {!item.image && <small>{item.name || `#${item.id}`}</small>}
                        </span>
                      ))}
                    </div>
                    {!!selectedRosterPlayer?.backpack?.length && (
                      <small>Рюкзак: {selectedRosterPlayer.backpack.map((item) => item.name || `#${item.id}`).join(", ")}</small>
                    )}
                    {selectedRosterPlayer?.neutralItem && (
                      <small>Нейтральный предмет: {selectedRosterPlayer.neutralItem.name || `#${selectedRosterPlayer.neutralItem.id}`}</small>
                    )}
                  </div>
                </div>
              )}

              {!!details.selectedPlayer.purchaseLog?.length && (
                <div className="match-breakdown-purchases">
                  <div className="match-breakdown-title">
                    <div><b>Покупки по ходу игры</b><small>Фактические покупки из разбора OpenDota</small></div>
                    <a href={`https://www.opendota.com/matches/${encodeURIComponent(match.matchId)}`} target="_blank" rel="noreferrer">
                      Открыть разбор
                    </a>
                  </div>
                  <div>
                    {details.selectedPlayer.purchaseLog.map((item, index) => {
                      const benchmark = itemTimingById.get(item.id);
                      const winTime = benchmark?.win.medianSeconds;
                      const lossTime = benchmark?.loss.medianSeconds;
                      const timingDifference = Number.isFinite(winTime) && Number.isFinite(lossTime)
                        ? lossTime - winTime
                        : null;
                      return (
                      <span key={`${item.id}-${item.time}-${index}`} title={item.name || `Предмет ${item.id}`}>
                        {item.image && <img src={item.image} alt="" loading="lazy" />}
                        <small>
                          <b>{item.name || `#${item.id}`}</b>
                          <span>Куплен на {durationLabel(item.time)}</span>
                          {Number.isFinite(winTime) && (
                            <span>Медиана побед: {durationLabel(winTime)} · {benchmark.win.samples} игр</span>
                          )}
                          {timingDifference >= 60 && benchmark.win.samples >= 3 && benchmark.loss.samples >= 3 && (
                            <span className="purchase-timing-signal">В победах раньше на {durationLabel(timingDifference)}</span>
                          )}
                        </small>
                      </span>
                      );
                    })}
                  </div>
                  {itemTimingBenchmarks?.sampleMatches > 0 && (
                    <p className="purchase-benchmark-note">
                      Сравнение по {itemTimingBenchmarks.sampleMatches} разобранным матчам на этом герое
                      ({itemTimingBenchmarks.wins} побед, {itemTimingBenchmarks.losses} поражений). Это личная статистика, не универсальная рекомендация.
                    </p>
                  )}
                </div>
              )}
              {itemSuggestions.length > 0 && (
                <div className="item-build-insights">
                  <b>Предметы, чаще встречавшиеся в ваших победах</b>
                  <p>Сравнение только с вашими разборами на этом герое; совпадение не доказывает, что предмет сам по себе принёс победу.</p>
                  <div>
                    {itemSuggestions.map((item) => (
                      <span key={item.id}>
                        {item.image && <img src={item.image} alt="" loading="lazy" />}
                        <b>{item.name}</b>
                        <small>Победы {item.win.matchRate}% · поражения {item.loss.matchRate}%</small>
                        <small>Медиана в победах: {durationLabel(item.win.medianSeconds)}</small>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {detailsLoading && !details && <div className="match-breakdown-loading">Загружаем данные из OpenDota…</div>}

          <div className="insight">
            <Activity size={17} />
            <span>
              <b>Сравнение с вашим средним</b>
              <small>
                {hasGpmAverage
                  ? gpmAboveAverage
                    ? `GPM выше среднего по сохранённым матчам (${stats.averageGpm}).`
                    : `GPM ниже среднего по сохранённым матчам (${stats.averageGpm}).`
                  : "Для сравнения нужно загрузить статистику матчей."}
              </small>
            </span>
          </div>

          {!!goldAdvantageData.length && (
            <div className="insight match-breakdown-insight">
              <TrendingUp size={17} />
              <span>
                <b>Кто перефармил</b>
                <small>
                  Ваше место среди игроков обеих команд: GPM — {rankLabel("gpm")}, ластхиты — {rankLabel("lastHits")}.
                  {selectedRosterPlayer ? ` Ваш net worth: ${moneyLabel(selectedRosterPlayer.netWorth)}.` : ""}
                </small>
              </span>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function MatchMetric({ label, value, hint }) {
  return (
    <div className="match-metric">
      <span>{label}</span>
      <b>{value}</b>
      {hint && <small>{hint}</small>}
    </div>
  );
}

export default MatchPage;
