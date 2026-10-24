import React from "react";
import { Search, Users } from "lucide-react";
import HeroMark from "./HeroMark";

function HeroesPage({ heroes, query, setQuery, sort, setSort, favoriteHero, onFavorite, onClearFavorite }) {
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">ВАШ ПУЛ ГЕРОЕВ</p>
          <h1>Герои</h1>
          <p className="heading-subtitle">Игры и винрейт — OpenDota; KDA и фарм — по сохранённым рейтинговым матчам.</p>
        </div>
        <div className="hero-heading-actions">
          {favoriteHero?.manuallySelected && (
            <button className="text-button clear-favorite" onClick={onClearFavorite}>Сбросить выбор</button>
          )}
          <span className="hero-count">
            <Users size={15} /> {heroes.length} героев
          </span>
        </div>
      </div>
      <section className="card heroes-card">
        <div className="heroes-toolbar">
          <label className="search-field">
            <Search size={15} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск героев..." />
          </label>
          <div className="range-switch">
            <button className={sort === "games" ? "selected" : ""} onClick={() => setSort("games")}>По играм</button>
            <button className={sort === "win" ? "selected" : ""} onClick={() => setSort("win")}>По винрейту</button>
            <button className={sort === "gpm" ? "selected" : ""} onClick={() => setSort("gpm")}>По GPM</button>
          </div>
        </div>
        {heroes.length ? (
          <div className="hero-grid">
            {heroes.map((hero) => (
              <article className="hero-card" key={hero.id ?? hero.name}>
                <div className="hero-art">
                  <HeroMark hero={{ ...hero, art: null }} />
                  {hero.image && (
                    <img
                      className="hero-card-image"
                      src={hero.image}
                      alt=""
                      aria-hidden="true"
                      loading="lazy"
                      onError={(event) => { event.currentTarget.hidden = true; }}
                    />
                  )}
                  <span className="games-badge">{hero.games} игр</span>
                  <button
                    className={`favorite-hero-toggle ${favoriteHero?.id === hero.id && favoriteHero?.manuallySelected ? "selected" : ""}`}
                    onClick={() => onFavorite(hero)}
                    aria-pressed={favoriteHero?.id === hero.id && Boolean(favoriteHero?.manuallySelected)}
                    aria-label={`${favoriteHero?.id === hero.id && favoriteHero?.manuallySelected ? "Выбран любимый герой" : "Выбрать любимым"}: ${hero.name}`}
                    title={favoriteHero?.id === hero.id && favoriteHero?.manuallySelected ? "Любимый герой" : "Выбрать любимым"}
                  >
                    <Star size={13} fill={favoriteHero?.id === hero.id && favoriteHero?.manuallySelected ? "currentColor" : "none"} />
                    <span>{favoriteHero?.id === hero.id && favoriteHero?.manuallySelected ? "Выбран" : "В избранное"}</span>
                  </button>
                </div>
                <div className="hero-info">
                  <h3>{hero.name}</h3>
                  <div>
                    <span>Винрейт <b>{hero.win == null ? "Нет данных" : `${hero.win}%`}</b></span>
                    <span>KDA <b>{hero.kda ?? "Нет данных"}</b></span>
                  </div>
                  <div>
                    <span>GPM <b>{hero.gpm ?? "—"}</b></span>
                    <span className="mini-progress"><i style={{ width: `${hero.win ?? 0}%` }} /></span>
                  </div>
                  <small className="hero-sample-note">
                    KDA/GPM/XPM: {hero.sampledGames ? `${hero.sampledGames} сохранённых рейтинговых матчей` : "нет сохранённых данных"}
                  </small>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            {query ? "Герои не найдены. Попробуйте изменить запрос." : "Пока нет статистики по героям. Синхронизируйте профиль OpenDota."}
          </div>
        )}
      </section>
    </>
  );
}

import { Star } from "lucide-react";

export default HeroesPage;
