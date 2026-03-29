import assert from "node:assert/strict";
import { createSafeReturnToResolver } from "./safeReturnTo.ts";

const CANONICAL_APP_URL = "https://aetheria-build-flow.com";
const getSafeReturnTo = createSafeReturnToResolver(CANONICAL_APP_URL);

function testReturnTo(input: string | undefined, expected: string) {
  const result = getSafeReturnTo(input);
  console.log(`INPUT: ${String(input)}`);
  console.log(`OUTPUT: ${result}`);
  console.log("-----");
  assert.equal(result, expected);
}

testReturnTo("/dashboard", `${CANONICAL_APP_URL}/dashboard`);
testReturnTo("https://aetheria-build-flow.com/settings", `${CANONICAL_APP_URL}/settings`);
testReturnTo("https://evil.com", CANONICAL_APP_URL);
testReturnTo("//evil.com", CANONICAL_APP_URL);
testReturnTo("http:evil.com", CANONICAL_APP_URL);
testReturnTo("javascript:alert(1)", CANONICAL_APP_URL);
testReturnTo("%2F%2Fevil.com", CANONICAL_APP_URL);
testReturnTo("%252F%252Fevil.com", CANONICAL_APP_URL);
testReturnTo("not a url", CANONICAL_APP_URL);
testReturnTo(undefined, CANONICAL_APP_URL);

console.log("safeReturnTo validation passed");
