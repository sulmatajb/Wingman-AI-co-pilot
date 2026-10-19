(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  let generation = 0;
  let hasCards = false;
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
    generation++;
    $("response-file").value = "";
    render(WingmanCards.parse(JSON.stringify(WingmanExample)), "Synthetic example", "Fictional scenario: meeting a new teammate about an internal tool. No research or provider call.");
    $("status").textContent = "Synthetic example loaded. Three cards ready to read.";
  }
  $("response-file").addEventListener("change", async event => {
    const file = event.target.files[0];
    if (!file) return;
    const request = ++generation;
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
      $("error").textContent = `${error.message} ${hasCards ? "Your previously displayed cards are still open." : "No cards are open."}`;
      $("error").hidden = false;
      $("status").textContent = "Import failed.";
    } finally {
      if (request === generation) $("response-file").value = "";
    }
  });
  $("example-button").addEventListener("click", showExample);
  $("clear-button").addEventListener("click", () => {
    generation++;
    hasCards = false;
    $("response-file").value = "";
    $("cards").replaceChildren(); $("sources").replaceChildren();
    $("card-section").hidden = true; $("research").hidden = true; $("empty").hidden = false; $("error").hidden = true;
    $("mode").textContent = "No response open";
    $("context").textContent = "Cleared from this view. Your original file is unchanged.";
    $("source-note").textContent = "";
    $("status").textContent = "Cards cleared.";
  });
  showExample();
})();
