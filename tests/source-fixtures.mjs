// Synthetic public examples only; no provider requests or source fetches.
import { cards } from "./response-fixtures.mjs";

export const researchText = "Synthetic research refers to [1], [3] and [6].";
export const providerResearch = (citations) => ({
  choices: [{ message: { content: researchText } }],
  ...(citations === undefined ? {} : { citations }),
});
export const coachingResponse = (extra = {}) => ({
  content: [{ type: "text", text: JSON.stringify({ ...cards, ...extra }) }],
});
export const sourceCases = [
  {
    name: "provider references survive skipped values and a duplicate",
    citations: ["https://example.com/research", null, "https://example.org/finding?q=synthetic", "https://example.com/research", "javascript:alert(1)", "http://example.net/context#section"],
    expected: [{ citation_index: 1, url: "https://example.com/research" }, { citation_index: 3, url: "https://example.org/finding?q=synthetic" }, { citation_index: 6, url: "http://example.net/context#section" }],
  },
  { name: "missing citations keep cards-only response", citations: undefined, expected: [] },
  { name: "unusable metadata does not break cards", citations: [null, 4, {}, "https://", "/relative", "https://user:password@example.com/"], expected: [] },
];
