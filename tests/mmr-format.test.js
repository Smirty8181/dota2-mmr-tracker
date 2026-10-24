import assert from "node:assert/strict";
import test from "node:test";
import { formatEstimatedMmrChange } from "../shared/mmr.js";

test("formats estimated MMR changes without turning unknown values into zero", () => {
  assert.equal(formatEstimatedMmrChange(25), "≈ +25 MMR");
  assert.equal(formatEstimatedMmrChange(-25), "≈ -25 MMR");
  assert.equal(formatEstimatedMmrChange(0), "≈ 0 MMR");
  assert.equal(formatEstimatedMmrChange(null), "—");
});
