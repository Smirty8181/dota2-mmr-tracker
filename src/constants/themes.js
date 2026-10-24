const ATTRIBUTE_THEMES = Object.freeze({
  str: {
    accent: "#c66d59",
    bgGradient: "linear-gradient(135deg, #8b3e32, #401d1c)",
    glow: "rgba(198, 109, 89, 0.3)",
  },
  agi: {
    accent: "#72a879",
    bgGradient: "linear-gradient(135deg, #426c49, #1b3227)",
    glow: "rgba(114, 168, 121, 0.3)",
  },
  int: {
    accent: "#669ac1",
    bgGradient: "linear-gradient(135deg, #3f6686, #1b2a42)",
    glow: "rgba(102, 154, 193, 0.3)",
  },
  all: {
    accent: "#a887c5",
    bgGradient: "linear-gradient(135deg, #72528c, #332545)",
    glow: "rgba(168, 135, 197, 0.3)",
  },
});

const DEFAULT_THEME = Object.freeze({
  accent: "#d7b16c",
  bgGradient: "linear-gradient(135deg, #8c6d3e, #37291b)",
  glow: "rgba(215, 177, 108, 0.3)",
});

export const THEME_OPTIONS = Object.freeze([
  { id: "auto", label: "По атрибуту избранного героя" },
  { id: "ember", label: "Пламя силы" },
  { id: "forest", label: "Лес ловкости" },
  { id: "arcane", label: "Магия интеллекта" },
  { id: "gold", label: "Золото универсальности" },
]);

export function getHeroTheme(_heroName, primaryAttribute) {
  return ATTRIBUTE_THEMES[primaryAttribute] || DEFAULT_THEME;
}

export function getThemePreference(preference, heroName, primaryAttribute) {
  if (preference === "gold") return DEFAULT_THEME;
  const selectedAttribute = { ember: "str", forest: "agi", arcane: "int" }[preference];
  return selectedAttribute
    ? ATTRIBUTE_THEMES[selectedAttribute]
    : getHeroTheme(heroName, primaryAttribute);
}
