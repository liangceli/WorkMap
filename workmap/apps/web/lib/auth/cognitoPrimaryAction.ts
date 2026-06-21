import {
  createCognitoAccount,
  signInCognitoAccount,
  type CognitoSignInResult,
  type CognitoSignUpResult,
} from "./cognitoUserPoolAuth";

type CognitoSignUpActionResult = { action: "sign_up"; result: CognitoSignUpResult };
type CognitoSignInActionResult = { action: "sign_in"; result: CognitoSignInResult };
export type CognitoPrimaryActionResult = CognitoSignUpActionResult | CognitoSignInActionResult;

type CognitoPrimaryActionDependencies = {
  createAccount: typeof createCognitoAccount;
  signIn: typeof signInCognitoAccount;
};

const defaultDependencies: CognitoPrimaryActionDependencies = {
  createAccount: createCognitoAccount,
  signIn: signInCognitoAccount,
};

export function runCognitoPrimaryAction(
  action: "sign_up",
  input: { email: string; password: string; displayName?: string },
  dependencies?: CognitoPrimaryActionDependencies,
): Promise<CognitoSignUpActionResult>;
export function runCognitoPrimaryAction(
  action: "sign_in",
  input: { email: string; password: string; displayName?: string },
  dependencies?: CognitoPrimaryActionDependencies,
): Promise<CognitoSignInActionResult>;
export async function runCognitoPrimaryAction(
  action: "sign_up" | "sign_in",
  input: { email: string; password: string; displayName?: string },
  dependencies: CognitoPrimaryActionDependencies = defaultDependencies,
): Promise<CognitoPrimaryActionResult> {
  if (action === "sign_up") {
    return {
      action,
      result: await dependencies.createAccount({
        email: input.email,
        password: input.password,
        displayName: input.displayName ?? "",
      }),
    };
  }

  return {
    action,
    result: await dependencies.signIn(input.email, input.password),
  };
}
