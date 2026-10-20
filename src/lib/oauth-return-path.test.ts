import { test } from "node:test";
import assert from "node:assert/strict";
import { oauthReturnPath } from "./oauth-return-path";

test("preserves consent authorization query and fragment", () => {
  assert.equal(oauthReturnPath("/.lovable/oauth/consent?authorization_id=abc#decision"), "/.lovable/oauth/consent?authorization_id=abc#decision");
});
test("rejects external, network, backslash and control-character returns", () => {
  for (const value of ["https://outside.invalid", "//outside.invalid", "/\\outside.invalid", "/\nsecret", null]) assert.equal(oauthReturnPath(value), "/");
});