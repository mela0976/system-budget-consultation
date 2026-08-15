import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const privacy = readFileSync(new URL("../privacy.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");

const measurementId = "G-M7FS6MWSKK";

test("GA4 is loaded with the configured measurement ID on public pages", () => {
  for (const page of [index, privacy]) {
    assert.match(page, new RegExp(`googletagmanager\\.com/gtag/js\\?id=${measurementId}`));
    assert.match(page, new RegExp(`gtag\\("config", "${measurementId}", \\{[\\s\\S]*allow_google_signals: false,[\\s\\S]*allow_ad_personalization_signals: false[\\s\\S]*\\}\\)`));
    assert.doesNotMatch(page, /15441820831/);
  }
});

test("lead-form analytics tracks only anonymous milestones", () => {
  assert.match(app, /const trackAnalyticsEvent = \(name, parameters = \{\}\) =>/);
  assert.match(app, /trackAnalyticsEvent\("intake_opened", \{ source, selected_budget:/);
  assert.match(app, /trackAnalyticsEvent\("generate_lead", \{ form_name: "需求健檢" \}\)/);
  assert.ok(app.indexOf('trackAnalyticsEvent("generate_lead"') > app.indexOf('if (status === "error")'));
  const eventCalls = app.match(/trackAnalyticsEvent\("[^;]+?\);/g) || [];
  eventCalls.forEach((eventCall) => {
    assert.doesNotMatch(eventCall, /\b(?:email|phone|lineId|company|message)\b/i);
  });
});

test("privacy notice discloses Google Analytics usage", () => {
  assert.match(privacy, /Google Analytics 4/);
  assert.match(privacy, /不會將表單中的姓名、Email、電話、LINE ID 或需求內容傳送至 Google Analytics/);
  assert.match(privacy, /Cookie 或類似識別碼/);
  assert.match(privacy, /https:\/\/support\.google\.com\/analytics\/answer\/181881/);
});
