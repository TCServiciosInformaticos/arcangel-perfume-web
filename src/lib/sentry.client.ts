import * as Sentry from "@sentry/browser";
import { privateSentryEvent, validSentryDsn } from "./sentry-privacy";
let initialized = false;
export function initBrowserMonitoring() {
  if (typeof window === "undefined" || initialized) return;
  const dsn = validSentryDsn(import.meta.env.VITE_SENTRY_DSN);
  if (!dsn || !import.meta.env.PROD) return;
  try {
    Sentry.init({
      dsn,
      environment: "production",
      sendDefaultPii: false,
      defaultIntegrations: false,
      integrations: [
        Sentry.globalHandlersIntegration(),
        Sentry.browserApiErrorsIntegration(),
        Sentry.dedupeIntegration(),
      ],
      maxBreadcrumbs: 0,
      sendClientReports: false,
      tracesSampleRate: 0,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
      beforeSend: (event) => privateSentryEvent(event, "browser", window.location.pathname),
    });
    initialized = true;
  } catch {
    /* Monitoring must not prevent shopping. */
  }
}
export function captureBrowserError(error: unknown) {
  initBrowserMonitoring();
  if (!initialized) return;
  try {
    Sentry.captureException(error);
  } catch {
    /* fail open */
  }
}
