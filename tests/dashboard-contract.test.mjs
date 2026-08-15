import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  calculateMarketingMetrics,
  generateMarketingRecommendations,
  RACE_THRESHOLDS,
  saveDashboardData,
  validateDashboardData
} from "../dashboard.js";

const dashboard = readFileSync(new URL("../dashboard.html", import.meta.url), "utf8");
const dashboardScript = readFileSync(new URL("../dashboard.js", import.meta.url), "utf8");
const dashboardStyles = readFileSync(new URL("../dashboard.css", import.meta.url), "utf8");

test("the private dashboard follows the RACE marketing framework without loading GA tracking", () => {
  assert.match(dashboard, /Reach/);
  assert.match(dashboard, /Act/);
  assert.match(dashboard, /Convert/);
  assert.match(dashboard, /Engage/);
  assert.match(dashboard, /Dave Chaffey/);
  assert.doesNotMatch(dashboard, /googletagmanager\.com|G-M7FS6MWSKK/);
});

test("dashboard brand lets its visible name remain the accessible link name", () => {
  assert.match(dashboard, /<a class="brand" href="index\.html">/);
  assert.match(dashboard, /<b>MELA<\/b>\s+<small>GROWTH ROOM<\/small>/);
  assert.doesNotMatch(dashboard, /<a class="brand"[^>]*aria-label=/);
});

test("dashboard metrics calculate the lead-generation funnel from GA4 and CRM aggregates", () => {
  const metrics = calculateMarketingMetrics({
    sessions: 200,
    activeUsers: 160,
    returningUsers: 32,
    engagedSessions: 120,
    intakeOpened: 20,
    leads: 6,
    qualifiedLeads: 4,
    respondedWithinOneDay: 5,
    organicSessions: 100,
    referralSessions: 40,
    socialSessions: 30,
    paidSessions: 10
  });

  assert.equal(metrics.engagementRate, 0.6);
  assert.equal(metrics.ctaRate, 0.1);
  assert.equal(metrics.formCompletionRate, 0.3);
  assert.equal(metrics.leadConversionRate, 0.03);
  assert.equal(metrics.qualifiedLeadRate, 4 / 6);
  assert.equal(metrics.responseWithinOneDayRate, 5 / 6);
  assert.equal(metrics.returningUserRate, 0.2);
  assert.equal(metrics.topSource.name, "自然搜尋");
});

test("RACE recommendation thresholds are named policy settings", () => {
  assert.equal(RACE_THRESHOLDS.sourceCoverage, 0.8);
  assert.equal(RACE_THRESHOLDS.sourceConcentration, 0.75);
  assert.equal(RACE_THRESHOLDS.formCompletionRate, 0.35);
  assert.equal(RACE_THRESHOLDS.responseWithinOneDayRate, 0.8);
});

test("recommendations prioritize the tightest RACE bottleneck and give an action", () => {
  const data = {
    sessions: 240,
    activeUsers: 180,
    returningUsers: 18,
    engagedSessions: 150,
    intakeOpened: 24,
    leads: 4,
    qualifiedLeads: 3,
    respondedWithinOneDay: 4,
    organicSessions: 180,
    referralSessions: 20,
    socialSessions: 20,
    paidSessions: 20
  };
  const recommendations = generateMarketingRecommendations(data, calculateMarketingMetrics(data));

  assert.equal(recommendations.priority.stage, "Convert");
  assert.match(recommendations.priority.action, /表單/);
  assert.equal(recommendations.cards.length, 4);
  recommendations.cards.forEach((card) => assert.ok(card.action.length > 0));
});

test("zero form starts are diagnosed as an Act CTA problem, not a Convert form problem", () => {
  const data = {
    sessions: 200,
    activeUsers: 160,
    returningUsers: 32,
    engagedSessions: 130,
    intakeOpened: 0,
    leads: 0,
    qualifiedLeads: 0,
    respondedWithinOneDay: 0,
    organicSessions: 100,
    referralSessions: 60,
    socialSessions: 30,
    paidSessions: 10
  };
  const recommendations = generateMarketingRecommendations(data);
  const convertCard = recommendations.cards.find((card) => card.stage === "Convert");

  assert.equal(recommendations.priority.stage, "Act");
  assert.match(convertCard.title, /還沒有足夠表單啟動/);
  assert.doesNotMatch(convertCard.title, /有人打開表單/);
});

test("dashboard copy makes the browser-local data boundary explicit", () => {
  assert.match(dashboard, /只儲存在這台裝置/);
  assert.match(dashboard, /手動更新的本機週檢表/);
  assert.match(dashboard, /不會自動讀取 GA4/);
  assert.match(dashboard, /intake_opened/);
  assert.match(dashboard, /form_step_completed/);
  assert.match(dashboard, /lead_submit_failed/);
  assert.match(dashboard, /generate_lead/);
});

test("unentered source data stays unknown instead of becoming a false 100% channel", () => {
  const data = {
    sessions: 120,
    activeUsers: 100,
    returningUsers: 20,
    engagedSessions: 70,
    intakeOpened: 12,
    leads: 4,
    qualifiedLeads: 2,
    respondedWithinOneDay: 3
  };
  const metrics = calculateMarketingMetrics(data);
  const recommendations = generateMarketingRecommendations(data, metrics);
  const reachCard = recommendations.cards.find((card) => card.stage === "Reach");

  assert.equal(metrics.hasSourceData, false);
  assert.equal(metrics.sourceCoverage, 0);
  assert.equal(metrics.canAssessSourceMix, false);
  assert.equal(metrics.topSource.share, null);
  assert.doesNotMatch(reachCard.title, /單一入口/);
  assert.doesNotMatch(reachCard.diagnosis, /佔 100%/);
});

test("inconsistent manual aggregates are bounded and return a Plan data-quality fallback", () => {
  const inconsistentData = {
    sessions: 10,
    activeUsers: 5,
    returningUsers: 8,
    engagedSessions: 20,
    intakeOpened: 30,
    leads: 40,
    qualifiedLeads: 80,
    respondedWithinOneDay: 90,
    organicSessions: 0,
    referralSessions: 60,
    socialSessions: 0,
    paidSessions: 0
  };
  const validation = validateDashboardData(inconsistentData);
  const metrics = calculateMarketingMetrics(inconsistentData);
  const recommendations = generateMarketingRecommendations(inconsistentData, metrics);

  assert.equal(validation.isValid, false);
  assert.deepEqual(
    validation.issues.map((issue) => issue.code),
    [
      "returning-users-exceed-active-users",
      "engaged-sessions-exceed-sessions",
      "intake-opened-exceed-sessions",
      "leads-exceed-intake-opened",
      "qualified-leads-exceed-leads",
      "responded-within-one-day-exceed-leads",
      "identified-sources-exceed-sessions"
    ]
  );
  [
    metrics.engagementRate,
    metrics.ctaRate,
    metrics.formCompletionRate,
    metrics.leadConversionRate,
    metrics.qualifiedLeadRate,
    metrics.responseWithinOneDayRate,
    metrics.returningUserRate,
    ...metrics.funnel.map((step) => step.ratio)
  ].forEach((value) => assert.ok(value === null || (value >= 0 && value <= 1)));
  assert.equal(metrics.canAssessSourceMix, false);
  assert.equal(recommendations.priority.stage, "Plan");
  assert.match(recommendations.priority.title, /校正/);
});

test("dashboard storage failures are reported without throwing", () => {
  const unavailableStorage = {
    setItem() { throw new Error("Storage is unavailable"); }
  };

  assert.doesNotThrow(() => saveDashboardData({ sessions: 1 }, unavailableStorage));
  assert.equal(saveDashboardData({ sessions: 1 }, unavailableStorage).ok, false);
});

test("dashboard data panel declares its relationship and local-access boundary", () => {
  assert.match(dashboard, /data-toggle-data[^>]*aria-controls="dashboard-data-panel"[^>]*aria-expanded="false"/);
  assert.match(dashboard, /id="dashboard-data-panel"/);
  assert.match(dashboard, /本機工作區/);
  assert.match(dashboard, /共用這個瀏覽器設定檔/);
  assert.match(dashboardScript, /toggle\?\.focus\(\)/);
  assert.match(dashboard, /同一期間、去重後/);
});

test("RACE card success signals stay in a normal single-column footer", () => {
  assert.match(dashboard, /<footer data-race-target>關鍵指標：工作階段、來源集中度<\/footer>/);
  assert.match(
    dashboardStyles,
    /\.race-card footer \{[^}]*display: block;[^}]*padding: 0;[^}]*border: 0;[^}]*background: transparent;[^}]*\}/
  );
});

test("dashboard gives dynamic Chinese content room at tablet widths", () => {
  assert.match(dashboardStyles, /\.dashboard-hero > \*, \.dashboard-hero-actions, \.dataset-state \{ min-width: 0; \}/);
  assert.match(dashboardStyles, /@media \(max-width: 1180px\)/);
  assert.match(dashboardStyles, /@media \(max-width: 820px\)/);
});

test("dashboard keeps hero labels and period names readable at the narrowest width", () => {
  assert.match(dashboardStyles, /\.dataset-state b \{[^}]*white-space: normal;[^}]*overflow-wrap: anywhere;[^}]*\}/);
  assert.match(dashboardStyles, /@media \(max-width: 389px\)/);
  assert.match(dashboardStyles, /\.dashboard-hero \.eyebrow \{[^}]*white-space: normal;[^}]*\}/);
});

test("dashboard form inputs cannot exceed their responsive grid cells", () => {
  assert.match(
    dashboardStyles,
    /\.data-period input, \.input-grid input \{[^}]*box-sizing: border-box;[^}]*width: 100%;[^}]*min-width: 0;[^}]*\}/
  );
});
