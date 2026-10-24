import assert from "node:assert/strict";
import test from "node:test";
import { MAX_MATCH_PAGE_SIZE, parseMatchPagination } from "../server/match-pagination.js";

test("uses a default page size and caps large requests", () => {
  assert.deepEqual(parseMatchPagination({}), { limit: 30, offset: 0 });
  assert.deepEqual(parseMatchPagination({ limit: "1000", offset: "200" }), {
    limit: MAX_MATCH_PAGE_SIZE,
    offset: 200,
  });
});

test("rejects malformed and unsafe match pagination values", () => {
  for (const query of [
    { limit: "0" },
    { limit: "1.5" },
    { limit: "invalid" },
    { offset: "-1" },
    { offset: "1.2" },
    { offset: "9007199254740992" },
  ]) {
    assert.equal("error" in parseMatchPagination(query), true, JSON.stringify(query));
  }
});
