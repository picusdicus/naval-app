/**
 * src/lib/useUmami.js
 *
 * Custom hook for sending custom events to Umami Analytics.
 * Umami injects a global `window.umami` object via its script tag.
 * This hook wraps it so:
 *  1. TypeScript / IDE gets proper types via JSDoc
 *  2. Events silently no-op if Umami hasn't loaded (dev without .env, ad-blockers, etc.)
 *  3. You have a consistent API across the app
 *
 * Usage:
 *   const { trackEvent } = useUmami();
 *   trackEvent("chat_question");
 *   trackEvent("business_search", { query: "panaderia", results: 3 });
 *   trackEvent("event_click", { eventId: "123", eventName: "Feria Medieval" });
 */

/**
 * @typedef {Object} UmamiHook
 * @property {(eventName: string, data?: Record<string, string | number | boolean>) => void} trackEvent
 */

/**
 * @returns {UmamiHook}
 */
export function useUmami() {
  /**
   * Track a custom event.
   * @param {string} eventName  — snake_case event name (e.g. "chat_question")
   * @param {Record<string, string | number | boolean>} [data]  — optional properties
   */
  function trackEvent(eventName, data) {
    try {
      if (typeof window !== "undefined" && typeof window.umami?.track === "function") {
        if (data) {
          window.umami.track(eventName, data);
        } else {
          window.umami.track(eventName);
        }
      }
    } catch (err) {
      // Never let analytics errors break the UI
      console.warn("[useUmami] track error:", err);
    }
  }

  return { trackEvent };
}

/**
 * Standalone utility (no hook, usable outside React components).
 * Same behaviour as trackEvent from useUmami().
 *
 * @param {string} eventName
 * @param {Record<string, string | number | boolean>} [data]
 */
export function trackUmamiEvent(eventName, data) {
  try {
    if (typeof window !== "undefined" && typeof window.umami?.track === "function") {
      data ? window.umami.track(eventName, data) : window.umami.track(eventName);
    }
  } catch (err) {
    console.warn("[trackUmamiEvent] error:", err);
  }
}