import { useEffect, useMemo, useState } from "react";
import { Check, CircleHelp, Gamepad2, RotateCcw, Sparkles, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { HERO_CATALOG, resolveHeroAnswer } from "../../shared/hero-catalog.js";

const GAME_MODES = [
  { id: "guess", label: "Угадай героя" },
  { id: "quiz", label: "Викторина" },
  { id: "memory", label: "Память" },
];
const RECORD_KEY = "dota-minigame-best-score";

function makeQuestion() {
  const target = HERO_CATALOG[Math.floor(Math.random() * HERO_CATALOG.length)];
  const alternatives = HERO_CATALOG.filter((hero) => hero.id !== target.id);
  const choices = [target];
  while (choices.length < 4) {
    const choice = alternatives[Math.floor(Math.random() * alternatives.length)];
    if (!choices.some((hero) => hero.id === choice.id)) choices.push(choice);
  }
  return { target, choices: shuffle(choices) };
}

function makeMemoryCards() {
  const shuffled = shuffle(HERO_CATALOG).slice(0, 6);
  return shuffle([...shuffled, ...shuffled].map((hero, index) => ({ id: index, hero })));
}

function shuffle(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function HeroIcon({ hero, className = "" }) {
  return (
    <span className={`game-hero-icon ${className}`}>
      <img src={hero.icon} alt="" loading="lazy" onError={(event) => { event.currentTarget.hidden = true; }} />
      <span aria-hidden="true">{hero.displayName.slice(0, 1)}</span>
    </span>
  );
}

function GamesPage() {
  const [mode, setMode] = useState("guess");
  const [guessQuestion, setGuessQuestion] = useState(makeQuestion);
  const [quizQuestion, setQuizQuestion] = useState(makeQuestion);
  const [guessAnswer, setGuessAnswer] = useState(null);
  const [guessScore, setGuessScore] = useState(0);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [quizAnswer, setQuizAnswer] = useState(null);
  const [quizScore, setQuizScore] = useState(0);
  const [memoryCards, setMemoryCards] = useState(makeMemoryCards);
  const [flipped, setFlipped] = useState([]);
  const [matched, setMatched] = useState([]);
  const [memoryMoves, setMemoryMoves] = useState(0);
  const [bestScores, setBestScores] = useState({ guess: null, quiz: null, memory: null });
  const [legacyBestScore, setLegacyBestScore] = useState(null);
  const [storageNotice, setStorageNotice] = useState("");

  const memoryById = useMemo(() => new Map(memoryCards.map((card) => [card.id, card])), [memoryCards]);
  const hasMismatch = flipped.length === 2
    && memoryById.get(flipped[0])?.hero.id !== memoryById.get(flipped[1])?.hero.id;

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(RECORD_KEY) || "null");
      if (Number.isSafeInteger(saved) && saved > 0) {
        setLegacyBestScore(saved);
      } else if (saved && typeof saved === "object") {
        setBestScores({
          guess: Number.isSafeInteger(saved.guess) && saved.guess > 0 ? saved.guess : null,
          quiz: Number.isSafeInteger(saved.quiz) && saved.quiz > 0 ? saved.quiz : null,
          memory: Number.isSafeInteger(saved.memory) && saved.memory > 0 ? saved.memory : null,
        });
        if (Number.isSafeInteger(saved.legacy) && saved.legacy > 0) setLegacyBestScore(saved.legacy);
      }
    } catch (error) {
      setStorageNotice(`Не удалось прочитать рекорд из браузера: ${error.message}`);
    }
  }, []);

  useEffect(() => {
    if (!hasMismatch) return undefined;
    const timer = window.setTimeout(() => setFlipped([]), 850);
    return () => window.clearTimeout(timer);
  }, [hasMismatch]);

  const saveBestScore = (gameMode, score) => {
    const currentBest = bestScores[gameMode];
    const isBetter = currentBest == null
      || (gameMode === "memory" ? score < currentBest : score > currentBest);
    if (!isBetter) return;
    const updatedScores = { ...bestScores, [gameMode]: score };
    setBestScores(updatedScores);
    try {
      window.localStorage.setItem(RECORD_KEY, JSON.stringify({ ...updatedScores, legacy: legacyBestScore }));
      setStorageNotice("");
    } catch (error) {
      setStorageNotice(`Не удалось сохранить рекорд в браузере: ${error.message}`);
    }
  };

  const answerGuess = (heroId) => {
    if (guessAnswer != null) return;
    setGuessAnswer(heroId);
    if (heroId === guessQuestion.target.id) {
      const score = guessScore + 1;
      setGuessScore(score);
      saveBestScore("guess", score);
    }
  };

  const nextQuestion = () => {
    setGuessQuestion(makeQuestion());
    setGuessAnswer(null);
  };

  const submitQuizAnswer = (event) => {
    event.preventDefault();
    if (quizAnswer) return;
    const resolved = resolveHeroAnswer(typedAnswer);
    const isCorrect = resolved?.id === quizQuestion.target.id;
    setQuizAnswer(isCorrect ? "correct" : "incorrect");
    if (isCorrect) {
      const score = quizScore + 1;
      setQuizScore(score);
      saveBestScore("quiz", score);
    }
  };

  const nextQuizQuestion = () => {
    setQuizQuestion(makeQuestion());
    setTypedAnswer("");
    setQuizAnswer(null);
  };

  const flipMemoryCard = (card) => {
    if (flipped.length >= 2 || flipped.includes(card.id) || matched.includes(card.hero.id)) return;
    const nextFlipped = [...flipped, card.id];
    setFlipped(nextFlipped);
    if (nextFlipped.length === 2) {
      setMemoryMoves((moves) => moves + 1);
      if (memoryById.get(nextFlipped[0])?.hero.id === card.hero.id) {
        const nextMatched = [...matched, card.hero.id];
        setMatched(nextMatched);
        setFlipped([]);
        if (nextMatched.length === 6) saveBestScore("memory", memoryMoves + 1);
      }
    }
  };

  const restartMemory = () => {
    setMemoryCards(makeMemoryCards());
    setFlipped([]);
    setMatched([]);
    setMemoryMoves(0);
  };

  return (
    <section className="view-transition games-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">DOTA 2 · ТРЕНИРУЙ ПАМЯТЬ</p>
          <h1>Мини-игры</h1>
          <p className="heading-subtitle">Настоящие герои из общего каталога. Результаты игр не смешиваются со статистикой матчей.</p>
        </div>
        <div className="games-best-score">
          <Sparkles size={16} aria-hidden="true" />
          <span>
            {mode === "memory"
              ? <>Лучшее время по ходам: <b>{bestScores.memory == null ? "—" : `${bestScores.memory} ход.`}</b></>
              : <>Рекорд режима: <b>{bestScores[mode] ?? (legacyBestScore == null ? "—" : `${legacyBestScore} · общий`)}</b></>}
          </span>
        </div>
      </header>

      {storageNotice && <div className="notice" role="alert">{storageNotice}</div>}
      {mode === "memory" && bestScores.memory != null && matched.length === 6 && (
        <div className="game-result-message correct" role="status">
          {`Игра завершена за ${memoryMoves} ходов. Лучший результат — ${bestScores.memory} ход.`}
        </div>
      )}
      <div className="games-mode-list" role="group" aria-label="Выбор мини-игры">
        {GAME_MODES.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={mode === item.id}
            className={`games-mode-button ${mode === item.id ? "active" : ""}`}
            onClick={() => setMode(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {mode === "guess" && (
        <section className="card game-panel">
          <div className="game-panel-heading">
            <div><span className="analytics-metric-icon"><Gamepad2 size={17} aria-hidden="true" /></span><h2>Угадай героя</h2></div>
            <span className="game-score">Очки: <AnimatePresence mode="popLayout"><motion.b key={guessScore} initial={{ y: 8, opacity: 0, scale: 0.8 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: -7, opacity: 0, scale: 0.8 }} transition={{ duration: 0.2 }}>{guessScore}</motion.b></AnimatePresence></span>
          </div>
          <p className="game-instruction">Кто изображён на официальном арте?</p>
          <AnimatePresence mode="wait">
            <motion.div
              key={guessQuestion.target.id}
              className={`guess-hero-art ${guessAnswer != null ? "revealed" : ""}`}
              initial={{ opacity: 0, y: 12, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.99 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
            >
              <div className="guess-art-halo" />
              <img src={guessQuestion.target.artwork} alt="" onError={(event) => { event.currentTarget.hidden = true; }} />
              <span className="guess-art-caption">{guessAnswer != null ? guessQuestion.target.displayName : "КТО ЭТО?"}</span>
              <span className="guess-art-hint">{guessAnswer != null ? "ГЕРОЙ РАСКРЫТ" : "ВЫБЕРИ ПОРТРЕТ"}</span>
            </motion.div>
          </AnimatePresence>
          <div className="guess-choices">
            {guessQuestion.choices.map((hero, index) => {
              const correct = guessAnswer != null && hero.id === guessQuestion.target.id;
              const incorrect = guessAnswer === hero.id && !correct;
              return (
                <motion.button
                  type="button"
                  className={`guess-choice ${correct ? "correct" : ""} ${incorrect ? "incorrect" : ""}`}
                  key={hero.id}
                  disabled={guessAnswer != null}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.055, duration: 0.22 }}
                  whileHover={guessAnswer == null ? { y: -2, scale: 1.008 } : undefined}
                  whileTap={guessAnswer == null ? { scale: 0.985 } : undefined}
                  onClick={() => answerGuess(hero.id)}
                >
                  <HeroIcon hero={hero} />
                  <span>{hero.displayName}</span>
                  {correct && <motion.span className="choice-result-icon" initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }}><Check size={16} aria-label="Правильный ответ" /></motion.span>}
                  {incorrect && <motion.span className="choice-result-icon" initial={{ scale: 0, rotate: 40 }} animate={{ scale: 1, rotate: 0 }}><X size={16} aria-label="Неправильный ответ" /></motion.span>}
                </motion.button>
              );
            })}
          </div>
          <AnimatePresence>
            {guessAnswer != null && (
              <motion.div
                className={`game-result-row ${guessAnswer === guessQuestion.target.id ? "success" : "miss"}`}
                role="status"
                initial={{ opacity: 0, y: 12, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -6, height: 0 }}
              >
                <p>{guessAnswer === guessQuestion.target.id ? "Точно в цель! +1 очко" : `Это был ${guessQuestion.target.displayName}`}</p>
                <button className="button primary" type="button" onClick={nextQuestion}>Следующий герой</button>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}

      {mode === "quiz" && (
        <section className="card game-panel">
          <div className="game-panel-heading">
            <div><span className="analytics-metric-icon"><CircleHelp size={17} aria-hidden="true" /></span><h2>Викторина по именам</h2></div>
            <span className="game-score">Очки: <AnimatePresence mode="popLayout"><motion.b key={quizScore} initial={{ y: 8, opacity: 0, scale: 0.8 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: -7, opacity: 0, scale: 0.8 }} transition={{ duration: 0.2 }}>{quizScore}</motion.b></AnimatePresence></span>
          </div>
          <p className="game-instruction">Введите полное официальное имя героя. Регистр и лишние пробелы не важны.</p>
          <motion.div
            className="quiz-hero-card"
            key={quizQuestion.target.id}
            initial={{ opacity: 0, scale: 0.92, rotateX: -8 }}
            animate={{ opacity: 1, scale: 1, rotateX: 0 }}
            transition={{ duration: 0.32, ease: "easeOut" }}
          >
            <HeroIcon hero={quizQuestion.target} className="quiz-hero-icon" />
            <span className="quiz-hero-prompt">КТО СКРЫВАЕТСЯ ЗА ЭТОЙ ИКОНКОЙ?</span>
            <span className="quiz-hero-name">Как зовут этого героя?</span>
          </motion.div>
          <form className="quiz-answer-form" onSubmit={submitQuizAnswer}>
            <label className="visually-hidden" htmlFor="hero-quiz-answer">Имя героя</label>
            <input
              id="hero-quiz-answer"
              autoComplete="off"
              value={typedAnswer}
              onChange={(event) => setTypedAnswer(event.target.value)}
              placeholder="Например, Anti-Mage"
              disabled={Boolean(quizAnswer)}
              required
            />
            {!quizAnswer
              ? <button className="button primary" type="submit">Ответить</button>
              : <button className="button primary" type="button" onClick={nextQuizQuestion}>Следующий герой</button>}
          </form>
          <AnimatePresence>
            {quizAnswer && (
              <motion.p
                className={`game-result-message ${quizAnswer}`}
                role="status"
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6 }}
              >
                {quizAnswer === "correct" ? "Верно! +1 очко" : `Правильный ответ: ${quizQuestion.target.displayName}`}
              </motion.p>
            )}
          </AnimatePresence>
        </section>
      )}

      {mode === "memory" && (
        <section className="card game-panel">
          <div className="game-panel-heading">
            <div><span className="analytics-metric-icon"><Sparkles size={17} aria-hidden="true" /></span><h2>Память героев</h2></div>
            <span className="game-score">Ходы: <AnimatePresence mode="popLayout"><motion.b key={memoryMoves} initial={{ y: 8, opacity: 0, scale: 0.8 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: -7, opacity: 0, scale: 0.8 }} transition={{ duration: 0.2 }}>{memoryMoves}</motion.b></AnimatePresence></span>
          </div>
          <p className="game-instruction">Найдите все шесть пар одинаковых героев.</p>
          <div className="memory-grid">
            {memoryCards.map((card, index) => {
              const isVisible = flipped.includes(card.id) || matched.includes(card.hero.id);
              return (
                <motion.button
                  type="button"
                  key={card.id}
                  className={`memory-card ${isVisible ? "revealed" : ""} ${matched.includes(card.hero.id) ? "matched" : ""}`}
                  aria-label={isVisible ? card.hero.displayName : "Закрытая карточка героя"}
                  aria-pressed={isVisible}
                  disabled={matched.includes(card.hero.id)}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ opacity: { delay: index * 0.025 }, y: { delay: index * 0.025 } }}
                  whileHover={!isVisible && !matched.includes(card.hero.id) ? { y: -3, scale: 1.025 } : undefined}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => flipMemoryCard(card)}
                >
                  <span className={`memory-card-inner ${isVisible ? "flipped" : ""}`}>
                    <span className="memory-card-face memory-card-back"><Sparkles size={24} aria-hidden="true" /><small>DOTA 2</small></span>
                    <span className="memory-card-face memory-card-front"><HeroIcon hero={card.hero} /><span>{card.hero.displayName}</span></span>
                  </span>
                </motion.button>
              );
            })}
          </div>
          <div className="game-result-row">
            <p role="status">{matched.length === 6 ? `Все пары найдены за ${memoryMoves} ходов!` : `${matched.length} из 6 пар найдено`}</p>
            <motion.button className="button secondary" type="button" whileTap={{ scale: 0.97 }} onClick={restartMemory}><RotateCcw size={14} />Начать заново</motion.button>
          </div>
        </section>
      )}
    </section>
  );
}

export default GamesPage;
