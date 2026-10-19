// Runs exported Code/If/Respond logic with synthetic provider payloads only.
import { executeResearchPath } from "./research-harness.mjs";
import { executeResponsePath, workflowSha256 } from "./workflow-harness.mjs";
import { providerResearch, coachingResponse, sourceCases } from "./source-fixtures.mjs";

const cases = sourceCases.map(({ name, citations }) => {
  const research = executeResearchPath(providerResearch(citations));
  const response = executeResponsePath(coachingResponse({ research_sources: [{ citation_index: 99, url: "https://example.com/model-invented" }] }), { researchResult: research.processed });
  return {
    name,
    input_citations: citations ?? null,
    research_path: research.path,
    prepared_sources: research.processed.research_sources ?? null,
    response_path: response.path,
    response: response.response,
  };
});
console.log(JSON.stringify({
  synthetic: true,
  workflow_sha256: workflowSha256,
  provider_requests_executed: 0,
  source_fetches: 0,
  scope: "Provider research references only, not verified support for individual cards. Minimal exported-code evaluator; no live n8n execution.",
  cases,
}, null, 2));
