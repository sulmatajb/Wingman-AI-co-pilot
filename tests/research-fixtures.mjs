// Synthetic research/provider shapes only; no real conversations or credentials.
export const privateMarker = 'SYNTHETIC_PRIVATE_RESEARCH';
export const research = '  Synthetic research.\nIncludes quotes "here" and unicode café.\n  ';
export const response = content => ({ choices: [{ message: { content } }] });

export const researchFixtures = [
  { name: 'valid research preserved exactly', input: response(research), accepted: true, research },
  { name: 'valid short text is not judged for factual quality', input: response('x'), accepted: true, research: 'x' },
  { name: 'valid text with citation markers', input: response('A synthetic finding [1].\nAnother finding [2].'), accepted: true, research: 'A synthetic finding [1].\nAnother finding [2].' },
  { name: 'empty response object', input: {}, accepted: false },
  { name: 'null payload', input: null, accepted: false },
  { name: 'undefined payload', input: undefined, accepted: false },
  { name: 'array payload', input: [], accepted: false },
  { name: 'string payload', input: privateMarker, accepted: false },
  { name: 'null choices', input: { choices: null }, accepted: false },
  { name: 'empty choices', input: { choices: [] }, accepted: false },
  { name: 'object choices is not an array', input: { choices: { 0: { message: { content: privateMarker } } } }, accepted: false },
  { name: 'null first choice', input: { choices: [null] }, accepted: false },
  { name: 'missing message', input: { choices: [{}] }, accepted: false },
  { name: 'null message', input: { choices: [{ message: null }] }, accepted: false },
  { name: 'array message', input: { choices: [{ message: [] }] }, accepted: false },
  { name: 'missing content', input: { choices: [{ message: {} }] }, accepted: false },
  { name: 'empty content', input: response(''), accepted: false },
  { name: 'blank whitespace content', input: response(' \t\r\n '), accepted: false },
  { name: 'unicode whitespace content', input: response('\u00a0\u2003'), accepted: false },
  { name: 'null content', input: response(null), accepted: false },
  { name: 'object content', input: response({ detail: privateMarker }), accepted: false },
  { name: 'array content', input: response([privateMarker]), accepted: false },
  { name: 'numeric content', input: response(42), accepted: false },
  { name: 'boolean content', input: response(true), accepted: false },
  { name: 'missing first content is not repaired from a later choice', input: { choices: [{ message: {} }, { message: { content: privateMarker } }] }, accepted: false },
  { name: 'provider error output', input: { error: { message: privateMarker, request: { body: privateMarker } } }, providerError: true, accepted: false },
  { name: 'provider error overrides valid content', input: { ...response(privateMarker), error: { message: privateMarker } }, providerError: true, accepted: false },
  { name: 'provider error marker on normal branch', input: { ...response(privateMarker), error: privateMarker }, accepted: false },
  { name: 'provider type error overrides valid content', input: { ...response(privateMarker), type: 'error' }, providerError: true, accepted: false },
  { name: 'explicit null error marker overrides content', input: { ...response(privateMarker), error: null }, accepted: false },
  { name: 'malformed transport error branch', input: null, providerError: true, accepted: false },
];
