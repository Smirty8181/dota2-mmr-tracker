import { HERO_CATALOG } from "../shared/hero-catalog.js";

const resources = HERO_CATALOG.flatMap((hero) => [
  { id: hero.id, name: hero.displayName, kind: "portrait", url: hero.portrait },
  { id: hero.id, name: hero.displayName, kind: "icon", url: hero.icon },
  { id: hero.id, name: hero.displayName, kind: "artwork", url: hero.artwork },
]);
const failures = [];
let nextIndex = 0;

async function checkNext() {
  while (nextIndex < resources.length) {
    const resource = resources[nextIndex];
    nextIndex += 1;
    try {
      const response = await fetch(resource.url, {
        method: "HEAD",
        signal: AbortSignal.timeout(12_000),
      });
      const contentType = response.headers.get("content-type") || "";
      if (!response.ok || !contentType.startsWith("image/")) {
        failures.push({ ...resource, status: response.status, contentType });
      }
    } catch (error) {
      failures.push({ ...resource, error: error.message });
    }
  }
}

await Promise.all(Array.from({ length: 6 }, () => checkNext()));

if (failures.length) {
  console.error(`Не прошла проверка ${failures.length} из ${resources.length} ресурсов:`);
  for (const failure of failures) console.error(failure);
  process.exitCode = 1;
} else {
  console.log(`Проверено ${resources.length} изображений ${HERO_CATALOG.length} героев; все URL доступны и отдают image/*.`);
}
