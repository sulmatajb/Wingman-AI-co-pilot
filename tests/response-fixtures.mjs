// These scenarios are synthetic. They contain no real conversations or API output.
export const cards = {
  card1: { hook: "How did the pilot go?", anchor: "The team tested two approaches.", exit: "Can we follow up over coffee?", mantra: "I can ask one useful question." },
  card2: { hook: "What surprised you this week?", anchor: "The demo highlighted a clear tradeoff.", exit: "Let's connect after the meeting.", mantra: "I do not need every answer." },
  card3: { hook: "What are you working on next?", anchor: "The project has a concrete next step.", exit: "I will send you a short follow-up.", mantra: "Curiosity is enough to begin." },
};
const clone = (value) => JSON.parse(JSON.stringify(value));
const text = (value) => ({ content: [{ type: "text", text: value }] });
const json = (value) => text(JSON.stringify(value));
const validText = JSON.stringify(cards);
export const privateMarker = "SYNTHETIC_PROVIDER_PRIVATE_MARKER";

export const fixtures = [
  { name: "valid raw JSON", input: json(cards), expected: 200 },
  { name: "valid json code fence", input: text("```json\n" + validText + "\n```"), expected: 200 },
  { name: "valid generic code fence", input: text("```\n" + validText + "\n```"), expected: 200 },
  { name: "valid uppercase JSON code fence", input: text("  ```JSON\n" + validText + "\n```  "), expected: 200 },
  { name: "valid split text blocks", input: { content: [{ type: "text", text: validText.slice(0, 81) }, { type: "text", text: validText.slice(81) }] }, expected: 200 },
  { name: "legacy untyped text block", input: { content: [{ text: validText }] }, expected: 200 },
  { name: "invalid JSON", input: text("{" + privateMarker), expected: 500 },
  { name: "truncated JSON", input: text(validText.slice(0, -2)), expected: 500 },
  { name: "empty object", input: json({}), expected: 500, detail: "card1" },
  { name: "null root", input: json(null), expected: 500 },
  { name: "array root", input: json([]), expected: 500 },
  { name: "valid cards inside array must not be unwrapped", input: json([cards]), expected: 500 },
  { name: "string root must not be unwrapped", input: json(validText), expected: 500 },
  { name: "number root", input: json(42), expected: 500 },
  { name: "boolean root", input: json(true), expected: 500 },
  { name: "prose surrounding JSON", input: text("Here are your cards: " + validText), expected: 500 },
  { name: "multiple JSON objects", input: text(validText + "\n" + validText), expected: 500 },
  { name: "missing provider content", input: {}, expected: 500 },
  { name: "null provider payload", input: null, expected: 500 },
  { name: "empty content array", input: { content: [] }, expected: 500 },
  { name: "non-array content", input: { content: { text: validText } }, expected: 500 },
  { name: "non-string text", input: { content: [{ type: "text", text: cards }] }, expected: 500 },
  { name: "null text block", input: { content: [null] }, expected: 500 },
  { name: "unsupported content type", input: { content: [{ type: "tool_use", text: validText }] }, expected: 500 },
  { name: "provider API error", input: { type: "error", error: { message: privateMarker } }, providerError: true, expected: 500 },
  { name: "transport error output", input: { error: { message: privateMarker, request: { body: privateMarker } } }, providerError: true, expected: 500 },
  { name: "provider error alongside otherwise valid text", input: { ...json(cards), error: { message: privateMarker } }, expected: 500 },
];

for (const name of ["card1", "card2", "card3"]) {
  const missing = clone(cards);
  delete missing[name];
  fixtures.push({ name: `missing ${name}`, input: json(missing), expected: 500, detail: name });
  for (const field of ["hook", "anchor", "exit", "mantra"]) {
    const partial = clone(cards);
    delete partial[name][field];
    fixtures.push({ name: `missing ${name}.${field}`, input: json(partial), expected: 500, detail: `${name}.${field}` });
  }
}

for (const [label, value] of [["null", null], ["array", []], ["string", "wrong"], ["number", 4], ["boolean", true]]) {
  fixtures.push({ name: `wrong card type: ${label}`, input: json({ ...cards, card2: value }), expected: 500, detail: "card2" });
}
for (const [label, value] of [["null", null], ["array", []], ["object", {}], ["number", 4], ["boolean", true]]) {
  const badField = clone(cards);
  badField.card3.mantra = value;
  fixtures.push({ name: `wrong field type: ${label}`, input: json(badField), expected: 500, detail: "card3.mantra" });
}

for (const [label, value] of [["empty", ""], ["whitespace", " \n\t "]]) {
  const blank = clone(cards);
  blank.card1.hook = value;
  fixtures.push({ name: `${label} required field`, input: json(blank), expected: 500, detail: "card1.hook" });
}

const unchanged = clone(cards);
unchanged.card1.hook = "  The demo uses ```json and {braces} literally.  ";
fixtures.push({ name: "valid card text is preserved", input: json(unchanged), expected: 200, expectedBody: unchanged });
