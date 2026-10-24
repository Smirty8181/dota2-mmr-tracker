import React, { useEffect, useMemo, useRef, useState } from "react";
import { lazy, Suspense } from "react";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import {
  Activity, ChevronRight, CircleHelp, Flame, Gamepad2, Image as ImageIcon,
  Gauge, LayoutDashboard, Menu, Search, Settings2, Shield, Star, Swords, Trophy,
  UserRound, Users, X, Zap, TrendingUp
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer,
  ReferenceLine, Tooltip, XAxis, YAxis
} from "recharts";
import { api } from "./api.js";
import { getThemePreference, THEME_OPTIONS } from "./constants/themes.js";
import { getHeroById, resolveHeroAnswer } from "../shared/hero-catalog.js";
import { formatEstimatedMmrChange } from "../shared/mmr.js";

import LoadingScreen from "./components/LoadingScreen";
import MedalEmblem from "./components/MedalEmblem";
import AnimatedNumber from "./components/AnimatedNumber";
import Stat from "./components/Stat";
import MatchPage from "./components/MatchPage";
import HeroesPage from "./components/HeroesPage";
import Modal from "./components/Modal";
import HeroMark from "./components/HeroMark";
import FavoriteHeroArtwork from "./components/FavoriteHeroArtwork";
import { Skeleton, SkeletonText, SkeletonCircle } from "./components/Skeleton";

const CardCreator = lazy(() => import("./components/CardCreator.jsx"));
const AnalyticsPage = lazy(() => import("./components/AnalyticsPage.jsx"));
const GamesPage = lazy(() => import("./components/GamesPage.jsx"));
const ComparisonPage = lazy(() => import("./components/ComparisonPage.jsx"));
const AchievementsPage = lazy(() => import("./components/AchievementsPage.jsx"));
const SettingsPage = lazy(() => import("./components/SettingsPage.jsx"));
const ProPlayersPage = lazy(() => import("./components/ProPlayersPage.jsx"));

const medals = ["Рекрут", "Страж", "Рыцарь", "Герой", "Легенда", "Властелин", "Божество", "Титан"];
const medalFromTier = (tier) => Number.isInteger(tier) && tier > 0
  ? `${medals[Math.min(7, Math.floor(tier / 10) - 1)]} ${tier % 10 ? `★ ${tier % 10}` : ""}`.trim()
  : "Ранг не указан";

const containerVars = {
  hidden: { opacity: 0, y: 16, filter: "blur(8px)" },
  visible: {
    opacity: 1, y: 0, filter: "blur(0px)",
    transition: {
      duration: 0.42,
      ease: [0.22, 1, 0.36, 1],
      staggerChildren: 0.055,
      delayChildren: 0.035
    }
  },
  exit: { opacity: 0, y: -10, filter: "blur(6px)", transition: { duration: 0.2, ease: "easeIn" } },
};

const itemVars = {
  hidden: { opacity: 0, y: 15, filter: "blur(10px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.42,
      ease: [0.22, 1, 0.36, 1]
    }
  }
};

function Logo() {
  return (
    <div className="brand-logo-container">
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--accent-color)" />
            <stop offset="100%" stopColor="#d7b16c" />
          </linearGradient>
          <filter id="logo-glow" x="-35%" y="-35%" width="170%" height="170%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        <path d="M32 4L55 17V43L32 57L9 43V17L32 4Z" stroke="#d7b16c66" strokeWidth="1.4" fill="#111419" />
        <path d="M32 9L50 19V41L32 52L14 41V19L32 9Z" fill="url(#logo-grad)" filter="url(#logo-glow)" />
        <path d="M32 15L44 22V38L32 45L20 38V22L32 15Z" fill="#101419" />
        <text x="50%" y="51%" dominantBaseline="middle" textAnchor="middle" fill="#f7e7c2" fontSize="12" fontWeight="800" style={{ fontFamily: "Manrope", letterSpacing: "0.2px" }}>DMT</text>
      </svg>
    </div>
  );
}

function RankTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const change = payload[0].payload.change;
  return (
    <div className="chart-tooltip">
      <span style={{ color: "var(--text-dim)", fontSize: "11px", display: "block", marginBottom: "4px" }}>{label} · OpenDota snapshot</span>
      <b style={{ fontSize: "16px", color: "white", display: "block", marginBottom: "4px" }}>{payload[0].value.toLocaleString("ru-RU")} MMR</b>
      <small style={{
        color: change > 0 ? "var(--accent-win)" : (change < 0 ? "var(--accent-color)" : "var(--text-muted)"),
        fontSize: "12px",
        display: "block"
      }}>
        {change > 0 ? `+${change}` : change} к прошлой точке · {medalFromTier(payload[0].payload.rankTier)}
      </small>
    </div>
  );
}

function App() {
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState("Профиль");
  const [themePreference, setThemePreference] = useState(() => {
    const saved = localStorage.getItem("dota-accent-preference");
    return THEME_OPTIONS.some((option) => option.id === saved) ? saved : "auto";
  });
  const [reducedMotion, setReducedMotion] = useState(() => {
    const saved = localStorage.getItem("dota-reduced-motion");
    return saved == null ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : saved === "true";
  });
  const [backgroundHeroId, setBackgroundHeroId] = useState(() => {
    const saved = localStorage.getItem("dota-background-hero-id");
    return saved === "none" || saved === "favorite" || getHeroById(saved) ? saved : "favorite";
  });
  const [matches, setMatches] = useState([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [hasMoreMatches, setHasMoreMatches] = useState(false);
  const [loadingMoreMatches, setLoadingMoreMatches] = useState(false);
  const [loadMoreMatchesError, setLoadMoreMatchesError] = useState("");
  const [matchDetailsById, setMatchDetailsById] = useState({});
  const [matchDetailsErrors, setMatchDetailsErrors] = useState({});
  const [loadingMatchDetailsKey, setLoadingMatchDetailsKey] = useState("");
  const [requestingMatchParseKey, setRequestingMatchParseKey] = useState("");
  const [matchParseStatusById, setMatchParseStatusById] = useState({});
  const [accountId, setAccountId] = useState(() => localStorage.getItem("dota-account-id") || "");
  const [profileData, setProfileData] = useState(null);
  const [heroes, setHeroes] = useState([]);
  const [favoriteHeroId, setFavoriteHeroId] = useState(() => localStorage.getItem("dota-favorite-hero-id") || "");
  const [accountInput, setAccountInput] = useState("");
  const [mmr, setMmr] = useState(0);
  const [startingMmr, setStartingMmr] = useState(0);
  const [personalBestMmr, setPersonalBestMmr] = useState(0);
  const [registered, setRegistered] = useState(false);
  const [modal, setModal] = useState("");
  const [mmrInput, setMmrInput] = useState("");
  const [query, setQuery] = useState("");
  const [heroSort, setHeroSort] = useState("games");
  const [historyRange, setHistoryRange] = useState("30 дней");
  const [selectedMatch, setSelectedMatch] = useState(0);
  const [mobileNav, setMobileNav] = useState(false);
  const [notice, setNotice] = useState("");
  const [legendaryNotice, setLegendaryNotice] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [matchQuery, setMatchQuery] = useState("");
  const matchDetailsRequests = useRef(new Map());
  const matchParseRequests = useRef(new Set());
  const accountIdRef = useRef(accountId);
  const matchPageRequestRef = useRef(0);
  const matchPageLoadingRef = useRef(false);

  const autoFavoriteHero = useMemo(() => [...heroes]
    .filter((hero) => hero.games > 0)
    .sort((a, b) => b.games - a.games || a.id - b.id)[0] || null, [heroes]);
  const favoriteHero = useMemo(() => {
    if (favoriteHeroId) {
      const catalogHero = getHeroById(favoriteHeroId);
      if (!catalogHero) return null;
      const playerStats = heroes.find((hero) => hero.id === catalogHero.id);
      return {
        ...playerStats,
        ...catalogHero,
        name: catalogHero.displayName,
        image: catalogHero.portrait,
        artImage: catalogHero.artwork,
        renderImage: catalogHero.artwork,
        manuallySelected: true,
      };
    }
    return autoFavoriteHero ? { ...autoFavoriteHero, manuallySelected: false } : null;
  }, [autoFavoriteHero, favoriteHeroId, heroes]);
  const backgroundHero = useMemo(() => {
    if (backgroundHeroId === "none") return null;
    const hero = backgroundHeroId === "favorite" ? favoriteHero : getHeroById(backgroundHeroId);
    if (!hero) return null;
    return {
      ...hero,
      id: hero.id,
      name: hero.name || hero.displayName,
      artwork: api.assetUrl(`/assets/heroes/${hero.id}`),
      artImage: api.assetUrl(`/assets/heroes/${hero.id}`),
      image: hero.image || hero.portrait,
    };
  }, [backgroundHeroId, favoriteHero]);

  function updateBackgroundHero(heroId) {
    const isValidHero = heroId === "none" || heroId === "favorite" || Boolean(getHeroById(heroId));
    if (!isValidHero) {
      setNotice("Выбран неизвестный фон.");
      return;
    }
    try {
      localStorage.setItem("dota-background-hero-id", heroId);
      setBackgroundHeroId(heroId);
      setNotice("Фон приложения сохранён в этом браузере.");
    } catch (error) {
      setNotice(`Не удалось сохранить фон: ${error.message}`);
    }
  }

  useEffect(() => {
    if (!localStorage.getItem("dota-favorite-hero-id")) {
      const legacyHero = resolveHeroAnswer(localStorage.getItem("dota-favorite-hero"));
      if (legacyHero) {
        const migratedId = String(legacyHero.id);
        localStorage.setItem("dota-favorite-hero-id", migratedId);
        setFavoriteHeroId(migratedId);
      }
    }
    localStorage.removeItem("dota-favorite-hero");
    localStorage.removeItem("dota-favorite-hero-image");
  }, []);

  useEffect(() => {
    const theme = getThemePreference(themePreference, favoriteHero?.name, favoriteHero?.primaryAttribute);
    document.documentElement.style.setProperty("--accent-color", theme.accent);
    document.documentElement.style.setProperty("--accent-glow", theme.glow);
    document.documentElement.style.setProperty("--accent-gradient", theme.bgGradient);
  }, [favoriteHero?.name, favoriteHero?.primaryAttribute, themePreference]);

  useEffect(() => {
    document.documentElement.classList.toggle("reduce-motion", reducedMotion);
  }, [reducedMotion]);

  useEffect(() => {
    accountIdRef.current = accountId;
    matchPageRequestRef.current += 1;
    matchPageLoadingRef.current = false;
    setLoadingMoreMatches(false);
    setLoadMoreMatchesError("");
  }, [accountId]);

  useEffect(() => {
    let active = true;
    if (!accountId) {
      const timer = window.setTimeout(() => setLoading(false), 650);
      return () => { active = false; window.clearTimeout(timer); };
    }

    setLoading(true);
    Promise.allSettled([api.profile(accountId), api.matchPage(accountId), api.heroes(accountId)])
      .then(([profileResult, matchesResult, heroesResult]) => {
        if (!active) return;
        if (profileResult.status === "rejected") throw profileResult.reason;
        const profile = profileResult.value;
        setProfileData(profile);
        setMmr(profile.player.estimatedMmr);
        setStartingMmr(profile.player.initialMmr);
        setPersonalBestMmr(profile.player.personalBestMmr);
        setRegistered(true);
        const partialErrors = [...(profile.warnings || [])];
        if (matchesResult.status === "fulfilled") {
          setMatches(matchesResult.value.matches);
          setTotalMatches(matchesResult.value.total);
          setHasMoreMatches(matchesResult.value.hasMore);
        }
        else partialErrors.push(matchesResult.reason.message);
        if (heroesResult.status === "fulfilled") setHeroes(heroesResult.value);
        else partialErrors.push(heroesResult.reason.message);
        if (partialErrors.length) setNotice(`Основные данные загружены, но часть статистики недоступна: ${partialErrors.join(" ")}`);
      })
      .catch((error) => {
        if (!active) return;
        if (error.status === 404) {
          localStorage.removeItem("dota-account-id");
          setAccountId("");
          setRegistered(false);
          setProfileData(null);
          setMatches([]);
          setTotalMatches(0);
          setHasMoreMatches(false);
          setLoadingMoreMatches(false);
          setLoadMoreMatchesError("");
          setHeroes([]);
          setMmr(0);
          setStartingMmr(0);
          setPersonalBestMmr(0);
        }
        setNotice(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [accountId]);

  const adjustedHistory = useMemo(() => {
    const snapshots = profileData?.rankSnapshots || [];
    const points = snapshots.map((snapshot, index) => ({
      day: new Date(snapshot.capturedOn).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }),
      mmr: snapshot.estimatedMmr,
      rankTier: snapshot.rankTier,
      change: index ? snapshot.estimatedMmr - snapshots[index - 1].estimatedMmr : 0,
    }));
    const rangeDays = { "7 дней": 7, "30 дней": 30, "3 месяца": 90 };
    const days = rangeDays[historyRange];
    return days
      ? points.filter((point, index) => index === points.length - 1 || Date.now() - new Date(profileData.rankSnapshots[index].capturedOn).getTime() < days * 24 * 60 * 60 * 1000)
      : points;
  }, [historyRange, profileData]);

  const visibleHeroes = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("ru-RU");
    return [...heroes]
      .filter((hero) => hero.name.toLocaleLowerCase("ru-RU").includes(normalizedQuery))
      .sort((a, b) => {
        if (heroSort === "win") return (b.win ?? -1) - (a.win ?? -1) || b.games - a.games || a.id - b.id;
        if (heroSort === "gpm") return (b.gpm ?? -1) - (a.gpm ?? -1) || b.games - a.games || a.id - b.id;
        return b.games - a.games || a.id - b.id;
      });
  }, [heroSort, heroes, query]);

  const match = matches[selectedMatch] || matches[0];
  const featuredHeroes = [...heroes].filter((hero) => hero.games > 0)
    .sort((a, b) => b.games - a.games || a.id - b.id).slice(0, 3);

  const periodChange = adjustedHistory.length > 1
    ? mmr - adjustedHistory[0].mmr
    : null;

  const recentResults = matches.map((entry) => entry.result);
  let currentStreak = 0;
  if (recentResults.length > 0) {
    for (const result of recentResults) {
      if (result !== recentResults[0]) break;
      currentStreak += 1;
    }
  }

  const rankProgress = Number.isInteger(profileData?.player.rankTier) && profileData.player.rankTier % 10 > 0
    ? Math.min(100, Math.max(0, ((profileData.player.rankTier % 10) / 5) * 100))
    : null;
  const rankName = medalFromTier(profileData?.player.rankTier);
  const rankProgressLabel = Number.isInteger(profileData?.player.rankTier)
    ? profileData.player.rankTier % 10
      ? `Звезда ${profileData.player.rankTier % 10} из 5`
      : "Медаль получена · место не отображается"
    : "Прогресс ранга пока недоступен";

  const stats = profileData?.stats;
  const profileName = profileData?.player.personaName || (accountId ? "Публичный профиль Steam" : "Профиль не подключён");

  const navItems = [
    { name: "Профиль", icon: LayoutDashboard },
    { name: "Матчи", icon: Swords },
    { name: "Игры", icon: Gamepad2 },
    { name: "Аналитика", icon: Activity },
    { name: "Сравнение", icon: Users },
    { name: "Достижения", icon: Trophy },
    { name: "Настройки", icon: Settings2 },
    { name: "Профи", icon: Users },
    { name: "Герои", icon: Shield },
    { name: "Карточка", icon: ImageIcon },
  ];

  const insights = currentStreak >= 3 && ["Победа", "Поражение"].includes(recentResults[0])
    ? [{
      type: "info",
      text: `${currentStreak} последних сохранённых матчей подряд: ${recentResults[0].toLowerCase()}.`,
    }]
    : [];

  const roadToRank = useMemo(() => {
    if (!profileData?.player.rankTier) return null;
    const tier = profileData.player.rankTier;
    const star = tier % 10;
    return {
      nextRank: medalFromTier(tier % 10 === 5 ? tier + (tier >= 75 ? 5 : 6) : tier + 1),
      progress: (star / 5) * 100,
      needed: 5 - star
    };
  }, [profileData]);

  async function shareProfile() {
    if (!accountId) {
      setAccountInput("");
      setMmrInput("");
      setModal("register");
      return;
    }
    try {
      await navigator.clipboard.writeText(`https://www.opendota.com/players/${accountId}`);
      setNotice("Ссылка на публичный профиль OpenDota скопирована.");
    } catch (error) {
      setNotice(`Профиль OpenDota: https://www.opendota.com/players/${accountId}`);
    }
  }

  function updateThemePreference(preference) {
    if (!THEME_OPTIONS.some((option) => option.id === preference)) {
      setNotice("Неизвестная цветовая тема.");
      return;
    }
    try {
      localStorage.setItem("dota-accent-preference", preference);
      setThemePreference(preference);
      setNotice("Цветовая тема сохранена в этом браузере.");
    } catch (error) {
      setNotice(`Не удалось сохранить цветовую тему: ${error.message}`);
    }
  }

  function updateReducedMotion(enabled) {
    try {
      localStorage.setItem("dota-reduced-motion", String(enabled));
      setReducedMotion(enabled);
      setNotice(enabled ? "Уменьшенная анимация включена." : "Анимация интерфейса включена.");
    } catch (error) {
      setNotice(`Не удалось сохранить настройку анимации: ${error.message}`);
    }
  }

  function clearMinigameRecord() {
    try {
      localStorage.removeItem("dota-minigame-best-score");
      setNotice("Локальный рекорд мини-игр удалён.");
    } catch (error) {
      setNotice(`Не удалось удалить рекорд мини-игр: ${error.message}`);
    }
  }

  function clearWeeklyGoal() {
    if (!accountId) return;
    try {
      localStorage.removeItem(`dota-weekly-match-goal:${accountId}`);
      setNotice("Недельная цель удалена.");
    } catch (error) {
      setNotice(`Не удалось удалить недельную цель: ${error.message}`);
    }
  }

  function openRegistration() {
    setAccountInput(accountId);
    setMmrInput(String(mmr || ""));
    setModal("register");
  }

  async function refreshAccountData(id = accountId) {
    if (!id) return;
    matchPageRequestRef.current += 1;
    matchPageLoadingRef.current = false;
    setLoadingMoreMatches(false);
    const profile = await api.profile(id);
    setProfileData(profile);
    setMmr(profile.player.estimatedMmr);
    setStartingMmr(profile.player.initialMmr);
    setPersonalBestMmr(profile.player.personalBestMmr);
    setRegistered(true);
    const [matchesResult, heroesResult] = await Promise.allSettled([api.matchPage(id), api.heroes(id)]);
    const partialErrors = [...(profile.warnings || [])];
    if (matchesResult.status === "fulfilled") {
      setMatches(matchesResult.value.matches);
      setTotalMatches(matchesResult.value.total);
      setHasMoreMatches(matchesResult.value.hasMore);
      setLoadMoreMatchesError("");
    }
    else partialErrors.push(matchesResult.reason.message);
    if (heroesResult.status === "fulfilled") setHeroes(heroesResult.value);
    else partialErrors.push(heroesResult.reason.message);
    return partialErrors.length
      ? `Основные данные обновлены, но часть статистики недоступна: ${partialErrors.join(" ")}`
      : "";
  }

  async function loadMoreMatches() {
    if (!accountId || matchPageLoadingRef.current || !hasMoreMatches) return;
    const requestAccountId = accountId;
    const requestId = ++matchPageRequestRef.current;
    matchPageLoadingRef.current = true;
    setLoadingMoreMatches(true);
    setLoadMoreMatchesError("");
    try {
      const page = await api.matchPage(requestAccountId, matches.length);
      if (requestId !== matchPageRequestRef.current || accountIdRef.current !== requestAccountId) return;
      setMatches((current) => {
        const knownIds = new Set(current.map((match) => match.matchId));
        return [...current, ...page.matches.filter((match) => !knownIds.has(match.matchId))];
      });
      setTotalMatches(page.total);
      setHasMoreMatches(page.hasMore);
    } catch (error) {
      if (requestId === matchPageRequestRef.current && accountIdRef.current === requestAccountId) {
        setLoadMoreMatchesError(error.message);
      }
    } finally {
      if (requestId === matchPageRequestRef.current) {
        matchPageLoadingRef.current = false;
        setLoadingMoreMatches(false);
      }
    }
  }

  async function saveRegistration(event) {
    event.preventDefault();
    const value = Number(mmrInput);
    if (!accountInput.trim()) {
      setNotice("Введите Steam account ID или SteamID64.");
      return;
    }
    if (!Number.isInteger(value) || value < 0 || value > 15000) {
      setNotice("Введите число MMR от 0 до 15000.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await api.register(accountInput.trim(), value);
      if (result.player.accountId !== accountId) {
        setProfileData(null);
        setMatches([]);
        setTotalMatches(0);
        setHasMoreMatches(false);
        setLoadMoreMatchesError("");
        setHeroes([]);
        setSelectedMatch(0);
        setMmr(value);
        setStartingMmr(value);
        setPersonalBestMmr(value);
        setRegistered(false);
      } else {
        await refreshAccountData(result.player.accountId);
      }
      localStorage.setItem("dota-account-id", result.player.accountId);
      setAccountId(result.player.accountId);
      setModal("");
      setNotice([
        result.created ? "Профиль создан. Начинаю загрузку данных OpenDota." : "Профиль обновлён. Существующий MMR сохранён.",
        ...(result.warnings || []),
      ].join(" "));
    } catch (error) {
      setNotice(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function correctMmr(event) {
    event.preventDefault();
    const value = Number(mmrInput);
    if (!Number.isInteger(value) || value < 0 || value > 15000) {
      setNotice("Введите число MMR от 0 до 15000.");
      return;
    }
    setSubmitting(true);
    try {
      await api.correctMmr(accountId, value);
      await refreshAccountData();
      setNotice("Расчётный MMR скорректирован и сохранён.");
      setModal("");
    } catch (error) {
      setNotice(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function syncMatches() {
    if (!accountId) {
      setAccountInput("");
      setMmrInput("");
      setModal("register");
      return;
    }
    setSyncing(true);
    try {
      const previousBest = personalBestMmr;
      const result = await api.sync(accountId);
      const refreshWarning = await refreshAccountData();
      const newPersonalBest = result.player.personalBestMmr > previousBest;
      const syncMessage = newPersonalBest
        ? `Новый пик силы — ${result.player.personalBestMmr.toLocaleString("ru-RU")} MMR.`
        : result.syncedRankedMatches
          ? `Синхронизировано новых рейтинговых матчей: ${result.syncedRankedMatches}. Изменение расчёта: ${result.mmrChange > 0 ? "+" : ""}${result.mmrChange} MMR.`
          : "Данные обновлены.";
      setLegendaryNotice(newPersonalBest);
      setNotice([refreshWarning, ...(result.warnings || []), syncMessage].filter(Boolean).join(" "));
    } catch (error) {
      setNotice(error.message);
    } finally {
      setSyncing(false);
    }
  }

  async function selectMatch(index, { refresh = false, quiet = false } = {}) {
    setSelectedMatch(index);
    const selected = matches[index];
    if (!accountId || !selected?.matchId) return;
    const detailsKey = `${accountId}:${selected.matchId}`;
    if (!refresh && matchDetailsById[detailsKey]) return matchDetailsById[detailsKey];
    const pendingRequest = matchDetailsRequests.current.get(detailsKey);
    if (pendingRequest) return pendingRequest;

    setLoadingMatchDetailsKey(detailsKey);
    const request = (async () => {
      try {
        const details = await api.matchDetails(accountId, selected.matchId);
        setMatchDetailsById((current) => ({ ...current, [detailsKey]: details }));
        setMatchDetailsErrors((current) => {
          if (!current[detailsKey]) return current;
          const next = { ...current };
          delete next[detailsKey];
          return next;
        });
        if (details.player || details.parsed) {
          setMatches((current) => current.map((entry) => entry.matchId === selected.matchId
            ? {
              ...entry,
              gold: details.timelines.gold.length ? details.timelines.gold : entry.gold,
              lastHits: details.timelines.lastHits.length ? details.timelines.lastHits : entry.lastHits,
              xp: details.timelines.xp.length ? details.timelines.xp : entry.xp,
              gpm: details.player?.gpm ?? details.match?.gpm ?? entry.gpm,
              xpm: details.player?.xpm ?? details.match?.xpm ?? entry.xpm,
              lh: details.player?.lastHits ?? details.match?.lastHits ?? entry.lh,
              lane: details.player?.lane || entry.lane,
            }
            : entry));
        }
        if (details.parsed) {
          setMatchParseStatusById((current) => {
            if (!current[detailsKey]) return current;
            const next = { ...current };
            delete next[detailsKey];
            return next;
          });
        } else if (!matchParseStatusById[detailsKey] && !matchParseRequests.current.has(detailsKey)) {
          void requestMatchParse(index, { automatic: true });
        }
        if (!quiet && details.warnings?.length) setNotice(details.warnings.join(" "));
        return details;
      } catch (error) {
        setMatchDetailsErrors((current) => ({ ...current, [detailsKey]: error.message }));
        if (!quiet) setNotice(error.message);
        return null;
      } finally {
        matchDetailsRequests.current.delete(detailsKey);
        setLoadingMatchDetailsKey((current) => current === detailsKey ? "" : current);
      }
    })();
    matchDetailsRequests.current.set(detailsKey, request);
    return request;
  }

  async function requestMatchParse(index, { automatic = false } = {}) {
    const selected = matches[index];
    if (!accountId || !selected?.matchId) return;
    const detailsKey = `${accountId}:${selected.matchId}`;
    if (matchParseRequests.current.has(detailsKey)) return;
    matchParseRequests.current.add(detailsKey);
    setRequestingMatchParseKey(detailsKey);
    try {
      await api.requestMatchParse(accountId, selected.matchId);
      setMatchParseStatusById((current) => ({ ...current, [detailsKey]: "queued" }));
      if (!automatic) setNotice("OpenDota приняла запрос на разбор. Загружаю составы и статистику матча…");

      for (let attempt = 0; attempt < 8; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 5000));
        const details = await selectMatch(index, { refresh: true, quiet: true });
        if (!details) break;
        if (details?.parsed) {
          setNotice("Разбор завершён: составы обеих команд и статистика матча загружены.");
          return;
        }
      }

      setMatchParseStatusById((current) => ({ ...current, [detailsKey]: "pending" }));
      setNotice("OpenDota ещё обрабатывает матч. Нажмите «Проверить данные» через некоторое время.");
    } catch (error) {
      setMatchDetailsErrors((current) => ({ ...current, [detailsKey]: error.message }));
      setNotice(error.message);
    } finally {
      matchParseRequests.current.delete(detailsKey);
      setRequestingMatchParseKey("");
    }
  }

  useEffect(() => {
    if (page === "Матчи" && matches.length) void selectMatch(selectedMatch);
  }, [page, selectedMatch, matches.length, accountId]);

  useEffect(() => {
    setSelectedMatch(0);
    setMatchDetailsById({});
    setMatchDetailsErrors({});
    setMatchParseStatusById({});
    setLoadingMatchDetailsKey("");
  }, [accountId]);

  if (loading) return <LoadingScreen hero={favoriteHero} />;

  return (
    <MotionConfig reducedMotion={reducedMotion ? "always" : "never"}>
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <div className="brand-top">
          <a className="brand" href="#" onClick={(e) => e.preventDefault()} aria-label="Dota 2 Player Hub">
            <Logo />
            <span className="brand-wordmark"><b>DOTA 2</b><small>PLAYER HUB</small></span>
          </a>
          <button className="icon-button nav-close" onClick={() => setMobileNav(false)}><X size={18} /></button>
        </div>
        <div className="side-label">МЕНЮ</div>
        <nav className="side-nav">
          {navItems.map(({ name, icon: Icon }) => (
            <button key={name} className={page === name ? "active" : ""} onClick={() => { if (name === "Матчи" && matches.length) selectMatch(selectedMatch); setPage(name); setMobileNav(false); }}>
              <Icon size={16} />{name}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-card"><Shield size={16} /><span><b>Только ваши данные</b><small>Приватность важна</small></span></div>
          <button className="side-help" onClick={() => setModal("help")}><CircleHelp size={16} /> Как это работает</button>
        </div>
      </aside>

      {mobileNav && <button className="mobile-overlay" onClick={() => setMobileNav(false)} />}

      <main className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setMobileNav(true)}><Menu size={20} /></button>
          <div className="breadcrumb"><span>Статистика</span><ChevronRight size={14} /><b>{page}</b></div>
          <div className="top-actions">
            <button className="account-menu" onClick={openRegistration}>
              <span className="account-avatar"><UserRound size={16} /></span>
              <span><b>{profileName}</b><small>{registered ? `Steam ID ${accountId}` : accountId ? "Данные временно недоступны" : "Подключите публичный профиль"}</small></span>
            </button>
          </div>
        </header>

        <div className="page-content">
          <AnimatePresence>
            {notice && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={`notice ${legendaryNotice ? "legendary" : ""}`}
              >
                {legendaryNotice && <Trophy size={15} />}
                <span>{notice}</span>
                <button onClick={() => setNotice("")}><X size={14} /></button>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={page}
              variants={containerVars}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="view-transition"
            >
            <div className="page-transition-mist" aria-hidden="true" />
            {page === "Профиль" && (
              <>
                <motion.div variants={itemVars} className="page-heading">
                  <div>
                    <p className="eyebrow">DOTA 2 · PLAYER OVERVIEW</p>
                    <h1>Профиль</h1>
                    <p className="heading-subtitle">Ваш рейтинг, история и последние матчи.</p>
                  </div>
                  <div className="heading-actions">
                    <button className="button secondary" onClick={syncMatches} disabled={syncing}><Activity size={15} /> {syncing ? "Обновляем..." : "Обновить"}</button>
                    <button className="button secondary" onClick={() => setPage("Карточка")} disabled={!registered}><ImageIcon size={15} /> Создать карточку</button>
                    <button className="button primary" onClick={() => { setMmrInput(String(mmr)); setModal("correct"); }} disabled={!registered}><Settings2 size={15} /> Скорректировать MMR</button>
                  </div>
                </motion.div>

                <motion.div variants={itemVars} className="profile-overview-grid">
                  <div className="profile-primary-column">
                    <section className="profile-hero card">
                    <FavoriteHeroArtwork hero={backgroundHero} />

                    <div className="profile-hero-layout">
                      <div className="profile-hero-left">
                        <MedalEmblem rank={rankName} tier={profileData?.player.rankTier} />
                        <div className="medal-info">
                          <span className="medal-rank-name">{rankName}</span>
                          <span className="medal-division">{profileData?.player.rankTier || "—"}</span>
                        </div>
                      </div>

                      <div className="profile-hero-center">
                        <div className="profile-identity">
                          <p className="profile-kicker">
                            <span className={registered ? "online-dot" : "offline-dot"}></span>
                            {registered ? "ДАННЫЕ OPEN DOTA ЗАГРУЖЕНЫ" : accountId ? "ID СОХРАНЁН · ДАННЫЕ НЕДОСТУПНЫ" : "ПРОФИЛЬ НЕ ПОДКЛЮЧЁН"}
                          </p>
                          {profileData?.player.avatarUrl && <img className="profile-avatar-image" src={profileData.player.avatarUrl} alt="" />}
                          <h2 className="profile-nickname">{profileName}</h2>
                          <p className="steam-id">{accountId ? `Steam account ID: ${accountId}` : "Профиль Steam ещё не подключён"}</p>
                          <div className="rank-badge"><Shield size={12} /><span>Ранг: <b>{rankName}</b></span></div>
                          <button className="button-share" onClick={shareProfile}><Users size={14} /> {accountId ? "Поделиться профилем" : "Добавить публичный профиль"}</button>
                        </div>
                      </div>

                      <div className="profile-hero-right">
                        <div className="mmr-display">
                          <span className="mmr-label">Текущий MMR</span>
                          <strong className="mmr-value">{registered ? <><AnimatedNumber value={mmr} /><small> MMR</small></> : "—"}</strong>
                          <em className={`mmr-change ${periodChange == null ? "" : periodChange >= 0 ? "positive" : "negative"}`}>
                            {periodChange == null ? "Недостаточно истории" : `${periodChange >= 0 ? "▲" : "▼"} ${Math.abs(periodChange)} за период`}
                          </em>
                        </div>

                        <div className="rank-progress-container">
                          <div className="progress-header">
                            <span>{roadToRank ? `До ${roadToRank.nextRank}` : "Прогресс ранга"}</span>
                            <span>{roadToRank ? `${roadToRank.progress}%` : "—"}</span>
                          </div>
                          {roadToRank && (
                            <div className="progress-bar">
                              <div className="progress-fill" style={{ width: `${roadToRank.progress}%` }} />
                            </div>
                          )}
                        </div>

                        <div className="personal-best">
                          <Trophy size={14} />
                          <span>Личный рекорд: <b>{registered ? personalBestMmr.toLocaleString("ru-RU") : "—"}</b></span>
                        </div>
                      </div>
                    </div>

                    <div className="profile-hero-bottom">
                      <div className="quick-fact"><Trophy size={14} /><span>Рекорд: <b>{registered ? `${personalBestMmr.toLocaleString("ru-RU")} MMR` : "—"}</b></span></div>
                      <div className="quick-fact"><Flame size={14} /><span>{favoriteHero?.manuallySelected ? "Выбранный герой" : "Чаще всего играете на"}: <b>{favoriteHero?.name || "Нет данных"}</b></span></div>
                      <div className="quick-fact"><Zap size={14} /><span>Рейтинговые матчи: <b>{stats?.totalMatches ?? "Нет данных"}</b></span></div>
                    </div >
                    </section>

                    <section className="card recent-card">
                      <div className="section-head"><div><h3>Последние матчи</h3><p>Недавние игры</p></div><button className="text-button" onClick={() => setPage("Матчи")}>Все матчи <ChevronRight size={13} /></button></div>
                      <div className="mini-match-list">
                        {matches.length ? matches.slice(0, 4).map((item, index) => (
                          <button key={item.matchId} className={`mini-match ${item.result === "Победа" ? "won" : "lost"}`} onClick={() => { setSelectedMatch(index); setPage("Матчи"); }}>
                            <HeroMark hero={item} small />
                            <span className="mini-match-info"><b>{item.hero}</b><small>{item.result} · {item.durationLabel}</small></span>
                            <span className={`mini-match-mmr ${item.mmr > 0 ? "positive" : item.mmr < 0 ? "negative" : ""}`}>{formatEstimatedMmrChange(item.mmr)}</span>
                          </button>
                        )) : <div className="empty-state">{registered ? "OpenDota пока не вернул матчи для этого профиля." : accountId ? "История матчей пока недоступна." : "Подключите публичный профиль Steam, чтобы загрузить матчи."}</div>}
                      </div>
                    </section>
                  </div>

                  <div className="overview-side">
                    <section className="card stats-card">
                      <div className="section-head"><div><h3>Общая статистика</h3><p>Сохранённые рейтинговые матчи · OpenDota</p></div></div>
                      <div className="stats-grid">
                        <Stat label="Винрейт" value={stats?.winRate == null ? "Нет матчей" : `${stats.winRate}%`} sub={stats ? `${stats.wins} побед из ${stats.totalMatches}` : "Данные не загружены"} icon={Trophy} />
                        <Stat label="Средний GPM" value={stats?.averageGpm ?? "Нет данных"} sub={stats?.totalMatches ? "по сохранённым матчам" : "Нет рейтинговых матчей"} icon={Gauge} />
                        <Stat label="Средний XPM" value={stats?.averageXpm ?? "Нет данных"} sub={stats?.totalMatches ? "по сохранённым матчам" : "Нет рейтинговых матчей"} icon={Activity} />
                        <Stat label="Рейтинговые матчи" value={stats?.totalMatches ?? "Нет данных"} sub="в сохранённой истории" icon={Gamepad2} />
                        <Stat label="Чаще всего играете на" value={autoFavoriteHero?.name || "Нет данных"} sub={autoFavoriteHero ? `${autoFavoriteHero.games} матчей · OpenDota` : "Недостаточно данных"} icon={Flame} />
                      </div>
                      {insights.length > 0 && (
                        <div className="profile-insights">
                          <div className="insight-header"><Zap size={14} /> <span>Текущая серия</span></div>
                          {insights.map((ins, i) => (
                            <div key={i} className={`profile-insight ${ins.type}`}>{ins.text}</div>
                          ))}
                        </div>
                      )}
                    </section>

                  </div>
                  </motion.div>

                <motion.section variants={itemVars} className="card rank-card rank-wide">
                  <div className="section-head"><div><h3>История MMR</h3><p>Ежедневные снимки рейтинга</p></div><div className="range-switch">{["7 дней", "30 дней", "3 месяца", "Всё время"].map((range) => <button key={range} className={historyRange === range ? "selected" : ""} onClick={() => setHistoryRange(range)}>{range}</button>)}</div></div>
                  <div className="chart-wrap rank-chart">{adjustedHistory.length > 1 ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={adjustedHistory} margin={{ top: 12, right: 8, left: -16, bottom: 0 }}><defs><linearGradient id="rankFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent-color)" stopOpacity={0.22} /><stop offset="95%" stopColor="var(--accent-color)" stopOpacity={0.01} /></linearGradient></defs><CartesianGrid stroke="var(--border-color)" vertical={false} /><XAxis dataKey="day" tick={{ fill: "var(--text-dim)", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis domain={["dataMin - 120", "dataMax + 100"]} tick={{ fill: "var(--text-dim)", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip content={<RankTooltip />} /><Area type="monotone" dataKey="mmr" stroke="var(--accent-color)" strokeWidth={2.5} fill="url(#rankFill)" activeDot={{ r: 5, fill: "#f7d28d", stroke: "#101823", strokeWidth: 2 }} /><ReferenceLine y={mmr} stroke="var(--accent-win)" strokeDasharray="5 5" label={{ value: "Сейчас", fill: "var(--accent-win)", fontSize: 10, position: "insideTopRight" }} />{personalBestMmr > mmr && <ReferenceLine y={personalBestMmr} stroke="#DDB46A" strokeDasharray="3 5" label={{ value: "Рекорд", fill: "#DDB46A", fontSize: 10, position: "insideTopRight" }} />}</AreaChart></ResponsiveContainer> : <div className="empty-state">{adjustedHistory.length === 1 ? `Есть одна точка: ${adjustedHistory[0].mmr.toLocaleString("ru-RU")} MMR. Следующая ежедневная запись покажет динамику.` : registered ? "История появится после ежедневной синхронизации рейтинга." : "Подключите профиль, чтобы начать собирать историю MMR."}</div>}</div>
                  <div className="rank-footer"><div className="medal-progress"><MedalEmblem className="tiny" rank={rankName} tier={profileData?.player.rankTier} /><div><b>{rankName}</b><span>Стартовый MMR: {registered ? startingMmr.toLocaleString("ru-RU") : "—"}</span></div></div>{rankProgress != null && <div className="progress-track"><i style={{ width: `${rankProgress}%` }} /></div>}<span className="rank-next">{registered ? `${mmr.toLocaleString("ru-RU")} MMR` : "—"}</span></div>
                </motion.section>

                <motion.div variants={itemVars} className="bottom-panels">
                  <section className="card top-heroes-card">
                    <div className="section-head"><div><h3>Лучшие герои</h3><p>Статистика OpenDota</p></div><button className="text-button" onClick={() => setPage("Герои")}>Все герои <ChevronRight size={13} /></button></div>
                    <div className="top-heroes-list">
                      {featuredHeroes.length ? featuredHeroes.map((hero, index) => <button className="top-hero" key={hero.id} onClick={() => setPage("Герои")}><HeroMark hero={hero} /><span><b>{hero.name}</b><small>{hero.games} игр · {hero.gpm ?? "Нет данных"} GPM</small></span><em>{hero.win == null ? "Нет данных" : `${hero.win}%`}</em><i className="hero-place">0{index + 1}</i></button>) : <div className="empty-state">Статистика по героям появится после синхронизации профиля.</div>}
                    </div>
                  </section>
                  <section className="card achievements-card">
                    <div className="section-head"><div><h3>Достижения</h3><p>Подтверждённые результаты</p></div></div>
                    <div className="achievement-list">
                      <div className={`achievement ${personalBestMmr > startingMmr ? "unlocked" : "locked"}`}><span><Trophy size={18} /></span><b>Новый пик</b><small>{personalBestMmr > startingMmr ? `${personalBestMmr} MMR` : "Рекорд не обновлён"}</small></div>
                      <div className={`achievement ${recentResults.length && currentStreak >= 3 ? "unlocked" : "locked"}`}><span><Flame size={18} /></span><b>{recentResults.length ? (recentResults[0] === "Поражение" ? "Серия поражений" : "Серия побед") : "Серия матчей"}</b><small>{currentStreak >= 3 ? `${currentStreak} подряд` : recentResults.length ? "Нужно 3 подряд" : "Нет данных"}</small></div>
                      <div className={`achievement ${matches.length ? "unlocked" : "locked"}`}><span><Swords size={18} /></span><b>Первый матч</b><small>{matches.length ? "Условие выполнено" : "Ожидает данных"}</small></div>
                      <div className={`achievement ${(stats?.totalMatches || 0) >= 100 ? "unlocked" : "locked"}`}><span><Gamepad2 size={18} /></span><b>Опытный игрок</b><small>{(stats?.totalMatches || 0) >= 100 ? "100+ матчей" : `${stats?.totalMatches ?? 0} из 100 матчей`}</small></div>
                    </div>
                  </section>
                  </motion.div>
              </>
            )}

            {page === "Матчи" && (
              <MatchPage
                matches={matches}
                match={match}
                selected={selectedMatch}
                setSelected={selectMatch}
                stats={stats}
                query={matchQuery}
                setQuery={setMatchQuery}
                accountId={accountId}
                details={match ? matchDetailsById[`${accountId}:${match.matchId}`] : null}
                itemTimingBenchmarks={match ? matchDetailsById[`${accountId}:${match.matchId}`]?.itemTimingBenchmarks : null}
                detailsLoading={Boolean(match && loadingMatchDetailsKey === `${accountId}:${match.matchId}`)}
                detailsError={match ? matchDetailsErrors[`${accountId}:${match.matchId}`] : ""}
                parsePending={match ? matchParseStatusById[`${accountId}:${match.matchId}`] === "pending" : false}
                parseLoading={Boolean(match && requestingMatchParseKey === `${accountId}:${match.matchId}`)}
                onRetryDetails={() => selectMatch(selectedMatch, { refresh: true })}
                onRequestMatchParse={() => requestMatchParse(selectedMatch)}
                totalMatches={totalMatches}
                hasMoreMatches={hasMoreMatches}
                loadingMoreMatches={loadingMoreMatches}
                loadMoreMatchesError={loadMoreMatchesError}
                onLoadMoreMatches={loadMoreMatches}
                onConnect={openRegistration}
                onRefresh={syncMatches}
                syncing={syncing}
              />
            )}
            {page === "Игры" && (
              <Suspense fallback={<div className="empty-state">Загружаем мини-игры…</div>}>
                <GamesPage />
              </Suspense>
            )}
            {page === "Настройки" && (
              <Suspense fallback={<div className="empty-state">Загружаем настройки…</div>}>
                <SettingsPage
                  themePreference={themePreference}
                  reducedMotion={reducedMotion}
                  backgroundHeroId={backgroundHeroId}
                  backgroundHero={backgroundHero}
                  onThemeChange={updateThemePreference}
                  onReducedMotionChange={updateReducedMotion}
                  onBackgroundHeroChange={updateBackgroundHero}
                  onClearGameRecord={clearMinigameRecord}
                  onClearWeeklyGoal={clearWeeklyGoal}
                  hasWeeklyGoal={Boolean(accountId && localStorage.getItem(`dota-weekly-match-goal:${accountId}`))}
                />
              </Suspense>
            )}
            {page === "Профи" && (
              <Suspense fallback={<div className="empty-state">Загружаем профессиональных игроков…</div>}>
                <ProPlayersPage />
              </Suspense>
            )}
            {page === "Аналитика" && (
              <Suspense fallback={<div className="empty-state">Загружаем аналитику…</div>}>
                <AnalyticsPage accountId={accountId} onConnect={openRegistration} />
              </Suspense>
            )}
            {page === "Сравнение" && (
              <Suspense fallback={<div className="empty-state">Загружаем сравнение…</div>}>
                <ComparisonPage accountId={accountId} onConnect={openRegistration} />
              </Suspense>
            )}
            {page === "Достижения" && (
              <Suspense fallback={<div className="empty-state">Загружаем достижения…</div>}>
                <AchievementsPage
                  accountId={accountId}
                  onConnect={openRegistration}
                  stats={stats}
                  startingMmr={registered ? startingMmr : null}
                  personalBestMmr={registered ? personalBestMmr : null}
                  matches={matches}
                />
              </Suspense>
            )}
            {page === "Герои" && <HeroesPage
              heroes={visibleHeroes}
              query={query}
              setQuery={setQuery}
              sort={heroSort}
              setSort={setHeroSort}
              favoriteHero={favoriteHero}
              onFavorite={(hero) => {
                setFavoriteHeroId(String(hero.id));
                localStorage.setItem("dota-favorite-hero-id", String(hero.id));
                localStorage.removeItem("dota-favorite-hero");
                localStorage.removeItem("dota-favorite-hero-image");
                setNotice(`${hero.name} выбран вручную. Частый герой по статистике отображается отдельно.`);
              }}
              onClearFavorite={() => {
                setFavoriteHeroId("");
                localStorage.removeItem("dota-favorite-hero-id");
                localStorage.removeItem("dota-favorite-hero");
                localStorage.removeItem("dota-favorite-hero-image");
                setNotice("Показывается герой с наибольшим числом матчей.");
              }}
            />}
            {page === "Карточка" && (
              <Suspense fallback={<div className="empty-state">Загружаем редактор карточки…</div>}>
                <CardCreator
                  profile={profileData}
                  stats={stats}
                  mmr={registered ? mmr : null}
                  startingMmr={registered ? startingMmr : null}
                  personalBestMmr={registered ? personalBestMmr : null}
                  matches={matches}
                  heroes={heroes}
                  favoriteHero={favoriteHero}
                />
              </Suspense>
            )}
            </motion.div>
          </AnimatePresence>

          <footer className="page-footer"><span>Dota2 MMR Tracker <i /> Учебный проект</span><span>{registered ? "Данные профиля и матчей загружены через OpenDota" : "Подключите свой публичный профиль Steam"}</span></footer>
        </div>
      </main>

      {modal && <Modal type={modal} value={mmrInput} setValue={setMmrInput} accountId={accountInput} setAccountId={setAccountInput} onClose={() => setModal("")} onSubmit={modal === "correct" ? correctMmr : saveRegistration} registered={registered} busy={submitting} />}
    </div>
    </MotionConfig>
  );
}

export default App;
