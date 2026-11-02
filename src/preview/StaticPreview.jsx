import React from "react";

const matches = [
  { hero: "Invoker", mark: "IN", result: "Победа", mode: "Рейтинговый · 35:42", kda: "12 / 4 / 18", mmr: "+25", tone: "win" },
  { hero: "Phantom Assassin", mark: "PA", result: "Поражение", mode: "Рейтинговый · 29:16", kda: "8 / 7 / 11", mmr: "−25", tone: "loss" },
  { hero: "Pudge", mark: "PU", result: "Победа", mode: "Рейтинговый · 41:08", kda: "16 / 5 / 21", mmr: "+25", tone: "win" },
];

export default function StaticPreview() {
  return (
    <main className="demo-app">
      <div className="demo-banner"><span /> СТАТИЧЕСКОЕ ДЕМО · ВЫМЫШЛЕННЫЙ ПРОФИЛЬ И МАТЧИ</div>
      <div className="demo-layout">
        <aside className="demo-sidebar">
          <div className="demo-logo"><span>◆</span><b>MMR<span>TRACKER</span></b></div>
          <div className="sidebar-caption">ОБЗОР</div>
          <div className="demo-nav active"><i>▤</i> Профиль</div>
          <div className="demo-nav"><i>⌁</i> Аналитика</div>
          <div className="demo-nav"><i>⚔</i> Матчи</div>
          <div className="demo-nav"><i>♙</i> Герои</div>
          <div className="sidebar-caption second-caption">ДОПОЛНИТЕЛЬНО</div>
          <div className="demo-nav"><i>✧</i> Достижения</div>
          <div className="demo-nav"><i>⚙</i> Настройки</div>
          <div className="sidebar-note">Все действия профиля отключены в этом статическом макете.</div>
        </aside>

        <section className="demo-main">
          <header className="demo-topbar">
            <div className="breadcrumb">Трекер <span>/</span> <b>Демо-профиль</b></div>
            <div className="demo-pill"><span /> ПРИМЕР ДАННЫХ</div>
          </header>
          <div className="demo-content">
            <div className="demo-greeting">
              <div><p className="demo-eyebrow">ПРОФИЛЬ ИГРОКА</p><h1>Профиль и рейтинг</h1><p className="subtitle">Демонстрационные показатели — не связаны с реальным Steam-профилем.</p></div>
              <div className="fictional-tag">НИК И ID ВЫМЫШЛЕНЫ</div>
            </div>

            <section className="player-card">
              <div className="player-emblem"><span>◆</span></div>
              <div className="player-info"><div className="player-name">MidasEnjoyer <span className="sample-chip">SAMPLE</span></div><div className="player-id">Steam ID: 000000000 · демонстрационный аккаунт</div><div className="player-meta"><span>☷ Уровень профиля 42</span><span>◷ Активность: сегодня</span></div></div>
              <div className="rank-box"><div className="rank-medal">♛</div><div><span>ТЕКУЩИЙ РАНГ</span><b>Властелин <small>★ 3</small></b></div></div>
            </section>

            <section className="metrics-grid">
              <article className="metric-card"><div className="metric-label">Текущий MMR <span>◉</span></div><strong>4 285</strong><small className="metric-delta positive">↗ +125 за 30 дней</small></article>
              <article className="metric-card"><div className="metric-label">Матчи <span>⚔</span></div><strong>386</strong><small>За всё время · пример</small></article>
              <article className="metric-card"><div className="metric-label">Винрейт <span>◌</span></div><strong>54,2<small>%</small></strong><small className="metric-delta positive">↗ +2,1% за месяц</small></article>
              <article className="metric-card"><div className="metric-label">Победы / поражения <span>▤</span></div><strong>209 <i>/</i> 177</strong><small>Демо-выборка матчей</small></article>
            </section>

            <section className="dashboard-grid">
              <article className="demo-panel rank-panel">
                <div className="panel-title"><div><p className="demo-eyebrow">ПРОГРЕСС РЕЙТИНГА</p><h2>История MMR</h2></div><span className="period-tag">30 дней</span></div>
                <div className="chart-summary"><b>4 285 <small>MMR</small></b><span>+125 <small>за период</small></span></div>
                <div className="chart-wrap" role="img" aria-label="Примерный график вымышленного рейтинга">
                  <div className="chart-ylabels"><span>4 400</span><span>4 300</span><span>4 200</span><span>4 100</span></div>
                  <svg viewBox="0 0 640 180" preserveAspectRatio="none" aria-hidden="true">
                    <defs><linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#a82222" stopOpacity=".29"/><stop offset="1" stopColor="#a82222" stopOpacity="0"/></linearGradient></defs>
                    <path className="chart-gridline" d="M0 22H640M0 66H640M0 110H640M0 154H640"/>
                    <path className="chart-area" d="M0 131 43 118 85 124 128 91 171 108 213 77 256 84 299 55 341 69 384 40 427 58 469 31 512 46 555 23 597 38 640 14V180H0Z"/>
                    <path className="chart-line" d="M0 131 43 118 85 124 128 91 171 108 213 77 256 84 299 55 341 69 384 40 427 58 469 31 512 46 555 23 597 38 640 14"/>
                  </svg>
                  <div className="chart-xlabels"><span>19 окт</span><span>26 окт</span><span>2 ноя</span><span>9 ноя</span><span>16 ноя</span></div>
                </div>
                <div className="chart-note">Условная история рейтинга · точки и даты не соответствуют реальным матчам</div>
              </article>

              <article className="demo-panel winrate-panel">
                <div className="panel-title"><div><p className="demo-eyebrow">РЕЗУЛЬТАТИВНОСТЬ</p><h2>Последние 30 дней</h2></div></div>
                <div className="winrate-gauge"><div className="gauge-inner"><b>54,2<small>%</small></b><span>ВИНРЕЙТ</span></div></div>
                <div className="winrate-legend"><span><i className="legend-win" /> Победы <b>26</b></span><span><i className="legend-loss" /> Поражения <b>22</b></span></div>
                <div className="winrate-foot"><span>Всего матчей</span><b>48</b></div>
              </article>
            </section>

            <section className="demo-panel matches-panel">
              <div className="panel-title"><div><p className="demo-eyebrow">ИСТОРИЯ ИГР</p><h2>Последние матчи</h2></div><span className="muted-caption">Примеры записей · не загружены из OpenDota</span></div>
              <div className="matches-head"><span>ГЕРОЙ</span><span>РЕЗУЛЬТАТ</span><span>K / D / A</span><span>MMR</span></div>
              {matches.map((match, index) => <div className="match-row" key={index}><div className="hero-cell"><span className={`hero-mark ${match.tone}`}>{match.mark}</span><div><b>{match.hero}</b><small>{match.mode}</small></div></div><span className={`result ${match.tone}`}>{match.result}</span><b className="kda">{match.kda}</b><b className={`mmr-change ${match.tone}`}>{match.mmr}</b></div>)}
            </section>
            <footer className="demo-footer">Dota 2 MMR Tracker · статический макет портфолио · Steam, OpenDota и сервер не подключены</footer>
          </div>
        </section>
      </div>
    </main>
  );
}
