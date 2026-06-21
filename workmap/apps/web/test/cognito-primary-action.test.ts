import assert from "node:assert/strict";
import test from "node:test";
import { formatCognitoAuthError } from "../lib/auth/cognitoUserPoolAuth";
import { runCognitoPrimaryAction } from "../lib/auth/cognitoPrimaryAction";

test("create-account action calls sign-up without calling sign-in", async () => {
  let signUpCalls = 0;
  let signInCalls = 0;

  const submission = await runCognitoPrimaryAction(
    "sign_up",
    { email: "invited@example.com", password: "Password123!", displayName: "Invited User" },
    {
      createAccount: async () => {
        signUpCalls += 1;
        return { complete: false, destination: "i***@example.com" };
      },
      signIn: async () => {
        signInCalls += 1;
        throw new Error("sign-in must not run during account creation");
      },
    },
  );

  assert.equal(submission.action, "sign_up");
  assert.equal(signUpCalls, 1);
  assert.equal(signInCalls, 0);
});

test("Cognito registration denial is not presented as a password error", () => {
  const error = new Error("SignUp is not permitted for this user pool");
  error.name = "NotAuthorizedException";

  assert.match(formatCognitoAuthError(error, "sign_up"), /self-service sign-up/i);
  assert.equal(formatCognitoAuthError(error, "sign_in"), "Email or password is incorrect.");
});

test("Cognito browser client secret failure has a registration-specific error", () => {
  const error = new Error("Unable to verify secret hash for client");
  error.name = "NotAuthorizedException";

  assert.match(formatCognitoAuthError(error, "sign_up"), /without a client secret/i);
});
