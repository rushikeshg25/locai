import { prepareMessages, type WritingRequest } from "./prompts";
export interface WebSource {
  title: string;
  url: string;
  snippet: string;
}
export function validSource(value: unknown): value is WebSource {
  if (!value || typeof value !== "object") return false;
  const s = value as WebSource;
  if (
    typeof s.title !== "string" ||
    typeof s.snippet !== "string" ||
    typeof s.url !== "string" ||
    /[\s<>]/.test(s.url)
  )
    return false;
  try {
    const u = new URL(s.url);
    return (
      ["https:", "http:"].includes(u.protocol) && !u.username && !u.password
    );
  } catch {
    return false;
  }
}
export async function searchWeb(
  query: string,
  signal: AbortSignal,
): Promise<WebSource[]> {
  const response = await fetch(
    `/api/search?${new URLSearchParams({ q: query.trim().slice(0, 300) })}`,
    {
      signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]),
      cache: "no-store",
      credentials: "omit",
    },
  );
  if (!response.ok)
    throw new Error(
      response.status === 429
        ? "Too many searches. Wait a moment and retry."
        : "Web search is unavailable. Check the search service and retry.",
    );
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw new Error("Web search is not configured on this server.");
  const data = await response.json();
  if (!data || !Array.isArray(data.results))
    throw new Error("Search returned an invalid response.");
  const sources: WebSource[] = [];
  for (const item of data.results) {
    if (!item || typeof item !== "object") continue;
    const source = {
      title: typeof item.title === "string" ? item.title.slice(0, 100) : "",
      url: item.url,
      snippet:
        typeof item.content === "string"
          ? item.content.replace(/<[^>]*>/g, "").slice(0, 350)
          : "",
    };
    if (
      validSource(source) &&
      source.title &&
      source.snippet &&
      !sources.some((s) => s.url === source.url)
    )
      sources.push(source);
    if (sources.length === 4) break;
  }
  if (!sources.length)
    throw new Error("No usable web results. Try a more specific question.");
  return sources;
}
export function fitSearch(request: WritingRequest, sources: WebSource[]) {
  const selected = sources.slice();
  while (selected.length) {
    const next = { ...request, webSources: selected };
    try {
      return { request: next, budget: prepareMessages(next) };
    } catch {
      selected.pop();
    }
  }
  throw new Error(
    "There is not enough context space for web results. Shorten your question or remove attachments.",
  );
}
