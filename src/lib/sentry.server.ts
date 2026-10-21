import { privateSentryEvent, validSentryDsn } from "./sentry-privacy";
let sdkPromise: Promise<typeof import("@sentry/node")> | undefined;
export async function captureServerError(error: unknown, request: Request) {
  const dsn = validSentryDsn(process.env.SENTRY_DSN);
  if (!dsn || process.env.NODE_ENV !== "production") return;
  try {
    sdkPromise ??= import("@sentry/node").then((sdk) => {
      sdk.init({
        dsn,
        environment: "production",
        sendDefaultPii: false,
        defaultIntegrations: false,
        maxBreadcrumbs: 0,
        sendClientReports: false,
        tracesSampleRate: 0,
        beforeSend: (event) =>
          privateSentryEvent(
            event,
            "server",
            typeof event.tags?.route === "string" ? event.tags.route : undefined,
          ),
      });
      return sdk;
    });
    const sdk = await sdkPromise;
    sdk.withScope((scope) => {
      scope.addEventProcessor((event) => privateSentryEvent(event, "server", request.url));
      sdk.captureException(error);
    });
    await sdk.flush(1500);
  } catch {
    /* Reporting must preserve the original response. */
  }
}
