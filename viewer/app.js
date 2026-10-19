(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  let generation = 0;
  let hasCards = false;
  let activeRequest = null;
  class GenerationError extends Error {}
  function setBusy(busy) {
    $("generate-button").disabled = busy;
    $("generate-button").textContent = busy ? "Making your cards…" : "Make my cards ↗";
    $("scenario-form").setAttribute("aria-busy", String(busy));
  }
  function beginAction() {
    generation++;
    if (activeRequest) activeRequest.abort();
    activeRequest = null;
    setBusy(false);
    return generation;
  }
  function showError(message, status) {
    $("error").textContent = `${message} ${hasCards ? "Your previously displayed cards are still open." : "No cards are open."}`;
    $("error").hidden = false;
    $("status").textContent = status;
  }
  function retryHint(response) {
    const value = response.headers.get("Retry-After");
    if (!value) return "Please wait a little before trying again.";
    let seconds = /^\d+$/.test(value) ? Number(value) : Math.ceil((Date.parse(value) - Date.now()) / 1000);
    if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 3600) return "Please wait a little before trying again.";
    return `Try again in about ${Math.ceil(seconds)} seconds.`;
  }
  function countScenario() {
    $("character-count").textContent = `${String($("scenario").value || "").length.toLocaleString("en-US")} / 2,000`;
  }
  function text(tag, content, className) {
    const node = document.createElement(tag);
    node.textContent = content;
    if (className) node.className = className;
    return node;
  }
  function render(result, label, context) {
    const fragment = document.createDocumentFragment();
    result.cards.forEach((card, index) => {
      const article = document.createElement("article");
      article.className = "card";
      article.setAttribute("aria-label", `Confidence card ${index + 1}`);
      article.append(text("h3", `Option 0${index + 1}`, "card-number"));
      for (const [key, label] of [["hook", "The hook"], ["anchor", "The anchor"], ["exit", "The exit"], ["mantra", "The mantra"]]) {
        const section = document.createElement("div");
        section.className = `card-part ${key}`;
        section.append(text("h4", label), text("p", card[key]));
        article.append(section);
      }
      fragment.append(article);
    });
    const references = document.createDocumentFragment();
    for (const source of result.sources) {
      const li = document.createElement("li");
      li.value = source.citation_index;
      const link = text("a", source.url);
      link.href = source.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.referrerPolicy = "no-referrer";
      link.setAttribute("aria-label", `Research reference ${source.citation_index}: ${source.url} (opens new tab)`);
      li.append(link); references.append(li);
    }
    $("cards").replaceChildren(fragment);
    $("sources").replaceChildren(references);
    $("mode").textContent = label;
    $("context").textContent = context;
    $("research").hidden = result.sources.length === 0;
    $("source-note").textContent = result.omittedSources
      ? "Some research references were omitted because their metadata was invalid, duplicated or over the viewer limit. Cards are shown unchanged."
      : result.sources.length ? "Citation numbers retain their recorded positions. Sources have not been fetched or verified." : "No usable research references are included in this response.";
    $("card-section").hidden = false;
    $("empty").hidden = true;
    $("error").hidden = true;
    hasCards = true;
  }
  function showExample() {
    beginAction();
    $("response-file").value = "";
    render(WingmanCards.parse(JSON.stringify(WingmanExample)), "Synthetic example", "Fictional scenario: meeting a new teammate about an internal tool. No research or provider call.");
    $("status").textContent = "Synthetic example loaded. Three cards ready to read.";
  }
  $("response-file").addEventListener("change", async event => {
    const file = event.target.files[0];
    if (!file) return;
    const request = beginAction();
    $("error").hidden = true;
    $("status").textContent = "Reading the selected file…";
    try {
      if (file.size > WingmanCards.MAX_BYTES) throw new Error("Choose a JSON response no larger than 1 MiB (1,048,576 bytes).");
      let raw;
      try { raw = await file.text(); }
      catch { throw new Error("The selected file could not be read. Try another saved response."); }
      if (request !== generation) return;
      const result = WingmanCards.parse(raw);
      render(result, "Saved response", `File: ${file.name}. Imported content and research references have not been verified.`);
      $("status").textContent = "Saved response loaded. Three cards ready to read.";
    } catch (error) {
      if (request !== generation) return;
      showError(error.message, "Import failed.");
    } finally {
      if (request === generation) $("response-file").value = "";
    }
  });
  $("example-button").addEventListener("click", showExample);
  $("clear-button").addEventListener("click", () => {
    beginAction();
    hasCards = false;
    $("scenario").value = "";
    countScenario();
    $("response-file").value = "";
    $("cards").replaceChildren(); $("sources").replaceChildren();
    $("card-section").hidden = true; $("research").hidden = true; $("empty").hidden = false; $("error").hidden = true;
    $("mode").textContent = "No response open";
    $("context").textContent = "Cleared from this view. Describe a new scenario or open saved cards.";
    $("source-note").textContent = "";
    $("status").textContent = "Cards cleared.";
  });
  $("scenario").addEventListener("input", countScenario);
  $("scenario-form").addEventListener("submit", async event => {
    event.preventDefault();
    const request = beginAction();
    const scenario = String($("scenario").value || "").trim();
    $("error").hidden = true;
    if (scenario.length < 10 || scenario.length > 2000) {
      showError("Describe your conversation in 10–2,000 characters.", "Check your scenario.");
      return;
    }
    const controller = new AbortController();
    activeRequest = controller;
    setBusy(true);
    $("status").textContent = hasCards ? "Making new cards. Your previous cards remain below while you wait." : "Making your cards. This may take a moment…";
    try {
      const response = await fetch("/api/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario }), signal: controller.signal,
      });
      if (request !== generation) return;
      let body;
      try { body = await response.json(); }
      catch { throw new GenerationError("The service returned an unreadable response. Please try again."); }
      if (request !== generation) return;
      if (!response.ok) {
        const message = typeof body?.error === "string" && body.error.trim()
          ? body.error.slice(0, 300) : "We couldn’t make cards right now. Please try again.";
        throw new GenerationError(response.status === 429 ? `${message} ${retryHint(response)}` : message);
      }
      let result;
      try {
        if (!body || Object.hasOwn(body, "error") || !Array.isArray(body.cards) || body.cards.length !== 3) throw new Error();
        result = WingmanCards.parse(JSON.stringify({ card1: body.cards[0], card2: body.cards[1], card3: body.cards[2] }));
      } catch { throw new GenerationError("The service did not return three complete cards. Please try again."); }
      render(result, "Generated cards", `Scenario: ${scenario}`);
      $("source-note").textContent = "AI-generated suggestions. No live web research was used; check any factual claim before using it.";
      $("status").textContent = "Three cards ready. Choose the words that feel like you.";
    } catch (error) {
      if (request !== generation) return;
      const message = error instanceof GenerationError ? error.message : "We couldn’t reach the service. Check your connection and try again.";
      showError(message, "Cards could not be generated.");
    } finally {
      if (request === generation) { activeRequest = null; setBusy(false); }
    }
  });
  countScenario();
  setBusy(false);
})();
