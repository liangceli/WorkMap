import assert from "node:assert/strict";
import test from "node:test";
import { protectCredential, unprotectCredential } from "../src/credentialVault.js";
import { readFile } from "node:fs/promises";

test("device credential is encrypted with a non-extractable AES-GCM key", async () => {
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  const credential = "wmdev_test_credential";
  const protectedCredential = await protectCredential(credential, key);

  assert.equal(protectedCredential.credentialVersion, 1);
  assert(!JSON.stringify(protectedCredential).includes(credential));
  assert.equal(await unprotectCredential(protectedCredential, key), credential);
  assert.equal(key.extractable, false);
});

test("pairing flow persists the encrypted envelope instead of a plaintext device credential", async () => {
  const optionsSource = await readFile(new URL("../src/options.ts", import.meta.url), "utf8");
  const storageSource = await readFile(new URL("../src/extensionStorage.ts", import.meta.url), "utf8");
  assert.match(optionsSource, /savePairedConfig/);
  assert.doesNotMatch(optionsSource, /workmapConfig:\s*\{[^}]*credential/);
  assert.match(storageSource, /if \(config\.credential\)/);
  assert.match(storageSource, /await savePairedConfig\(runtimeConfig\)/);
});
