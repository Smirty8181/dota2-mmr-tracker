import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, RefreshCw, Search, Users, X } from "lucide-react";
import { api } from "../api.js";

const PAGE_SIZE = 48;

function ProPlayersPage() {
  const [players, setPlayers] = useState([]);
  const [query, setQuery] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE);
  const [failedAvatars, setFailedAvatars] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadPlayers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api.proPlayers();
      setPlayers(result);
    } catch (requestError) {
      setError(requestError.message || "Не удалось загрузить список профессиональных игроков.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlayers();
  }, [loadPlayers]);

  const teams = useMemo(
    () => [...new Set(players.map((player) => player.teamName).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right, "ru")),
    [players],
  );
  const featuredTeams = useMemo(() => {
    const counts = new Map();
    players.forEach((player) => {
      if (player.teamName) counts.set(player.teamName, (counts.get(player.teamName) || 0) + 1);
    });
    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "ru"))
      .slice(0, 6);
  }, [players]);
  const filteredPlayers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("ru-RU");
    return players.filter((player) => {
      if (teamFilter && player.teamName !== teamFilter) return false;
      if (!normalizedQuery) return true;
      return `${player.name} ${player.teamName || ""} ${player.countryCode || ""} ${player.accountId}`
        .toLocaleLowerCase("ru-RU")
        .includes(normalizedQuery);
    }).sort((first, second) => {
      if (sortBy === "team") return (first.teamName || "\uffff").localeCompare(second.teamName || "\uffff", "ru")
        || first.name.localeCompare(second.name, "ru");
      if (sortBy === "accountId") return first.accountId.localeCompare(second.accountId);
      return first.name.localeCompare(second.name, "ru");
    });
  }, [players, query, teamFilter, sortBy]);
  const visiblePlayers = filteredPlayers.slice(0, visibleLimit);
  const clearFilters = () => {
    setQuery("");
    setTeamFilter("");
    setVisibleLimit(PAGE_SIZE);
  };

  return (
    <section className="view-transition pro-players-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">DOTA 2 · OPEN DOTA</p>
          <h1>Профессиональные игроки</h1>
          <p className="heading-subtitle">Актуальный публичный список OpenDota. Имена и команды не создаются вручную.</p>
        </div>
        <button className="button secondary" type="button" onClick={loadPlayers} disabled={loading}>
          <RefreshCw size={14} aria-hidden="true" />{loading ? "Загружаем…" : "Обновить"}
        </button>
      </header>

      {error && (
        <div className="notice" role="alert">
          <span>{error}</span>
          <button className="text-button" type="button" onClick={loadPlayers} disabled={loading}>Повторить</button>
        </div>
      )}
      {players.length > 0 && (
        <>
          <div className="pro-player-summary">
            <span><Users size={16} aria-hidden="true" /> Игроков в источнике: <b>{players.length.toLocaleString("ru-RU")}</b></span>
            <span>Команд с указанным названием: <b>{teams.length.toLocaleString("ru-RU")}</b></span>
          </div>
          <div className="pro-team-shortcuts" aria-label="Популярные команды">
            <button className={!teamFilter ? "selected" : ""} type="button" onClick={() => { setTeamFilter(""); setVisibleLimit(PAGE_SIZE); }}>
              Все игроки <span>{players.length.toLocaleString("ru-RU")}</span>
            </button>
            {featuredTeams.map(([team, count]) => (
              <button className={teamFilter === team ? "selected" : ""} type="button" key={team} onClick={() => { setTeamFilter(team); setVisibleLimit(PAGE_SIZE); }}>
                {team} <span>{count}</span>
              </button>
            ))}
          </div>
          <div className="card pro-player-filters">
            <label className="pro-player-search" htmlFor="pro-player-search">
              <Search size={15} aria-hidden="true" />
              <input id="pro-player-search" value={query} onChange={(event) => { setQuery(event.target.value); setVisibleLimit(PAGE_SIZE); }} placeholder="Игрок, команда или Steam ID" />
            </label>
            <label className="visually-hidden" htmlFor="pro-player-team">Фильтр команды</label>
            <select id="pro-player-team" value={teamFilter} onChange={(event) => { setTeamFilter(event.target.value); setVisibleLimit(PAGE_SIZE); }}>
              <option value="">Все команды</option>
              {teams.map((team) => <option key={team} value={team}>{team}</option>)}
            </select>
            <label className="visually-hidden" htmlFor="pro-player-sort">Сортировка игроков</label>
            <select id="pro-player-sort" value={sortBy} onChange={(event) => { setSortBy(event.target.value); setVisibleLimit(PAGE_SIZE); }}>
              <option value="name">По имени</option>
              <option value="team">По команде</option>
              <option value="accountId">По Steam ID</option>
            </select>
            <span className="pro-player-result-count">Показано {visiblePlayers.length.toLocaleString("ru-RU")} из {filteredPlayers.length.toLocaleString("ru-RU")}</span>
          </div>
          {loading && <p className="pro-player-refreshing" role="status">Обновляем источник OpenDota…</p>}
          {filteredPlayers.length ? (
            <div className="pro-player-grid">
              {visiblePlayers.map((player) => (
                <article className="card pro-player-card" key={player.accountId}>
                  {player.avatarUrl && !failedAvatars.has(player.accountId)
                    ? <img className="pro-player-avatar" src={player.avatarUrl} alt="" loading="lazy" onError={() => setFailedAvatars((current) => new Set(current).add(player.accountId))} />
                    : <span className="pro-player-avatar-fallback" aria-hidden="true">{player.name.slice(0, 1).toUpperCase()}</span>}
                  <div className="pro-player-info">
                    <h2>{player.name}</h2>
                    <p>{player.teamName || "Команда не указана"}{player.countryCode ? ` · ${player.countryCode}` : ""}</p>
                    <small>Steam account ID: {player.accountId}</small>
                  </div>
                  <a className="pro-player-link" href={`https://www.opendota.com/players/${encodeURIComponent(player.accountId)}`} target="_blank" rel="noreferrer" aria-label={`Открыть профиль ${player.name} в OpenDota`} title="Открыть OpenDota">
                    <ExternalLink size={15} aria-hidden="true" />
                  </a>
                </article>
              ))}
            </div>
          ) : (
            <div className="card analytics-empty">
              <Search size={24} aria-hidden="true" />
              <h2>{players.length ? "Ничего не найдено" : "Источник пока не вернул игроков"}</h2>
              <p>{players.length ? "Измените запрос или фильтры, чтобы продолжить поиск." : "Обновите список позже: данные загружаются напрямую из OpenDota."}</p>
              {(query || teamFilter) && <button className="button secondary" type="button" onClick={clearFilters}><X size={14} />Сбросить фильтры</button>}
            </div>
          )}
          {visiblePlayers.length < filteredPlayers.length && (
            <button className="button secondary pro-player-load-more" type="button" onClick={() => setVisibleLimit((limit) => limit + PAGE_SIZE)}>
              Показать ещё {Math.min(PAGE_SIZE, filteredPlayers.length - visiblePlayers.length)}
            </button>
          )}
        </>
      )}
      {loading && !players.length && <div className="card analytics-empty" role="status">Загружаем проверенный список OpenDota…</div>}
      {!loading && !error && !players.length && (
        <div className="card analytics-empty">
          <Users size={24} aria-hidden="true" />
          <h2>Источник пока не вернул игроков</h2>
          <p>Обновите список позже: данные загружаются напрямую из OpenDota.</p>
        </div>
      )}
    </section>
  );
}

export default ProPlayersPage;
