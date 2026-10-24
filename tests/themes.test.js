import assert from "node:assert/strict";
import test from "node:test";
import { getThemePreference } from "../src/constants/themes.js";

test("uses the selected palette and falls back to the favorite hero attribute in automatic mode", () => {
  assert.equal(getThemePreference("auto", "Invoker", "int").accent, "#669ac1");
  assert.equal(getThemePreference("ember", "Invoker", "int").accent, "#c66d59");
  assert.equal(getThemePreference("forest", "Axe", "str").accent, "#72a879");
  assert.equal(getThemePreference("arcane", "Axe", "str").accent, "#669ac1");
  assert.equal(getThemePreference("gold", "Invoker", "int").accent, "#d7b16c");
  assert.equal(getThemePreference("unknown", "Axe", "str").accent, "#c66d59");
});
