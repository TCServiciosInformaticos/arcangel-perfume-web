import { createIsomorphicFn } from "@tanstack/react-start";
// The compiler removes these bodies from SSR. Without a DSN, no browser SDK chunk is loaded.
export const initBrowserMonitoring = createIsomorphicFn().client(async () => {
  if (!import.meta.env.PROD || !import.meta.env.VITE_SENTRY_DSN) return;
  try {
    const sdk = await import("./sentry.client");
    sdk.initBrowserMonitoring();
  } catch {
    /* fail open */
  }
});
export const captureBrowserError = createIsomorphicFn().client(async (error: unknown) => {
  if (!import.meta.env.PROD || !import.meta.env.VITE_SENTRY_DSN) return;
  try {
    const sdk = await import("./sentry.client");
    sdk.captureBrowserError(error);
  } catch {
    /* fail open */
  }
});
