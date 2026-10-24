import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, CalendarDays, RefreshCw, Search, Target, TrendingUp, UserRound } from "lucide-react";
import { api } from "../api";
import { getHeroById } from "../../shared/hero-catalog.js";

function formatPercent(value) {
  return value == null ? "—" : `${value}%`;
}

function formatAverage(stat, suffix = "") {
  return stat?.value == null ? "—" : `${stat.value.toLocaleString("ru-RU")}${suffix}`;
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return "—";
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours ? `${hours} ч ${minutes} мин` : `${minutes} мин`;
}

function formatStreak(streak) {
  if (!streak) return "Пока нет матчей";
  const result = streak.result === "WIN"
    ? ["победа", "победы", "побед"]
    : ["поражение", "поражения", "поражений"];
  const count = streak.matches % 100;
  const index = count >= 11 && count <= 14 ? 2 : [2, 3, 4].includes(count % 10) ? 1 : count % 10 === 1 ? 0 : 2;
  return `${streak.matches} ${result[index]} подряд`;
}

function MetricCard({ label, value, detail, icon: Icon }) {
  return (
    <article className="card analytics-metric">
      <span className="analytics-metric-icon"><Icon size={17} aria-hidden="true" /></span>
      <span className="analytics-metric-label">{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function periodMetricValue(metric, key) {
  if (metric == null) return null;
  if (key === "matches") return metric.matches;
  if (key === "winRate") return metric.winRate;
  if (key === "averageKda") return metric.averageKda;
  if (key.startsWith("average")) return metric[key]?.value;
  return null;
}

function periodMetricFormat(value, key) {
  if (value == null) return "—";
  if (key === "winRate") return `${value}%`;
  if (key === "averageKda") return value.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
  if (key === "averageDuration") return formatDuration(value);
  return Math.round(value).toLocaleString("ru-RU");
}

function periodMetricDelta(current, previous, key) {
  if (current == null || previous == null) return "Недостаточно данных для сравнения";
  if (key === "averageDuration") {
    const deltaMinutes = Math.round(current / 60) - Math.round(previous / 60);
    if (deltaMinutes === 0) return "Изменение: без изменений";
    return `Изменение: ${deltaMinutes > 0 ? "+" : "−"}${formatDuration(Math.abs(deltaMinutes) * 60)}`;
  }
  const delta = Number((current - previous).toFixed(2));
  const unit = key === "winRate" ? " п. п." : "";
  const change = delta === 0 ? "без изменений" : `${delta > 0 ? "+" : ""}${delta.toLocaleString("ru-RU")}${unit}`;
  return `Изменение: ${change}`;
}

function PeriodComparison({ periodKey, period, select }) {
  const metrics = [
    { key: "matches", label: "Матчи" },
    { key: "winRate", label: "Винрейт" },
    { key: "averageKda", label: "KDA" },
    { key: "averageKills", label: "Убийства" },
    { key: "averageDeaths", label: "Смерти" },
    { key: "averageAssists", label: "Помощь" },
    { key: "averageGpm", label: "GPM" },
    { key: "averageXpm", label: "XPM" },
    { key: "averageDuration", label: "Длительность" },
  ];
  const current = period?.current;
  const previous = period?.previous;
  const periodLabel = periodKey === "all" ? "Вся сохранённая история" : `Последние ${period?.days} дней`;

  return (
    <section className="card analytics-panel analytics-period-panel" aria-labelledby="period-comparison-title">
      <div className="section-head">
        <div>
          <h3 id="period-comparison-title">Сравнение периодов</h3>
          <p>{periodLabel}{previous ? " и предыдущий равный период" : " без сравнения с прошлым"}</p>
        </div>
        <div className="range-switch" role="group" aria-label="Период аналитики">
          {[["7d", "7 дней"], ["30d", "30 дней"], ["90d", "90 дней"], ["all", "Всё время"]].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={periodKey === key ? "selected" : ""}
              aria-pressed={periodKey === key}
              onClick={() => select(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="analytics-period-grid">
        {metrics.map(({ key, label }) => {
          const currentValue = periodMetricValue(current, key);
          const previousValue = periodMetricValue(previous, key);
          const currentSample = key === "averageKda" ? current?.kdaSample : current?.[key]?.sample;
          const previousSample = key === "averageKda" ? previous?.kdaSample : previous?.[key]?.sample;
          return (
            <article className="analytics-period-metric" key={key}>
              <span>{label}</span>
              <strong>{periodMetricFormat(currentValue, key)}</strong>
              <small>{previous
                ? `Предыдущий период: ${periodMetricFormat(previousValue, key)}`
                : "Нет сравнимого периода"}</small>
              {currentSample != null && (
                <small>Выборка: {currentSample}{previousSample == null ? "" : ` · до этого ${previousSample}`}</small>
              )}
              <small>{periodMetricDelta(currentValue, previousValue, key)}</small>
            </article>
          );
        })}
      </div>
      <p className="analytics-note">
        Периоды отсчитываются от времени запроса назад и сравниваются с непосредственно предшествующим отрезком такой же длительности. При недостатке сохранённых матчей показатели остаются неизвестными.
      </p>
    </section>
  );
}

function HeroPerformance({ heroes, periodKey }) {
  const [query, setQuery] = useState("");
  const [minimumMatches, setMinimumMatches] = useState("1");
  const [sortBy, setSortBy] = useState("matches");
  const minimum = Number(minimumMatches);
  const rows = heroes
    .map((stats) => ({ ...stats, hero: getHeroById(stats.heroId) }))
    .filter(({ hero, matches }) => hero
      && matches >= minimum
      && `${hero.displayName} ${hero.russianName || ""} ${(hero.aliases || []).join(" ")}`.toLocaleLowerCase("ru-RU").includes(query.trim().toLocaleLowerCase("ru-RU")))
    .sort((first, second) => sortBy === "winRate"
      ? (second.winRate ?? -1) - (first.winRate ?? -1) || second.matches - first.matches || first.heroId - second.heroId
      : second.matches - first.matches || first.heroId - second.heroId);
  const periodLabel = periodKey === "all" ? "все сохранённые матчи" : `выбранный период · ${periodKey === "7d" ? "7 дней" : periodKey === "30d" ? "30 дней" : "90 дней"}`;

  return (
    <section className="card analytics-panel analytics-hero-panel">
      <div className="section-head">
        <div>
          <h3>Показатели по героям</h3>
          <p>Личная статистика за {periodLabel}. Малые выборки не считаются надёжным сравнением.</p>
        </div>
        <span className="analytics-hero-count">{rows.length} героев</span>
      </div>
      <div className="analytics-hero-controls">
        <label className="analytics-hero-search">
          <Search size={14} aria-hidden="true" />
          <input aria-label="Поиск героя" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти героя…" />
        </label>
        <label>
          <span>Минимум матчей</span>
          <select value={minimumMatches} onChange={(event) => setMinimumMatches(event.target.value)}>
            <option value="1">1 матч</option>
            <option value="3">3 матча</option>
            <option value="5">5 матчей</option>
          </select>
        </label>
        <label>
          <span>Сортировка</span>
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
            <option value="matches">По числу матчей</option>
            <option value="winRate">По винрейту</option>
          </select>
        </label>
      </div>
      {rows.length ? (
        <div className="analytics-hero-table-wrap">
          <table className="analytics-hero-table">
            <thead>
              <tr>
                <th scope="col">Герой</th>
                <th scope="col">Матчи</th>
                <th scope="col">Победы–поражения</th>
                <th scope="col">Винрейт</th>
                <th scope="col">KDA</th>
                <th scope="col">У / С / П в среднем</th>
                <th scope="col">GPM / XPM</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ heroId, hero, matches, wins, losses, winRate, averageKda, kdaSample, averageKills, averageDeaths, averageAssists, averageGpm, averageXpm }) => (
                <tr key={heroId}>
                  <th scope="row">
                    <span className="analytics-hero-name">
                      <img src={hero.icon} alt="" loading="lazy" />
                      {hero.displayName}
                    </span>
                  </th>
                  <td>{matches}</td>
                  <td>{wins}–{losses}</td>
                  <td>{formatPercent(winRate)}</td>
                  <td title={`Полные данные доступны в ${kdaSample} матчах`}>{averageKda ?? "—"}</td>
                  <td>{formatAverage(averageKills)} / {formatAverage(averageDeaths)} / {formatAverage(averageAssists)}</td>
                  <td>{formatAverage(averageGpm)} / {formatAverage(averageXpm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">{query || minimum > 1 ? "Нет героев, подходящих под поиск и минимальный размер выборки." : "В выбранном периоде нет матчей с распознанными героями."}</div>
      )}
      <p className="analytics-note">Показатели считаются только по сохранённым рейтинговым матчам этого профиля. Сортировка по винрейту не означает, что герой «лучший»; учитывайте количество игр и полноту данных.</p>
    </section>
  );
}

function WeeklyActivityChart({ days }) {
  const maxMatches = Math.max(1, ...days.map((day) => day.matches));
  return (
    <section className="card analytics-panel analytics-weekly-chart">
      <div className="section-head">
        <div>
          <h3>Матчи за последние 7 дней</h3>
          <p>Количество сохранённых рейтинговых игр по дням</p>
        </div>
      </div>
      <div className="analytics-bars" role="img" aria-label="Количество рейтинговых матчей по дням за последние семь дней">
        {days.map((day) => {
          const label = new Intl.DateTimeFormat("ru-RU", { weekday: "short", timeZone: "UTC" })
            .format(new Date(`${day.date}T12:00:00Z`));
          const height = day.matches ? Math.max(8, (day.matches / maxMatches) * 100) : 3;
          return (
            <div className="analytics-bar-day" key={day.date} title={`${day.date}: ${day.matches} матчей, ${day.wins} побед`}>
              <strong>{day.matches}</strong>
              <span className="analytics-bar-track"><i style={{ height: `${height}%` }} /></span>
              <small>{label}</small>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function AnalyticsPage({ accountId, onConnect }) {
  const [analytics, setAnalytics] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState("");
  const [savedTarget, setSavedTarget] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState("30d");
  const requestSequence = useRef(0);

  const loadAnalytics = useCallback(async () => {
    const requestId = ++requestSequence.current;
    if (!accountId) {
      setAnalytics(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await api.analytics(accountId);
      if (requestId === requestSequence.current) setAnalytics(result);
    } catch (requestError) {
      if (requestId === requestSequence.current) setError(requestError.message || "Не удалось загрузить аналитику.");
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  useEffect(() => {
    if (!accountId) return;
    try {
      const stored = window.localStorage.getItem(`dota-weekly-match-goal:${accountId}`);
      if (stored && Number.isInteger(Number(stored)) && Number(stored) > 0) {
        setSavedTarget(Number(stored));
        setTarget(stored);
      } else {
        setSavedTarget(null);
        setTarget("");
      }
    } catch (storageError) {
      setError(`Не удалось прочитать локальную цель на неделю: ${storageError.message}`);
    }
  }, [accountId]);

  const saveTarget = (event) => {
    event.preventDefault();
    const value = Number(target);
    if (!Number.isSafeInteger(value) || value < 1) return;
    try {
      window.localStorage.setItem(`dota-weekly-match-goal:${accountId}`, String(value));
      setSavedTarget(value);
    } catch (storageError) {
      setError(`Не удалось сохранить цель в браузере: ${storageError.message}`);
    }
  };

  const weekMatches = analytics?.lastSevenDays?.matches || 0;
  const goalProgress = savedTarget
    ? Math.min(100, Math.round((weekMatches / savedTarget) * 100))
    : 0;
  const overall = analytics?.overall;
  const recent = analytics?.recent;
  const previousWindow = recent?.previousWindow;
  const winRateDifference = recent?.winRate != null && previousWindow?.winRate != null
    ? recent.winRate - previousWindow.winRate
    : null;

  return (
    <section className="view-transition analytics-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">DOTA 2 · АНАЛИТИКА МАТЧЕЙ</p>
          <h1>Аналитика</h1>
          <p className="heading-subtitle">Сводка строится по сохранённым рейтинговым матчам; недоступные данные не заменяются нулями.</p>
        </div>
        <div className="heading-actions">
          {accountId && (
            <button className="button secondary" type="button" onClick={loadAnalytics} disabled={loading}>
              <RefreshCw size={14} aria-hidden="true" />
              {loading ? "Обновление…" : "Обновить"}
            </button>
          )}
        </div>
      </header>

      {error && <div className="notice" role="alert">{error}</div>}
      {!accountId && (
        <div className="card analytics-empty">
          <Activity size={24} aria-hidden="true" />
          <h2>Сначала подключите профиль</h2>
          <p>Аналитика появится после загрузки публичной истории матчей.</p>
          <button className="button primary" type="button" onClick={onConnect}>
            <UserRound size={15} aria-hidden="true" />Подключить профиль
          </button>
        </div>
      )}
      {loading && accountId && !analytics && (
        <div className="card analytics-empty" role="status">Загружаем сохранённые матчи…</div>
      )}
      {!loading && accountId && !error && analytics && (
        <>
          {overall.matches === 0 ? (
            <div className="card analytics-empty">
              <Activity size={24} aria-hidden="true" />
              <h2>Пока нет сохранённых рейтинговых матчей</h2>
              <p>Обновите профиль после включения «Expose Public Match Data» в настройках Dota 2.</p>
            </div>
          ) : (
            <>
              <div className="analytics-grid">
                <MetricCard label="Рейтинговые матчи" value={overall.matches.toLocaleString("ru-RU")} detail={`${overall.wins} побед · ${overall.losses} поражений`} icon={Activity} />
                <MetricCard label="Винрейт" value={formatPercent(overall.winRate)} detail="За всю сохранённую историю" icon={TrendingUp} />
                <MetricCard label="KDA" value={overall.averageKda ?? "—"} detail={`Полные данные: ${overall.kdaSample} матчей`} icon={Activity} />
                <MetricCard label="За 7 дней" value={analytics.lastSevenDays.matches} detail={`${analytics.lastSevenDays.wins} побед · ${analytics.lastSevenDays.losses} поражений`} icon={CalendarDays} />
              </div>

              <PeriodComparison
                periodKey={selectedPeriod}
                period={analytics.periods?.[selectedPeriod]}
                select={setSelectedPeriod}
              />

              <HeroPerformance heroes={analytics.periods?.[selectedPeriod]?.heroes || []} periodKey={selectedPeriod} />

              <WeeklyActivityChart days={analytics.weeklyActivity} />

              <div className="analytics-columns">
                <section className="card analytics-panel">
                  <div className="section-head">
                    <div>
                      <h3>Игровая форма</h3>
                      <p>Последние 10 матчей и предыдущее окно, если данных достаточно</p>
                    </div>
                  </div>
                  <div className="analytics-form-grid">
                    <div><span>Последние матчи</span><strong>{recent.matches ? `${recent.wins}–${recent.losses}` : "—"}</strong></div>
                    <div><span>Винрейт</span><strong>{formatPercent(recent.winRate)}</strong></div>
                    <div><span>Текущая серия</span><strong>{formatStreak(recent.currentStreak)}</strong></div>
                    <div><span>KDA</span><strong>{recent.averageKda ?? "—"}</strong></div>
                  </div>
                  <p className="analytics-note">
                    {winRateDifference == null
                      ? "Для сравнения формы нужны матчи и доступный винрейт в обоих окнах."
                      : `Винрейт ${winRateDifference > 0 ? "вырос" : winRateDifference < 0 ? "снизился" : "не изменился"} на ${Math.abs(winRateDifference)} п. п. относительно предыдущих ${previousWindow.matches} матчей.`}
                    {" "}Серия отражает результаты матчей, а не психологическое состояние игрока.
                  </p>
                </section>

                <section className="card analytics-panel">
                  <div className="section-head">
                    <div>
                      <h3>Средние показатели</h3>
                      <p>Расчёт по тем матчам, где показатель доступен</p>
                    </div>
                  </div>
                  <div className="analytics-averages">
                    <div><span>Убийства</span><strong>{formatAverage(overall.averageKills)}</strong><small>{overall.averageKills.sample} матчей</small></div>
                    <div><span>Смерти</span><strong>{formatAverage(overall.averageDeaths)}</strong><small>{overall.averageDeaths.sample} матчей</small></div>
                    <div><span>Помощь</span><strong>{formatAverage(overall.averageAssists)}</strong><small>{overall.averageAssists.sample} матчей</small></div>
                    <div><span>GPM</span><strong>{formatAverage(overall.averageGpm)}</strong><small>{overall.averageGpm.sample} матчей</small></div>
                    <div><span>XPM</span><strong>{formatAverage(overall.averageXpm)}</strong><small>{overall.averageXpm.sample} матчей</small></div>
                    <div><span>Ластхиты</span><strong>{formatAverage(overall.averageLastHits)}</strong><small>{overall.averageLastHits.sample} матчей</small></div>
                    <div><span>Денайи</span><strong>{formatAverage(overall.averageDenies)}</strong><small>{overall.averageDenies.sample} матчей</small></div>
                    <div><span>Длительность</span><strong>{formatDuration(overall.averageDuration.value)}</strong><small>{overall.averageDuration.sample} матчей</small></div>
                  </div>
                </section>
              </div>

              <section className="card analytics-panel analytics-goal">
                <div className="analytics-goal-copy">
                  <span className="analytics-metric-icon"><Target size={17} aria-hidden="true" /></span>
                  <div>
                    <h3>Цель на неделю</h3>
                    <p>{savedTarget ? `${weekMatches} из ${savedTarget} матчей за последние 7 дней` : "Задайте личную цель. Она сохранится только в этом браузере."}</p>
                  </div>
                </div>
                <form className="analytics-goal-form" onSubmit={saveTarget}>
                  <label htmlFor="weekly-match-goal">Матчей</label>
                  <input
                    id="weekly-match-goal"
                    type="number"
                    min="1"
                    step="1"
                    value={target}
                    onChange={(event) => setTarget(event.target.value)}
                    required
                  />
                  <button className="button secondary" type="submit">Сохранить</button>
                </form>
                {savedTarget && (
                  <div className="analytics-goal-progress" role="progressbar" aria-label="Прогресс недельной цели" aria-valuemin="0" aria-valuemax={savedTarget} aria-valuenow={Math.min(weekMatches, savedTarget)}>
                    <span style={{ width: `${goalProgress}%` }} />
                  </div>
                )}
              </section>
            </>
          )}
        </>
      )}
    </section>
  );
}

export default AnalyticsPage;
