import { Image, Palette, RotateCcw, Sparkles, VolumeX } from "lucide-react";
import { THEME_OPTIONS } from "../constants/themes.js";
import { HERO_CATALOG } from "../../shared/hero-catalog.js";

function SettingsPage({
  themePreference,
  reducedMotion,
  backgroundHeroId,
  backgroundHero,
  onThemeChange,
  onReducedMotionChange,
  onBackgroundHeroChange,
  onClearGameRecord,
  onClearWeeklyGoal,
  hasWeeklyGoal,
}) {
  const backgroundPreviewLabel = backgroundHero
    ? `Предпросмотр фона: ${backgroundHero.name}`
    : backgroundHeroId === "favorite"
      ? "Любимый герой появится после подключения профиля или выбора героя"
      : "Фон без изображения";
  const backgroundPreviewText = backgroundHero
    ? `Сейчас выбран: ${backgroundHero.name}`
    : backgroundHeroId === "favorite"
      ? "Любимый герой появится после подключения профиля"
      : "Сейчас выбрано: без арта";

  return (
    <section className="view-transition settings-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">DOTA 2 · ПЕРСОНАЛИЗАЦИЯ</p>
          <h1>Настройки</h1>
          <p className="heading-subtitle">Визуальные настройки сохраняются только в этом браузере.</p>
        </div>
      </header>

      <section className="card settings-group" aria-labelledby="appearance-settings-title">
        <div className="settings-group-heading">
          <span className="analytics-metric-icon"><Palette size={17} aria-hidden="true" /></span>
          <div><h2 id="appearance-settings-title">Внешний вид</h2><p>Спокойный фон страниц и отдельная обложка профиля.</p></div>
        </div>
        <label className="settings-row" htmlFor="accent-theme-setting">
          <span><b>Цветовая тема</b><small>Можно автоматически брать основной атрибут избранного героя.</small></span>
          <select id="accent-theme-setting" value={themePreference} onChange={(event) => onThemeChange(event.target.value)}>
            {THEME_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </label>
        <label className="settings-row" htmlFor="background-art-setting">
          <span><b>Обложка профиля</b><small>Арт героя будет виден в карточке профиля, а не за таблицами и панелями.</small></span>
          <select id="background-art-setting" value={backgroundHeroId} onChange={(event) => onBackgroundHeroChange(event.target.value)}>
            <option value="favorite">Любимый герой</option>
            <option value="none">Без арта</option>
            {HERO_CATALOG.map((hero) => <option key={hero.id} value={String(hero.id)}>{hero.displayName}</option>)}
          </select>
        </label>
        <div
          className={`settings-background-preview ${backgroundHero ? "" : "empty"}`}
          style={backgroundHero?.artwork ? { "--profile-cover-art": `url("${backgroundHero.artwork}")` } : undefined}
          role="img"
          aria-label={backgroundPreviewLabel}
        >
          <Image size={17} aria-hidden="true" />
          <span>{backgroundPreviewText}</span>
        </div>
      </section>

      <section className="card settings-group" aria-labelledby="accessibility-settings-title">
        <div className="settings-group-heading">
          <span className="analytics-metric-icon"><VolumeX size={17} aria-hidden="true" /></span>
          <div><h2 id="accessibility-settings-title">Доступность</h2><p>Сократите движение интерфейса, если анимации отвлекают.</p></div>
        </div>
        <label className="settings-row settings-toggle" htmlFor="reduced-motion-setting">
          <span><b>Уменьшить анимацию</b><small>Отключает большинство переходов и учитывается анимацией страниц.</small></span>
          <input
            id="reduced-motion-setting"
            type="checkbox"
            checked={reducedMotion}
            onChange={(event) => onReducedMotionChange(event.target.checked)}
          />
        </label>
      </section>

      <section className="card settings-group" aria-labelledby="local-data-settings-title">
        <div className="settings-group-heading">
          <span className="analytics-metric-icon"><Sparkles size={17} aria-hidden="true" /></span>
          <div><h2 id="local-data-settings-title">Локальные данные</h2><p>Эти данные хранятся в браузере и не отправляются на сервер.</p></div>
        </div>
        <div className="settings-row">
          <span><b>Рекорд мини-игр</b><small>Удалить сохранённый лучший результат.</small></span>
          <button className="button secondary" type="button" onClick={() => {
            if (window.confirm("Удалить сохранённый рекорд мини-игр в этом браузере?")) onClearGameRecord();
          }}>
            <RotateCcw size={14} aria-hidden="true" />Сбросить
          </button>
        </div>
        <div className="settings-row">
          <span><b>Недельная цель</b><small>{hasWeeklyGoal ? "Удалить цель на неделю для подключённого профиля." : "Цель на неделю ещё не сохранена."}</small></span>
          <button
            className="button secondary"
            type="button"
            disabled={!hasWeeklyGoal}
            onClick={() => {
              if (window.confirm("Удалить сохранённую недельную цель?")) onClearWeeklyGoal();
            }}
          >
            <RotateCcw size={14} aria-hidden="true" />Сбросить
          </button>
        </div>
      </section>
    </section>
  );
}

export default SettingsPage;
