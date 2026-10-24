import assert from "node:assert/strict";
import test from "node:test";
import { formatKda } from "../server/match-format.js";

test("preserves zero-valued KDA fields", () => {
  assert.equal(formatKda({ kills: 0, deaths: 2, assists: 7 }), "0 / 2 / 7");
});

test("marks unavailable KDA fields instead of inventing zeroes", () => {
  assert.equal(formatKda({ kills: null, deaths: 0, assists: undefined }), "— / 0 / —");
});
