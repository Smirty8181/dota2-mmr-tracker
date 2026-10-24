import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchHeroConstants,
  fetchProPlayers,
  fetchRecentMatches,
  getHeroIcon,
  getHeroImage,
  getHeroRenderImage,
  normalizeAccountId,
  OpenDotaError,
  requestMatchParse,
} from "../server/opendota.js";
import { calculateRankedMmr } from "../server/mmr.js";

test("normalizes numeric Steam account IDs and SteamID64", () => {
  assert.equal(normalizeAccountId("12345"), "12345");
  assert.equal(normalizeAccountId("76561197960278073"), "12345");
  assert.equal(normalizeAccountId("not-an-id"), null);
  assert.equal(normalizeAccountId("0"), null);
});

test("passes the match pagination offset to OpenDota", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl;
  globalThis.fetch = async (url) => {
    requestedUrl = new URL(url);
    return { ok: true, status: 200, text: async () => "[]" };
  };
  try {
    assert.deepEqual(await fetchRecentMatches("12345", 100, 200), []);
    assert.equal(requestedUrl.searchParams.get("limit"), "100");
    assert.equal(requestedUrl.searchParams.get("offset"), "200");
    assert.equal(requestedUrl.searchParams.get("significant"), "0");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("submits an explicit parse request for an OpenDota match", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl;
  let requestedMethod;
  globalThis.fetch = async (url, options) => {
    requestedUrl = new URL(url);
    requestedMethod = options.method;
    return { ok: true, status: 200, text: async () => JSON.stringify({ job: { jobId: "job-1" } }) };
  };
  try {
    assert.deepEqual(await requestMatchParse("7654321"), { job: { jobId: "job-1" } });
    assert.equal(requestedUrl.pathname, "/api/request/7654321");
    assert.equal(requestedMethod, "POST");
    await assert.rejects(requestMatchParse("not-a-match"), (error) => error instanceof OpenDotaError && error.status === 400);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("builds distinct URLs for official hero artwork, icon, and illustration", () => {
  const constants = {
    "1": {
      name: "npc_dota_hero_antimage",
      icon: "/apps/dota2/images/dota_react/heroes/icons/antimage.png?",
    },
  };

  assert.equal(
    getHeroImage(1, constants),
    "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/heroes/antimage_full.png",
  );
  assert.equal(
    getHeroIcon(1, constants),
    "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/icons/antimage.png",
  );
  assert.equal(
    getHeroRenderImage(1, constants),
    "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/antimage.png",
  );
  assert.equal(getHeroImage(999, constants), null);
  assert.equal(getHeroIcon(999, constants), null);
});

test("shares concurrent hero-constants requests and caches successful results", async () => {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => {
    requests += 1;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return { ok: true, status: 200, text: async () => JSON.stringify({ "1": { name: "npc_dota_hero_antimage" } }) };
  };
  try {
    const [first, second] = await Promise.all([fetchHeroConstants(), fetchHeroConstants()]);
    assert.deepEqual(first, second);
    assert.equal(requests, 1);
    assert.deepEqual(await fetchHeroConstants(), first);
    assert.equal(requests, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("normalizes and caches the real OpenDota professional-player directory", async () => {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  let invalidResponse = true;
  globalThis.fetch = async () => {
    requests += 1;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify(invalidResponse
        ? [{ account_id: null, name: "" }]
        : [{
          account_id: 12345,
          name: "Pro Player",
          personaname: "Public Steam Name",
          avatarfull: "https://example.test/avatar.png",
          country_code: "XX",
          team_id: 7,
          team_name: "Example Team",
        }]),
    };
  };
  try {
    await assert.rejects(fetchProPlayers(), (error) => error instanceof OpenDotaError && error.status === 502);
    invalidResponse = false;
    const [first, second] = await Promise.all([fetchProPlayers(), fetchProPlayers()]);
    assert.deepEqual(first, [{
      accountId: "12345",
      name: "Pro Player",
      avatarUrl: "https://example.test/avatar.png",
      countryCode: "XX",
      teamId: 7,
      teamName: "Example Team",
    }]);
    assert.deepEqual(second, first);
    assert.deepEqual(await fetchProPlayers(), first);
    assert.equal(requests, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("surfaces rate limits and the Retry-After value", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false,
    status: 429,
    headers: { get: (name) => name === "retry-after" ? "60" : null },
    text: async () => JSON.stringify({ error: "rate limit" }),
  });

  try {
    await assert.rejects(
      fetchRecentMatches("12345"),
      (error) => error instanceof OpenDotaError && error.status === 429 && error.retryAfter === "60",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("applies fixed MMR changes in chronological order and preserves the personal best", () => {
  assert.deepEqual(
    calculateRankedMmr(1000, 1100, ["WIN", "LOSS", "WIN"]),
    { estimatedMmr: 1025, personalBestMmr: 1100, deltas: [25, -25, 25] },
  );
  assert.deepEqual(
    calculateRankedMmr(10, 10, ["LOSS"]),
    { estimatedMmr: 0, personalBestMmr: 10, deltas: [-10] },
  );
});
