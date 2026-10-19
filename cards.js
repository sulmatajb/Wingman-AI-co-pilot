(function (root) {
  "use strict";
  const MAX_BYTES = 1024 * 1024;
  const fields = ["hook", "anchor", "exit", "mantra"];
  const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
  function parse(text) {
    if (typeof text !== "string" || new TextEncoder().encode(text).length > MAX_BYTES) {
      throw new Error("Choose a JSON response no larger than 1 MiB (1,048,576 bytes).");
    }
    let value;
    try { value = JSON.parse(text); }
    catch { throw new Error("This file is not valid JSON. Open the saved response body, without Markdown fences."); }
    if (!object(value) || Object.hasOwn(value, "error") || value.success === false) {
      throw new Error("Open a successful response containing card1, card2 and card3. Error responses cannot be shown as cards.");
    }
    const cards = ["card1", "card2", "card3"].map(key => {
      if (!object(value[key])) throw new Error(`The response needs a complete ${key} object.`);
      const card = {};
      for (const field of fields) {
        if (typeof value[key][field] !== "string" || !value[key][field].trim()) {
          throw new Error(`${key}.${field} must be nonblank text. No cards were replaced.`);
        }
        card[field] = value[key][field];
      }
      return card;
    });
    const sources = [];
    let omittedSources = false;
    const seenURLs = new Set();
    const seenIndices = new Set();
    if (value.research_sources !== undefined) {
      if (!Array.isArray(value.research_sources)) omittedSources = true;
      else {
        if (value.research_sources.length > 100) omittedSources = true;
        for (const entry of value.research_sources.slice(0, 100)) {
          let valid = object(entry) && Number.isInteger(entry.citation_index) && entry.citation_index >= 1 && entry.citation_index <= 100
            && typeof entry.url === "string" && entry.url.length <= 2048
            && /^https?:\/\//i.test(entry.url) && !/[\s\u0000-\u001f\u007f\\<>"'`]/u.test(entry.url);
          if (valid) {
            try {
              const url = new URL(entry.url);
              valid = ["http:", "https:"].includes(url.protocol) && !!url.hostname && !url.username && !url.password;
            } catch { valid = false; }
          }
          if (!valid || seenURLs.has(entry.url) || seenIndices.has(entry.citation_index)) { omittedSources = true; continue; }
          seenURLs.add(entry.url); seenIndices.add(entry.citation_index);
          sources.push({ citation_index: entry.citation_index, url: entry.url });
        }
      }
    }
    return { cards, sources, omittedSources };
  }
  const api = Object.freeze({ MAX_BYTES, parse });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.WingmanCards = api;
})(globalThis);
