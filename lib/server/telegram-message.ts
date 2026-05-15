interface TelegramMessageEntity {
  type?: string;
  offset?: number;
  length?: number;
  url?: string;
}

const URL_CANDIDATE_PATTERN = /\bhttps?:\/\/[^\s<>"'`]+/gi;

export function extractFirstLinkFromText(text: string, entities: TelegramMessageEntity[] | undefined): string | null {
  if (!text.trim()) {
    return null;
  }

  const entityUrl = extractEntityUrl(text, entities);
  if (entityUrl) {
    return entityUrl;
  }

  const rawMatch = text.match(URL_CANDIDATE_PATTERN);
  return rawMatch?.[0] ?? null;
}

function extractEntityUrl(text: string, entities: TelegramMessageEntity[] | undefined): string | null {
  if (!entities?.length) {
    return null;
  }

  const sortedEntities = [...entities]
    .filter((entity) => entity.type === "url" || entity.type === "text_link")
    .filter((entity) => typeof entity.offset === "number" && typeof entity.length === "number")
    .sort((left, right) => (left.offset ?? 0) - (right.offset ?? 0));

  for (const entity of sortedEntities) {
    if (entity.type === "text_link" && entity.url) {
      return entity.url;
    }
    if (entity.type === "url" && typeof entity.offset === "number" && typeof entity.length === "number") {
      const candidate = text.slice(entity.offset, entity.offset + entity.length);
      if (candidate) {
        return candidate;
      }
    }
  }

  return null;
}
