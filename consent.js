(() => {
  "use strict";

  const CONSENT_KEY = "mela-analytics-consent-v2";
  const allowedChoices = new Set(["granted", "denied"]);
  let lastFocusedElement = null;

  function clearAnalyticsCookies() {
    if (typeof document === "undefined" || typeof document.cookie !== "string") return;
    const cookieNames = document.cookie
      .split(";")
      .map((cookie) => cookie.trim().split("=")[0])
      .filter((name) => name === "_ga" || name.startsWith("_ga_"));
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    cookieNames.forEach((name) => {
      document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax${secure}`;
    });
  }

  const readChoice = () => {
    try {
      const value = window.localStorage.getItem(CONSENT_KEY);
      return allowedChoices.has(value) ? value : "";
    } catch {
      return "";
    }
  };

  const savedChoice = readChoice();
  if (savedChoice !== "granted") clearAnalyticsCookies();
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };

  const defaultConsent = {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: savedChoice === "granted" ? "granted" : "denied"
  };
  if (!savedChoice) defaultConsent.wait_for_update = 500;

  window.gtag("consent", "default", defaultConsent);
  window.gtag("set", "ads_data_redaction", true);

  function getSafePageContext() {
    return {
      page_location: `${window.location.origin}${window.location.pathname}`,
      page_referrer: ""
    };
  }

  // `set` makes the safe page context apply to every later GA4 event, including form milestones.
  window.gtag("set", getSafePageContext());

  function trackSanitizedPageView() {
    window.gtag("event", "page_view", getSafePageContext());
  }

  function updateConsent(choice) {
    if (!allowedChoices.has(choice)) return;
    window.gtag("consent", "update", {
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: choice === "granted" ? "granted" : "denied"
    });
    if (choice === "denied") clearAnalyticsCookies();
    try {
      window.localStorage.setItem(CONSENT_KEY, choice);
    } catch {
      // Browsers that block local storage still receive the current-page consent update.
    }
    hideBanner();
  }

  function banner() {
    return document.querySelector("[data-consent-banner]");
  }

  function hideBanner() {
    const element = banner();
    if (!element) return;
    element.hidden = true;
    element.removeAttribute("data-settings-open");
    const returnFocusTo = lastFocusedElement;
    lastFocusedElement = null;
    if (returnFocusTo instanceof HTMLElement && returnFocusTo.isConnected) {
      returnFocusTo.focus();
    }
  }

  function openConsentSettings(trigger) {
    const element = banner();
    if (!element) return;
    if (trigger instanceof HTMLElement) lastFocusedElement = trigger;
    element.hidden = false;
    element.dataset.settingsOpen = "true";
    const title = element.querySelector("[data-consent-title]");
    const copy = element.querySelector("[data-consent-copy]");
    if (title) title.textContent = "調整你的分析選擇";
    if (copy) copy.textContent = "你可以隨時改為只使用必要功能，或允許分析 Cookie。未同意前，進階同意模式仍可能傳送不含 Cookie 的評估訊號；廣告相關儲存與個人化一律不會啟用。";
    const firstAction = element.querySelector('[data-consent-action="denied"]');
    if (firstAction instanceof HTMLElement) firstAction.focus();
  }

  function initializeBanner() {
    const element = banner();
    if (!element) return;
    if (!savedChoice) element.hidden = false;
    document.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const action = target?.closest("[data-consent-action]")?.dataset.consentAction;
      if (action) updateConsent(action);
      const settingsTrigger = target?.closest("[data-open-consent-settings]");
      if (settingsTrigger) openConsentSettings(settingsTrigger);
    });
  }

  window.MELA_ANALYTICS_CONSENT = Object.freeze({ updateConsent, openConsentSettings, trackSanitizedPageView });
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeBanner, { once: true });
  } else {
    initializeBanner();
  }
})();
