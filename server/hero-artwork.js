import { getHeroRenderImage } from "./opendota.js";
import { getHeroById } from "../shared/hero-catalog.js";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export class HeroArtworkError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = "HeroArtworkError";
    this.status = status;
  }
}

export async function fetchHeroArtwork(heroId, fetchImage = fetch) {
  if (!Number.isInteger(heroId) || heroId < 1) {
    throw new HeroArtworkError("Некорректный ID героя.", 400);
  }

  const hero = getHeroById(heroId);
  const portraitUrl = hero?.portrait;
  if (!hero || !portraitUrl) throw new HeroArtworkError("Изображение героя не найдено.", 404);
  const imageUrl = portraitUrl.endsWith("_full.png")
    ? portraitUrl.replace(/_full\.png$/, "_vert.jpg")
    : getHeroRenderImage(heroId);
  if (!imageUrl) throw new HeroArtworkError("Изображение героя не найдено.", 404);

  let response;
  try {
    response = await fetchImage(imageUrl, {
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    throw new HeroArtworkError(`Не удалось загрузить изображение героя: ${error.message}`);
  }
  if (!response.ok) {
    throw new HeroArtworkError(`Источник изображений вернул HTTP ${response.status}.`);
  }

  const contentType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (!contentType?.startsWith("image/")) {
    throw new HeroArtworkError("Источник вернул не графический файл.");
  }
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES) {
    throw new HeroArtworkError("Размер изображения героя недопустим.");
  }
  let buffer;
  if (response.body?.[Symbol.asyncIterator]) {
    const chunks = [];
    let totalBytes = 0;
    for await (const chunk of response.body) {
      const imageChunk = Buffer.from(chunk);
      totalBytes += imageChunk.length;
      if (totalBytes > MAX_IMAGE_BYTES) {
        throw new HeroArtworkError("Размер изображения героя недопустим.");
      }
      chunks.push(imageChunk);
    }
    buffer = Buffer.concat(chunks, totalBytes);
  } else {
    buffer = Buffer.from(await response.arrayBuffer());
  }
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) {
    throw new HeroArtworkError("Размер изображения героя недопустим.");
  }

  return { buffer, contentType };
}
