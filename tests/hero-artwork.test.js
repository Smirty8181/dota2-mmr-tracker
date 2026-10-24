import assert from "node:assert/strict";
import test from "node:test";
import { fetchHeroArtwork, HeroArtworkError } from "../server/hero-artwork.js";

test("fetches the high-resolution official hero portrait for a known catalog hero", async () => {
  let requestedUrl;
  const result = await fetchHeroArtwork(1, async (url, options) => {
    requestedUrl = url;
    assert.equal(options.redirect, "error");
    assert.ok(options.signal);
    return {
      ok: true,
      headers: { get: () => "image/jpeg; charset=binary" },
      arrayBuffer: async () => Uint8Array.from([137, 80, 78, 71]).buffer,
    };
  });

  assert.match(requestedUrl, /^https:\/\/cdn\.cloudflare\.steamstatic\.com\/apps\/dota2\/images\/heroes\/antimage_vert\.jpg$/);
  assert.equal(result.contentType, "image/jpeg");
  assert.deepEqual([...result.buffer], [137, 80, 78, 71]);
});

test("rejects invalid and unknown hero IDs before making a request", async () => {
  let requests = 0;
  const fetchImage = async () => { requests += 1; };

  await assert.rejects(fetchHeroArtwork(0, fetchImage), (error) => error instanceof HeroArtworkError && error.status === 400);
  await assert.rejects(fetchHeroArtwork(999, fetchImage), (error) => error instanceof HeroArtworkError && error.status === 404);
  assert.equal(requests, 0);
});

test("rejects non-image responses, oversized artwork, and upstream failures", async () => {
  const response = (contentType, bytes, ok = true, status = 200) => ({
    ok,
    status,
    headers: { get: () => contentType },
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  });

  await assert.rejects(
    fetchHeroArtwork(1, async () => response("text/html", Uint8Array.from([1]))),
    /не графический файл/,
  );
  await assert.rejects(
    fetchHeroArtwork(1, async () => response("image/png", new Uint8Array(8 * 1024 * 1024 + 1))),
    /Размер изображения/,
  );
  await assert.rejects(
    fetchHeroArtwork(1, async () => response("image/png", Uint8Array.from([]), false, 503)),
    /HTTP 503/,
  );
});
