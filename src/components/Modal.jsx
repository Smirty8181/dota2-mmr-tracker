import React from "react";
import { CircleHelp, Settings2, X } from "lucide-react";

function Modal({ type, value, setValue, accountId, setAccountId, onClose, onSubmit, registered, busy }) {
  const isHelp = type === "help";
  const isCorrect = type === "correct";
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="modal-card">
        <button className="icon-button modal-close" onClick={onClose} aria-label="Закрыть">
          <X size={18} />
        </button>
        {isHelp ? (
          <>
            <div className="modal-icon">
              <CircleHelp size={21} />
            </div>
            <h2>Как считается MMR</h2>
            <p>При первом подключении введённое значение становится стартовым. Затем каждый новый рейтинговый матч учитывается один раз: победа +25, поражение −25 MMR.</p>
            <p>Профиль и история матчей загружаются через OpenDota. Для этого в Dota 2 должен быть включён параметр Expose Public Match Data.</p>
            <button className="button primary full-width" onClick={onClose}>Понятно</button>
          </>
        ) : (
          <>
            <div className="modal-icon">
              <Settings2 size={21} />
            </div>
            <h2>{isCorrect ? "Скорректировать MMR" : registered ? "Профиль игрока" : "Начать отслеживание"}</h2>
            <p>{isCorrect ? "Укажите текущее значение из игры. Расчёт начнётся с новой точки." : "Введите Steam account ID публичного профиля. Это не вход в Steam: пароль и доступ к аккаунту не запрашиваются."}</p>
            <form onSubmit={onSubmit}>
              {!isCorrect && (
                <>
                  <label className="field-label" htmlFor="steam-account-id">Steam account ID или SteamID64</label>
                  <input
                    id="steam-account-id"
                    className="mmr-input"
                    required
                    value={accountId}
                    onChange={(event) => setAccountId(event.target.value)}
                    placeholder="Например, 7656119..."
                  />
                </>
              )}
              <label className="field-label" htmlFor="mmr-value">Текущий MMR</label>
              <input
                id="mmr-value"
                className="mmr-input"
                type="number"
                min="0"
                max="15000"
                required
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder="Например, 4680"
              />
              <button className="button primary full-width" type="submit" disabled={busy}>
                {busy ? "Подключаем..." : isCorrect ? "Сохранить MMR" : "Подключить профиль"}
              </button>
            </form>
            <small className="modal-footnote">Профиль и статистика загружаются через OpenDota; в Dota 2 нужно включить Expose Public Match Data. API-ключ OpenDota необязателен. Если профиль уже добавлен, его стартовый MMR не изменится.</small>
          </>
        )}
      </section>
    </div>
  );
}

export default Modal;
