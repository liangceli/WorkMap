"use client";

import { useEffect } from "react";
import { redirectToLoginForMissingCognitoSession } from "../../lib/auth/cognitoRedirect";

export function CognitoSessionNavigationGuard() {
  useEffect(() => {
    const redirectIfSessionIsMissing = () => {
      redirectToLoginForMissingCognitoSession();
    };
    const redirectAfterCrossTabSessionChange = (event: StorageEvent) => {
      if (event.storageArea === window.localStorage) redirectIfSessionIsMissing();
    };
    const redirectWhenVisible = () => {
      if (document.visibilityState === "visible") redirectIfSessionIsMissing();
    };

    redirectIfSessionIsMissing();
    window.addEventListener("storage", redirectAfterCrossTabSessionChange);
    window.addEventListener("focus", redirectIfSessionIsMissing);
    document.addEventListener("visibilitychange", redirectWhenVisible);

    return () => {
      window.removeEventListener("storage", redirectAfterCrossTabSessionChange);
      window.removeEventListener("focus", redirectIfSessionIsMissing);
      document.removeEventListener("visibilitychange", redirectWhenVisible);
    };
  }, []);

  return null;
}
