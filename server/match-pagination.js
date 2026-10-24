export const MAX_MATCH_PAGE_SIZE = 100;

export function parseMatchPagination(query) {
  const requestedLimit = query.limit == null ? 30 : Number(query.limit);
  const offset = query.offset == null ? 0 : Number(query.offset);
  if (!Number.isSafeInteger(requestedLimit) || requestedLimit < 1) {
    return { error: "Размер страницы должен быть положительным целым числом." };
  }
  if (!Number.isSafeInteger(offset) || offset < 0) {
    return { error: "Смещение списка матчей должно быть неотрицательным целым числом." };
  }
  return {
    limit: Math.min(MAX_MATCH_PAGE_SIZE, requestedLimit),
    offset,
  };
}
