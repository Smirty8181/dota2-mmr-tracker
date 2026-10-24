export const CARD_FORMATS = {
  landscape: { label: "Горизонтальная", width: 1200, height: 630 },
  square: { label: "Квадратная", width: 1080, height: 1080 },
  story: { label: "История", width: 1080, height: 1920 },
};

export const CARD_TEMPLATES = {
  minimal: { label: "Минимализм", background: "#11161c", accent: "#d9b671", ink: "#f4f0e9" },
  hero: { label: "Кинематографический", background: "#11161c", accent: "#c96654", ink: "#f4f0e9" },
  prestige: { label: "Престиж", background: "#17140f", accent: "#e2bd70", ink: "#fff4d9" },
  competitive: { label: "Соревновательный", background: "#10171a", accent: "#77c6ae", ink: "#eff8f3" },
  meme: { label: "Мемный", background: "#14171b", accent: "#87cbb1", ink: "#eff8f3" },
};

export const CARD_ACCENTS = ["#d9b671", "#c96654", "#71b7cf", "#87cbb1", "#a78be0"];

const METRIC_LABELS = {
  mmr: "Расчётный MMR",
  winRate: "Винрейт",
  kda: "KDA",
  matches: "Рейтинговые матчи",
  bestMmr: "Личный рекорд",
};

export function calculateCardMetrics(stats, matches, mmr, personalBestMmr) {
  const availableMatches = matches.filter((match) =>
    Number.isFinite(match.kills) && Number.isFinite(match.deaths) && Number.isFinite(match.assists),
  );
  const totals = availableMatches.reduce((result, match) => ({
    kills: result.kills + match.kills,
    deaths: result.deaths + match.deaths,
    assists: result.assists + match.assists,
  }), { kills: 0, deaths: 0, assists: 0 });
  const kda = availableMatches.length
    ? ((totals.kills + totals.assists) / Math.max(1, totals.deaths)).toFixed(2)
    : null;

  return [
    { id: "mmr", label: METRIC_LABELS.mmr, value: Number.isFinite(mmr) ? `${mmr.toLocaleString("ru-RU")} MMR` : null },
    { id: "winRate", label: METRIC_LABELS.winRate, value: Number.isFinite(stats?.winRate) ? `${stats.winRate}%` : null },
    { id: "kda", label: METRIC_LABELS.kda, value: kda, sample: availableMatches.length },
    { id: "matches", label: METRIC_LABELS.matches, value: Number.isInteger(stats?.totalMatches) ? String(stats.totalMatches) : null },
    { id: "bestMmr", label: METRIC_LABELS.bestMmr, value: Number.isFinite(personalBestMmr) ? `${personalBestMmr.toLocaleString("ru-RU")} MMR` : null },
  ];
}

export function calculateCardAchievements(stats, matches, startingMmr, personalBestMmr) {
  const achievements = [];
  if (Number.isInteger(stats?.totalMatches) && stats.totalMatches > 0) achievements.push("Первый матч");
  if (Number.isInteger(stats?.totalMatches) && stats.totalMatches >= 100) achievements.push("Ветеран · 100 матчей");
  if (personalBestMmr > startingMmr) achievements.push(`Новый пик · ${personalBestMmr.toLocaleString("ru-RU")} MMR`);

  const firstResult = matches[0]?.result;
  if (firstResult === "Победа" || firstResult === "Поражение") {
    let streak = 0;
    for (const match of matches) {
      if (match.result !== firstResult) break;
      streak += 1;
    }
    if (streak >= 3) achievements.push(`${firstResult === "Победа" ? "Серия побед" : "Серия поражений"} · ${streak}`);
  }
  return achievements;
}

function drawRoundedRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function truncateText(context, value, maxWidth) {
  let text = String(value ?? "");
  if (context.measureText(text).width <= maxWidth) return text;
  while (text.length && context.measureText(`${text}…`).width > maxWidth) text = text.slice(0, -1);
  return text ? `${text}…` : "";
}

const imageCache = new Map();

function loadImage(url) {
  if (!url) return null;
  if (imageCache.has(url)) return imageCache.get(url);
  const imageRequest = new Promise((resolve) => {
    const image = new Image();
    const finish = (result) => {
      window.clearTimeout(timeout);
      if (!result) imageCache.delete(url);
      resolve(result);
    };
    const timeout = window.setTimeout(() => finish(null), 5000);
    image.crossOrigin = "anonymous";
    image.onload = () => finish(image);
    image.onerror = () => finish(null);
    image.src = url;
  });
  imageCache.set(url, imageRequest);
  return imageRequest;
}

function getMedalLabel(rankTier) {
  const medals = ["Рекрут", "Страж", "Рыцарь", "Герой", "Легенда", "Властелин", "Божество", "Титан"];
  if (!Number.isInteger(rankTier) || rankTier < 10) return null;
  const medalTier = Math.min(8, Math.floor(rankTier / 10));
  const stars = rankTier % 10;
  return `${medals[medalTier - 1]}${stars > 0 && stars <= 5 ? ` · ${stars}★` : ""}`;
}

export async function renderProfileCard(canvas, { player, hero, metrics, achievements }, options) {
  const format = CARD_FORMATS[options.format] || CARD_FORMATS.landscape;
  const template = CARD_TEMPLATES[options.template] || CARD_TEMPLATES.minimal;
  const accent = CARD_ACCENTS.includes(options.accent) ? options.accent : template.accent;
  const width = format.width;
  const height = format.height;
  const heroImageUrl = hero?.artwork || hero?.artImage || hero?.renderImage || hero?.image;
  const showMedal = ["prestige", "competitive"].includes(options.template) && getMedalLabel(player?.rankTier);
  const [heroImage, avatar, medalImage] = await Promise.all([
    loadImage(options.showHero ? heroImageUrl : null),
    loadImage(options.showAvatar ? player?.avatarUrl : null),
    loadImage(showMedal ? `https://www.opendota.com/assets/images/dota2/rank_icons/rank_icon_${Math.min(8, Math.floor(player.rankTier / 10))}.png` : null),
  ]);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Браузер не смог создать холст для PNG.");

  canvas.width = width;
  canvas.height = height;
  await document.fonts?.ready;

  context.fillStyle = template.background;
  context.fillRect(0, 0, width, height);
  const backgroundGradient = context.createLinearGradient(0, 0, width, height);
  backgroundGradient.addColorStop(0, `${accent}25`);
  backgroundGradient.addColorStop(0.55, "#10151a");
  backgroundGradient.addColorStop(1, "#090c10");
  context.fillStyle = backgroundGradient;
  context.fillRect(0, 0, width, height);

  const margin = Math.round(width * (options.template === "prestige" ? 0.058 : 0.065));
  const vertical = height > width * 1.4;
  const unavailableImage = Boolean(options.showHero && heroImageUrl && !heroImage) || Boolean(options.showAvatar && player?.avatarUrl && !avatar);
  if (heroImage) {
    context.save();
    drawRoundedRect(context, width * 0.43, 0, width * 0.57, vertical ? height * 0.38 : height, Math.round(width * 0.025));
    context.clip();
    context.globalAlpha = options.template === "minimal" ? 0.2 : 0.34;
    const imageScale = Math.max(width * 0.57 / heroImage.width, (vertical ? height * 0.38 : height) / heroImage.height);
    const imageWidth = heroImage.width * imageScale;
    const imageHeight = heroImage.height * imageScale;
    context.drawImage(heroImage, width - imageWidth + width * 0.025, (vertical ? height * 0.38 - imageHeight : height - imageHeight) / 2, imageWidth, imageHeight);
    context.restore();
  }

  const heroFade = context.createLinearGradient(width * 0.43, 0, width, 0);
  heroFade.addColorStop(0, "#090c1010");
  heroFade.addColorStop(0.42, "#090c10b8");
  heroFade.addColorStop(1, "#090c1038");
  context.fillStyle = heroFade;
  context.fillRect(width * 0.43, 0, width * 0.57, vertical ? height * 0.38 : height);

  if (options.template === "competitive") {
    context.fillStyle = `${accent}12`;
    context.beginPath();
    context.moveTo(width * 0.8, 0);
    context.lineTo(width, 0);
    context.lineTo(width, height);
    context.lineTo(width * 0.94, height);
    context.closePath();
    context.fill();
  } else if (options.template === "prestige") {
    context.strokeStyle = `${accent}22`;
    context.lineWidth = Math.max(1, width * 0.001);
    context.beginPath();
    context.arc(width * 0.92, height * 0.12, width * 0.2, 0, Math.PI * 2);
    context.stroke();
  } else if (options.template === "meme") {
    context.fillStyle = `${accent}18`;
    context.fillRect(0, height * 0.91, width, height * 0.09);
  }

  context.strokeStyle = `${accent}a0`;
  context.lineWidth = Math.max(2, width * 0.002);
  drawRoundedRect(context, margin * 0.55, margin * 0.55, width - margin * 1.1, height - margin * 1.1, Math.round(width * 0.02));
  context.stroke();

  const contentX = margin * 1.35;
  const contentWidth = width - contentX * 2;
  const headerY = margin * (vertical ? 1.55 : 1.15);
  const avatarSize = Math.round(width * (vertical ? 0.17 : options.format === "square" ? 0.09 : 0.075));
  if (avatar && options.showAvatar) {
    context.save();
    context.beginPath();
    context.arc(contentX + avatarSize / 2, headerY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    context.clip();
    context.drawImage(avatar, contentX, headerY, avatarSize, avatarSize);
    context.restore();
  } else if (options.showAvatar) {
    context.fillStyle = `${accent}30`;
    context.beginPath();
    context.arc(contentX + avatarSize / 2, headerY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = accent;
    context.font = `700 ${Math.round(avatarSize * 0.38)}px "Segoe UI", sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText((player?.personaName || "DOTA").slice(0, 2).toLocaleUpperCase("ru-RU"), contentX + avatarSize / 2, headerY + avatarSize / 2);
    context.textAlign = "left";
    context.textBaseline = "alphabetic";
  }

  const textX = contentX + (options.showAvatar ? avatarSize + margin * 0.55 : 0);
  const nameFont = Math.round(width * (vertical ? 0.055 : options.format === "square" ? 0.038 : 0.034));
  context.fillStyle = template.ink;
  context.font = `700 ${nameFont}px "Segoe UI", Arial, sans-serif`;
  if (options.showPlayerName) {
    context.fillText(truncateText(context, player?.personaName || "Профиль Dota 2", width - textX - contentX), textX, headerY + avatarSize * 0.46);
  }
  context.fillStyle = "#aab2ba";
  context.font = `500 ${Math.round(width * (vertical ? 0.017 : 0.013))}px "Segoe UI", Arial, sans-serif`;
  const headerLabel = options.showAccountId && player?.accountId
    ? `DOTA 2 PLAYER CARD  ·  ID ${player.accountId}`
    : "DOTA 2 PLAYER CARD";
  context.fillText(truncateText(context, headerLabel, width - textX - contentX), textX, headerY + avatarSize * 0.77);

  const titleY = headerY + avatarSize + margin * (vertical ? 0.9 : 0.52);
  context.fillStyle = accent;
  context.font = `700 ${Math.round(width * (vertical ? 0.022 : 0.014))}px "Segoe UI", Arial, sans-serif`;
  context.fillText(CARD_TEMPLATES[options.template]?.label.toLocaleUpperCase("ru-RU") || "PROFILE", contentX, titleY);
  context.fillStyle = template.ink;
  const titleFont = Math.round(width * (vertical ? 0.045 : options.format === "square" ? 0.033 : 0.029));
  context.font = `700 ${titleFont}px "Segoe UI", Arial, sans-serif`;
  context.fillText(truncateText(context, options.title || "Моя статистика", contentWidth), contentX, titleY + width * 0.055);
  let subtitleY = titleY + width * 0.09;
  if (options.subtitle) {
    context.fillStyle = "#b1b7bd";
    context.font = `400 ${Math.round(width * (vertical ? 0.018 : 0.014))}px "Segoe UI", Arial, sans-serif`;
    context.fillText(truncateText(context, options.subtitle, contentWidth), contentX, subtitleY);
    subtitleY += width * 0.035;
  }

  const heroLineY = subtitleY + width * (vertical ? 0.038 : 0.026);
  const medalLabel = showMedal ? getMedalLabel(player.rankTier) : null;
  const medalSize = medalLabel ? Math.round(width * (vertical ? 0.055 : 0.04)) : 0;
  const medalWidth = medalLabel ? medalSize + width * 0.15 : 0;
  const heroName = hero?.displayName || hero?.name;
  if (options.showHero && heroName) {
    context.fillStyle = "#b5bbc0";
    context.font = `500 ${Math.round(width * (vertical ? 0.02 : 0.015))}px "Segoe UI", Arial, sans-serif`;
    const heroLineWidth = Math.max(width * 0.25, contentWidth - medalWidth - (medalLabel ? width * 0.025 : 0));
    context.fillText(truncateText(context, `Герой: ${heroName}`, heroLineWidth), contentX, heroLineY);
  }
  if (medalLabel) {
    const medalX = width - contentX - medalWidth;
    if (medalImage) {
      context.drawImage(medalImage, medalX, heroLineY - medalSize * 0.8, medalSize, medalSize);
    } else {
      context.fillStyle = `${accent}30`;
      context.beginPath();
      context.arc(medalX + medalSize / 2, heroLineY - medalSize * 0.35, medalSize / 2, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = `${accent}90`;
      context.stroke();
    }
    context.fillStyle = template.ink;
    context.font = `600 ${Math.round(width * (vertical ? 0.015 : 0.012))}px "Segoe UI", Arial, sans-serif`;
    context.textAlign = "right";
    context.fillText(truncateText(context, medalLabel, medalWidth - medalSize - width * 0.02), width - contentX, heroLineY);
    context.textAlign = "left";
  }
  const selectedMetrics = metrics.filter((metric) => options.visibleMetrics[metric.id] && metric.value);
  const columns = options.format === "landscape" ? Math.min(3, Math.max(1, selectedMetrics.length)) : 2;
  const rows = Math.max(1, Math.ceil(selectedMetrics.length / columns));
  const cellGap = Math.round(width * (vertical ? 0.018 : 0.014));
  const cellWidth = (contentWidth - cellGap * (columns - 1)) / columns;
  const metricsY = Math.max(
    heroLineY + width * (vertical ? 0.045 : 0.035),
    height * (vertical ? 0.36 : options.format === "square" ? 0.38 : 0.55),
  );
  const availableGridHeight = height - metricsY - margin * (vertical ? 2.6 : 1.15);
  const cellHeight = Math.max(54, Math.min(
    Math.round(width * (vertical ? 0.23 : options.format === "square" ? 0.15 : 0.09)),
    Math.floor((availableGridHeight - cellGap * (rows - 1)) / rows),
  ));

  selectedMetrics.forEach((metric, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = contentX + column * (cellWidth + cellGap);
    const y = metricsY + row * (cellHeight + cellGap);
    context.fillStyle = options.template === "prestige" ? "#d9b67112" : "#ffffff0a";
    drawRoundedRect(context, x, y, cellWidth, cellHeight, Math.round(width * 0.015));
    context.fill();
    context.strokeStyle = `${accent}45`;
    context.lineWidth = Math.max(1, width * 0.0008);
    context.stroke();
    context.fillStyle = "#aeb4ba";
    context.font = `600 ${Math.round(width * (options.format === "landscape" ? 0.012 : vertical ? 0.015 : 0.016))}px "Segoe UI", Arial, sans-serif`;
    const landscapeLabels = {
      mmr: "MMR",
      winRate: "Винрейт",
      kda: "KDA",
      matches: "Матчи",
      bestMmr: "Рекорд",
    };
    const label = options.format === "landscape" ? landscapeLabels[metric.id] : metric.label;
    context.fillText(truncateText(context, label.toLocaleUpperCase("ru-RU"), cellWidth - cellGap * 2), x + cellGap, y + cellHeight * 0.32);
    context.fillStyle = template.ink;
    context.font = `700 ${Math.round(width * (options.format === "landscape" ? 0.021 : vertical ? 0.029 : 0.031))}px "Segoe UI", Arial, sans-serif`;
    context.fillText(truncateText(context, metric.value, cellWidth - cellGap * 2), x + cellGap, y + cellHeight * 0.73);
    if (metric.id === "kda" && metric.sample) {
      context.fillStyle = "#8d979f";
      context.font = `400 ${Math.round(width * (vertical ? 0.012 : 0.010))}px "Segoe UI", Arial, sans-serif`;
      context.fillText(`по ${metric.sample} матчам`, x + cellGap, y + cellHeight * 0.91);
    }
    context.fillStyle = accent;
    context.fillRect(x + cellGap, y + cellHeight - Math.max(2, width * 0.0025), Math.min(cellWidth * 0.24, width * 0.055), Math.max(2, width * 0.0025));
  });

  const gridBottom = metricsY + rows * cellHeight + Math.max(0, rows - 1) * cellGap;
  if (options.showAchievements && dataHasAchievements(achievements)) {
    const achievementY = Math.min(gridBottom + margin * 0.52, height - margin * 1.6);
    context.fillStyle = accent;
    context.font = `600 ${Math.round(width * (vertical ? 0.015 : 0.012))}px "Segoe UI", Arial, sans-serif`;
    context.fillText(truncateText(context, `ДОСТИЖЕНИЯ  ·  ${achievements.join("  ·  ")}`, contentWidth), contentX, achievementY);
  }

  context.fillStyle = "#77818a";
  context.font = `400 ${Math.round(width * (vertical ? 0.012 : 0.01))}px "Segoe UI", Arial, sans-serif`;
  const footerY = height - margin * 0.86;
  context.fillText("DOTA 2 PLAYER HUB", contentX, footerY);
  context.textAlign = "right";
  context.fillText("Расчётный рейтинг · данные OpenDota", width - contentX, footerY);
  context.textAlign = "left";
  return { unavailableImage };
}

function dataHasAchievements(achievements) {
  return Array.isArray(achievements) && achievements.length > 0;
}
