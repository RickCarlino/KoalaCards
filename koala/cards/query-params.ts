export type CardsQueryParams = {
  sortBy: string;
  sortOrder: "asc" | "desc";
  page: number;
  q: string;
  paused: boolean;
  deckId: number | null;
};

type ParseCardsQueryParamsOptions = {
  allowedSortValues: string[];
  defaultSortBy: string;
  defaultSortOrder: "asc" | "desc";
  defaultPage: number;
};

function firstQueryValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value[0];
  }
  return undefined;
}

function parsePositiveInteger(value: string | undefined): number | null {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function resolveSortBy(
  rawSortBy: string | undefined,
  allowedSortValues: string[],
  defaultSortBy: string,
): string {
  if (rawSortBy && allowedSortValues.includes(rawSortBy)) {
    return rawSortBy;
  }
  return defaultSortBy;
}

function resolveSortOrder(
  rawSortOrder: string | undefined,
  defaultSortOrder: "asc" | "desc",
): "asc" | "desc" {
  if (rawSortOrder === "asc") {
    return "asc";
  }
  return defaultSortOrder;
}

export function parseCardsQueryParams(
  query: Record<string, unknown>,
  options: ParseCardsQueryParamsOptions,
): CardsQueryParams {
  const sortBy = resolveSortBy(
    firstQueryValue(query.sortBy),
    options.allowedSortValues,
    options.defaultSortBy,
  );
  const sortOrder = resolveSortOrder(
    firstQueryValue(query.sortOrder),
    options.defaultSortOrder,
  );
  const page =
    parsePositiveInteger(firstQueryValue(query.page)) ??
    options.defaultPage;
  const deckId =
    parsePositiveInteger(firstQueryValue(query.deckId)) ??
    parsePositiveInteger(firstQueryValue(query.deck_id));

  return {
    sortBy,
    sortOrder,
    page,
    q: firstQueryValue(query.q) ?? "",
    paused: firstQueryValue(query.paused) === "true",
    deckId,
  };
}
