import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const consent = readFileSync(new URL("../consent.js", import.meta.url), "utf8");
const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const privacy = readFileSync(new URL("../privacy.html", import.meta.url), "utf8");

test("Consent Mode defaults are established before GA4 configuration on every public page", () => {
  for (const page of [index, privacy]) {
    const consentScript = page.indexOf('src="consent.js?v=20260815-2"');
    const tagScript = page.indexOf("googletagmanager.com/gtag/js?id=G-M7FS6MWSKK");
    const configCall = page.indexOf('window.gtag("config", "G-M7FS6MWSKK"');
    assert.ok(consentScript >= 0);
    assert.ok(consentScript < tagScript);
    assert.ok(tagScript < configCall);
  }
  assert.match(consent, /gtag\("consent", "default", defaultConsent\)/);
  assert.match(consent, /ad_storage: "denied"/);
  assert.match(consent, /ad_user_data: "denied"/);
  assert.match(consent, /ad_personalization: "denied"/);
  assert.match(consent, /analytics_storage: savedChoice === "granted" \? "granted" : "denied"/);
});

test("GA4 page views are explicitly sent with a URL and referrer that cannot contain form data", () => {
  for (const page of [index, privacy]) {
    const configCall = page.indexOf('window.gtag("config", "G-M7FS6MWSKK"');
    const pageViewCall = page.indexOf("window.MELA_ANALYTICS_CONSENT.trackSanitizedPageView();");
    assert.match(page, /send_page_view: false/);
    assert.ok(configCall >= 0);
    assert.ok(configCall < pageViewCall);
  }
  assert.match(consent, /function trackSanitizedPageView\(\)/);
  assert.match(consent, /window\.location\.origin/);
  assert.match(consent, /window\.location\.pathname/);
  assert.match(consent, /page_location: safePageLocation/);
  assert.match(consent, /page_referrer: ""/);
  for (const source of [consent, index, privacy]) {
    assert.doesNotMatch(source, /window\.location\.href|document\.referrer/);
  }
});

test("accepting analytics never enables advertising storage and can be revoked", () => {
  assert.match(consent, /function updateConsent\(choice\)/);
  assert.match(consent, /analytics_storage: choice === "granted" \? "granted" : "denied"/);
  assert.match(consent, /ad_storage: "denied"/);
  assert.match(consent, /ad_user_data: "denied"/);
  assert.match(consent, /ad_personalization: "denied"/);
  assert.match(consent, /localStorage\.setItem\(CONSENT_KEY, choice\)/);
  assert.match(consent, /data-open-consent-settings/);
});

test("visitors receive a visible choice and the privacy notice describes Consent Mode", () => {
  for (const page of [index, privacy]) {
    assert.match(page, /data-consent-banner/);
    assert.match(page, /role="region"/);
    assert.match(page, /aria-label="網站分析與隱私設定"/);
    assert.match(page, /aria-live="polite"/);
    assert.doesNotMatch(page, /role="dialog"/);
    assert.match(page, /data-consent-action="denied"/);
    assert.match(page, /data-consent-action="granted"/);
  }
  assert.match(index, /data-open-consent-settings/);
  assert.match(consent, /lastFocusedElement/);
  assert.match(consent, /focus\(\)/);
  assert.match(privacy, /Google Consent Mode/);
  assert.match(privacy, /analytics_storage/);
  assert.match(privacy, /進階同意聲明模式/);
  assert.match(privacy, /不含 Cookie 的評估訊號/);
});
