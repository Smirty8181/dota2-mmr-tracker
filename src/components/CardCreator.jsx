import React, { useEffect, useMemo, useRef, useState } from "react";
import { Download, RotateCcw, Sparkles } from "lucide-react";
import { api } from "../api.js";
import {
  CARD_ACCENTS,
  CARD_FORMATS,
  CARD_TEMPLATES,
  calculateCardAchievements,
  calculateCardMetrics,
  renderProfileCard,
} from "./profile-card-data.js";
import { HERO_CATALOG, getHeroById } from "../../shared/hero-catalog.js";

const DEFAULT_OPTIONS = {
  format: "landscape",
  template: "minimal",
  accent: CARD_TEMPLATES.minimal.accent,
  title: "Моя статистика",
  subtitle: "",
  heroId: "",
  showAvatar: true,
  showPlayerName: true,
  showAccountId: false,
  showHero: true,
  showAchievements: true,
  visibleMetrics: { mmr: true, winRate: true, kda: true, matches: true, bestMmr: true },
};

const STORAGE_KEY = "dota-profile-card-options";

function readSavedOptions() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!saved || typeof saved !== "object") return { options: DEFAULT_OPTIONS, error: "" };
    return {
      options: {
        ...DEFAULT_OPTIONS,
        ...saved,
        template: Object.hasOwn(CARD_TEMPLATES, saved.template) ? saved.template : DEFAULT_OPTIONS.template,
        format: Object.hasOwn(CARD_FORMATS, saved.format) ? saved.format : DEFAULT_OPTIONS.format,
        accent: CARD_ACCENTS.includes(saved.accent) ? saved.accent : DEFAULT_OPTIONS.accent,
        title: typeof saved.title === "string" ? saved.title.slice(0, 48) : DEFAULT_OPTIONS.title,
        subtitle: typeof saved.subtitle === "string" ? saved.subtitle.slice(0, 70) : DEFAULT_OPTIONS.subtitle,
        heroId: typeof saved.heroId === "string" && getHeroById(saved.heroId) ? saved.heroId : "",
        showAvatar: typeof saved.showAvatar === "boolean" ? saved.showAvatar : DEFAULT_OPTIONS.showAvatar,
        showPlayerName: typeof saved.showPlayerName === "boolean" ? saved.showPlayerName : DEFAULT_OPTIONS.showPlayerName,
        showAccountId: typeof saved.showAccountId === "boolean" ? saved.showAccountId : DEFAULT_OPTIONS.showAccountId,
        showHero: typeof saved.showHero === "boolean" ? saved.showHero : DEFAULT_OPTIONS.showHero,
        showAchievements: typeof saved.showAchievements === "boolean" ? saved.showAchievements : DEFAULT_OPTIONS.showAchievements,
        visibleMetrics: { ...DEFAULT_OPTIONS.visibleMetrics, ...saved.visibleMetrics },
      },
      error: "",
    };
  } catch (error) {
    return { options: DEFAULT_OPTIONS, error: `Не удалось прочитать настройки карточки: ${error.message}` };
  }
}

function CardCreator({ profile, stats, mmr, startingMmr, personalBestMmr, matches, heroes, favoriteHero }) {
  const canvasRef = useRef(null);
  const [initialSavedOptions] = useState(readSavedOptions);
  const [options, setOptions] = useState(initialSavedOptions.options);
  const [status, setStatus] = useState(initialSavedOptions.error);
  const [previewReady, setPreviewReady] = useState(false);
  const player = profile?.player;
  const availableMetrics = useMemo(
    () => calculateCardMetrics(stats, matches, mmr, personalBestMmr),
    [stats, matches, mmr, personalBestMmr],
  );
  const achievements = useMemo(
    () => calculateCardAchievements(stats, matches, startingMmr, personalBestMmr),
    [stats, matches, startingMmr, personalBestMmr],
  );
  const catalogHero = options.heroId ? getHeroById(options.heroId) : null;
  const selectedHeroStats = catalogHero && heroes.find((hero) => hero.id === catalogHero.id);
  const selectedHero = catalogHero
    ? {
      ...(selectedHeroStats || {}),
      ...catalogHero,
      name: catalogHero.displayName,
      image: catalogHero.portrait,
      artImage: api.assetUrl(`/assets/heroes/${catalogHero.id}`),
      artwork: api.assetUrl(`/assets/heroes/${catalogHero.id}`),
      renderImage: api.assetUrl(`/assets/heroes/${catalogHero.id}`),
    }
    : favoriteHero
      ? {
        ...favoriteHero,
        artwork: api.assetUrl(`/assets/heroes/${favoriteHero.id}`),
        artImage: api.assetUrl(`/assets/heroes/${favoriteHero.id}`),
        renderImage: api.assetUrl(`/assets/heroes/${favoriteHero.id}`),
      }
      : null;
  const data = useMemo(
    () => ({ player, hero: selectedHero, metrics: availableMetrics, achievements }),
    [player, selectedHero, availableMetrics, achievements],
  );
  const previewScale = options.format === "story" ? "9 / 16" : options.format === "square" ? "1 / 1" : "1200 / 630";

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(options));
    } catch (error) {
      setStatus(`Не удалось сохранить настройки карточки: ${error.message}`);
    }
    let active = true;
    setPreviewReady(false);
    const outputCanvas = document.createElement("canvas");
    renderProfileCard(outputCanvas, data, options)
      .then(({ unavailableImage }) => {
        if (!active) return;
        const preview = canvasRef.current;
        const context = preview?.getContext("2d");
        if (!preview || !context) throw new Error("Не удалось обновить предпросмотр карточки.");
        preview.width = outputCanvas.width;
        preview.height = outputCanvas.height;
        context.drawImage(outputCanvas, 0, 0);
        setPreviewReady(true);
        if (unavailableImage) setStatus("Часть внешних изображений недоступна для экспорта — карточка создана с запасным фоном.");
      })
      .catch((error) => {
        if (active) setStatus(error.message);
      });
    return () => { active = false; };
  }, [data, options]);

  function updateOption(name, value) {
    setOptions((current) => ({ ...current, [name]: value }));
    setStatus("");
  }

  function resetOptions() {
    setOptions({ ...DEFAULT_OPTIONS, visibleMetrics: { ...DEFAULT_OPTIONS.visibleMetrics } });
    setStatus("");
  }

  function downloadCard() {
    const canvas = canvasRef.current;
    if (!canvas || !previewReady) {
      setStatus("Предпросмотр ещё загружается. Попробуйте через секунду.");
      return;
    }
    canvas.toBlob((blob) => {
      if (!blob) {
        setStatus("Браузер не смог сформировать PNG.");
        return;
      }
      const link = document.createElement("a");
      link.download = `dota-profile-${options.format}.png`;
      const objectUrl = URL.createObjectURL(blob);
      link.href = objectUrl;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setStatus("PNG-карточка скачана.");
    }, "image/png");
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">ПЕРСОНАЛЬНАЯ КАРТОЧКА</p>
          <h1>Карточка профиля</h1>
          <p className="heading-subtitle">Настрой оформление и скачай PNG из реальных данных профиля.</p>
        </div>
      </div>

      {!player ? (
        <div className="empty-state card-creator-empty">Подключи публичный профиль, чтобы создать карточку с настоящими данными.</div>
      ) : (
        <div className="card-creator-layout">
          <section className="card card-editor">
            <div className="section-head"><div><h3>Оформление</h3><p>Настройки сохраняются только в этом браузере.</p></div></div>

            <label className="card-field-label" htmlFor="card-template">Шаблон</label>
            <select id="card-template" className="card-select" value={options.template} onChange={(event) => {
              const template = event.target.value;
              setOptions((current) => ({ ...current, template, accent: CARD_TEMPLATES[template].accent }));
              setStatus("");
            }}>
              {Object.entries(CARD_TEMPLATES).map(([id, template]) => <option key={id} value={id}>{template.label}</option>)}
            </select>

            <label className="card-field-label" htmlFor="card-format">Формат</label>
            <select id="card-format" className="card-select" value={options.format} onChange={(event) => updateOption("format", event.target.value)}>
              {Object.entries(CARD_FORMATS).map(([id, format]) => <option key={id} value={id}>{format.label} · {format.width}×{format.height}</option>)}
            </select>

            <label className="card-field-label" htmlFor="card-hero">Герой</label>
            <select id="card-hero" className="card-select" value={options.heroId} onChange={(event) => updateOption("heroId", event.target.value)}>
              <option value="">{favoriteHero?.manuallySelected ? "Выбранный любимый герой" : "Самый частый герой"}</option>
              {HERO_CATALOG.map((hero) => <option key={hero.id} value={hero.id}>{hero.displayName}</option>)}
            </select>

            <label className="card-field-label" htmlFor="card-title">Заголовок</label>
            <input id="card-title" className="card-text-input" maxLength={48} value={options.title} onChange={(event) => updateOption("title", event.target.value)} />

            <label className="card-field-label" htmlFor="card-subtitle">Подпись</label>
            <input id="card-subtitle" className="card-text-input" maxLength={70} value={options.subtitle} onChange={(event) => updateOption("subtitle", event.target.value)} placeholder="Короткая заметка (необязательно)" />

            <fieldset className="card-metric-options">
              <legend>Показатели</legend>
              {availableMetrics.map((metric) => (
                <label key={metric.id} className={!metric.value ? "unavailable" : ""}>
                  <input
                    type="checkbox"
                    checked={Boolean(options.visibleMetrics[metric.id])}
                    disabled={!metric.value}
                    onChange={(event) => setOptions((current) => ({
                      ...current,
                      visibleMetrics: { ...current.visibleMetrics, [metric.id]: event.target.checked },
                    }))}
                  />
                  <span>{metric.label}{!metric.value ? " · нет данных" : ""}</span>
                </label>
              ))}
              <small>KDA рассчитан по загруженным матчам; для него отображается размер выборки.</small>
            </fieldset>

            <fieldset className="card-metric-options">
              <legend>Элементы карточки</legend>
              {[
                ["showAvatar", "Аватар"],
                ["showPlayerName", "Имя игрока"],
                ["showAccountId", "Steam ID"],
                ["showHero", "Изображение и имя героя"],
                ["showAchievements", "Подтверждённые достижения"],
              ].map(([key, label]) => (
                <label key={key} className={key === "showAchievements" && !achievements.length ? "unavailable" : ""}>
                  <input
                    type="checkbox"
                    checked={options[key] && (key !== "showAchievements" || achievements.length > 0)}
                    disabled={key === "showAchievements" && !achievements.length}
                    onChange={(event) => updateOption(key, event.target.checked)}
                  />
                  <span>{label}{key === "showAchievements" && !achievements.length ? " · пока нет" : ""}</span>
                </label>
              ))}
            </fieldset>

            <div className="card-accent-picker">
              <span>Акцент</span>
              <div role="group" aria-label="Цвет акцента">
                {CARD_ACCENTS.map((accent) => (
                  <button
                    key={accent}
                    type="button"
                    className={options.accent === accent ? "selected" : ""}
                    style={{ "--card-accent": accent }}
                    aria-label={`Выбрать цвет ${accent}`}
                    aria-pressed={options.accent === accent}
                    onClick={() => updateOption("accent", accent)}
                  />
                ))}
              </div>
            </div>

            <div className="card-editor-actions">
              <button className="button primary" type="button" onClick={downloadCard} disabled={!previewReady}><Download size={15} /> Скачать PNG</button>
              <button className="button secondary" type="button" onClick={resetOptions}><RotateCcw size={15} /> Сбросить</button>
            </div>
            {status && <p className="card-export-status" role="status">{status}</p>}
            {!matches.length && <p className="card-export-note"><Sparkles size={14} /> KDA скрыт, пока нет статистики матчей.</p>}
          </section>

          <section className="card card-preview-panel">
            <div className="section-head"><div><h3>Предпросмотр</h3><p>PNG скачивается в полном разрешении.</p></div></div>
            <div className="card-preview" style={{ aspectRatio: previewScale }}>
              <canvas
                ref={canvasRef}
                role="img"
                aria-label={`Предпросмотр карточки, шаблон ${CARD_TEMPLATES[options.template].label}`}
              />
            </div>
            <p className="card-export-note">Расчётный MMR не является официальным рейтингом Valve. Недоступные значения не заменяются нулями.</p>
          </section>
        </div>
      )}
    </>
  );
}

export default CardCreator;
