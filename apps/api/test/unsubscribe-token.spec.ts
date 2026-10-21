import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { UnsubscribeToken } from "../src/consents/unsubscribe-token";

describe("revoke-only unsubscribe capability", () => {
  it("issues independent 256-bit canonical capabilities and stable non-reversible lookup hashes", () => {
    const tokens = Array.from({ length: 16 }, () => UnsubscribeToken.create());
    assert.equal(new Set(tokens.map(({ token }) => token)).size, tokens.length);
    for (const { token, hash } of tokens) {
      assert.equal(Buffer.from(token, "base64url").byteLength, 32);
      assert.equal(UnsubscribeToken.valid(token), true);
      assert.match(hash, /^[a-f0-9]{64}$/);
      assert.equal(UnsubscribeToken.hash(token), hash);
      assert.notEqual(hash, token);
    }
  });

  it("rejects malformed, non-canonical, padded and hash-shaped input before lookup", () => {
    const { token, hash } = UnsubscribeToken.create();
    for (const invalid of [
      "",
      token.slice(1),
      token + "x",
      token + "=",
      " " + token,
      token + "\n",
      hash,
      "person@example.test",
      "A".repeat(42) + "B",
    ])
      assert.equal(UnsubscribeToken.valid(invalid), false, invalid);
  });

  it("does not embed an account, recipient, session or expiry in the capability", () => {
    const { token } = UnsubscribeToken.create();
    assert.equal(token.includes("."), false, "A capability is not a JWT");
    assert.equal(UnsubscribeToken.valid(token), true);
    assert.equal(token.length, 43);
  });
});
