import { Check, Lock, Trophy, UserRound } from "lucide-react";
import { buildAchievementProgress } from "./achievements-data.js";

function AchievementsPage({ accountId, onConnect, stats, startingMmr, personalBestMmr, matches }) {
  const achievements = buildAchievementProgress({
    totalRankedMatches: stats?.totalMatches,
    startingMmr,
    personalBestMmr,
    matches,
  });
  const unlockedCount = achievements.filter((achievement) => achievement.unlocked).length;

  return (
    <section className="view-transition achievements-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">DOTA 2 · ПРОГРЕСС ИГРОКА</p>
          <h1>Достижения</h1>
          <p className="heading-subtitle">Открытия подтверждаются только данными подключённого профиля и сохранённых рейтинговых матчей.</p>
        </div>
        {accountId && <div className="achievements-total"><Trophy size={17} aria-hidden="true" /><b>{unlockedCount}</b><span>из {achievements.length} открыто</span></div>}
      </header>

      {!accountId ? (
        <div className="card analytics-empty">
          <Trophy size={24} aria-hidden="true" />
          <h2>Подключите профиль, чтобы начать</h2>
          <p>Счётчик достижений использует только подтверждённые рейтинговые матчи.</p>
          <button className="button primary" type="button" onClick={onConnect}>
            <UserRound size={15} aria-hidden="true" />Подключить профиль
          </button>
        </div>
      ) : (
        <div className="achievement-progress-grid">
          {achievements.map((achievement) => {
            const progress = achievement.current == null || achievement.target == null
              ? null
              : Math.min(100, Math.round((achievement.current / Math.max(1, achievement.target)) * 100));
            const progressLabel = achievement.id === "personal-best"
              ? achievement.current == null
                ? "Данные MMR недоступны"
                : achievement.unlocked
                  ? `Личный пик: ${achievement.current.toLocaleString("ru-RU")} MMR`
                  : `Текущий пик: ${achievement.current.toLocaleString("ru-RU")} из ${achievement.target.toLocaleString("ru-RU")} MMR`
              : achievement.current == null
                ? "Данные недоступны"
                : `${Math.min(achievement.current, achievement.target)} из ${achievement.target}`;
            return (
              <article className={`card achievement-progress-card ${achievement.unlocked ? "unlocked" : ""}`} key={achievement.id}>
                <span className="achievement-progress-icon">
                  {achievement.unlocked ? <Check size={18} aria-hidden="true" /> : <Lock size={17} aria-hidden="true" />}
                </span>
                <div className="achievement-progress-copy">
                  <div className="achievement-progress-title">
                    <h2>{achievement.title}</h2>
                    <span>{achievement.unlocked ? "Открыто" : "В процессе"}</span>
                  </div>
                  <p>{achievement.description}</p>
                  <small>{progressLabel}</small>
                  {progress != null && (
                    <div
                      className="achievement-progress-track"
                      role="progressbar"
                      aria-label={`Прогресс: ${achievement.title}`}
                      aria-valuemin="0"
                      aria-valuemax="100"
                      aria-valuenow={progress}
                    >
                      <i style={{ width: `${progress}%` }} />
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default AchievementsPage;
