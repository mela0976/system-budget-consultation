const STORAGE_KEY = "mela-growth-room-v1";
const numberFields = [
  "sessions", "activeUsers", "returningUsers", "engagedSessions", "intakeOpened", "leads",
  "qualifiedLeads", "respondedWithinOneDay", "organicSessions", "referralSessions", "socialSessions", "paidSessions"
];
const sourceFields = ["organicSessions", "referralSessions", "socialSessions", "paidSessions"];
const sourceDefinitions = [
  { field: "organicSessions", name: "自然搜尋", tone: "blue" },
  { field: "referralSessions", name: "推薦連結", tone: "teal" },
  { field: "socialSessions", name: "社群", tone: "orange" },
  { field: "paidSessions", name: "付費推廣", tone: "purple" }
];

export const SAMPLE_DASHBOARD_DATA = Object.freeze({
  periodLabel: "示範期間｜2026/08/01–08/14",
  sessions: 184,
  activeUsers: 142,
  returningUsers: 21,
  engagedSessions: 96,
  intakeOpened: 12,
  leads: 3,
  qualifiedLeads: 2,
  respondedWithinOneDay: 2,
  organicSessions: 92,
  referralSessions: 37,
  socialSessions: 31,
  paidSessions: 0,
  isSample: true
});

const stageOrder = ["Reach", "Act", "Convert", "Engage"];
export const RACE_THRESHOLDS = Object.freeze({
  directionalSessions: 30,
  stableLearningSessions: 100,
  sourceCoverage: 0.8,
  sourceConcentration: 0.75,
  returningUserRate: 0.15,
  engagementRate: 0.55,
  ctaRate: 0.03,
  formCompletionRate: 0.35,
  leadConversionRate: 0.01,
  responseWithinOneDayRate: 0.8,
  qualifiedLeadRate: 0.4
});

const asNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const ratio = (numerator, denominator) => denominator > 0 ? numerator / denominator : null;
const boundedRatio = (numerator, denominator) => {
  const value = ratio(numerator, denominator);
  return value == null ? null : Math.min(1, Math.max(0, value));
};

const formatNumber = (value) => new Intl.NumberFormat("zh-TW").format(Math.round(value || 0));
const formatPercent = (value) => value == null ? "—" : `${(value * 100).toFixed(value * 100 >= 10 ? 0 : 1)}%`;

export function normalizeDashboardData(raw = {}, fallback = SAMPLE_DASHBOARD_DATA) {
  const normalized = { periodLabel: String(raw.periodLabel || fallback.periodLabel || "未命名期間").trim().slice(0, 48) };
  numberFields.forEach((field) => { normalized[field] = asNumber(raw[field] ?? fallback[field]); });
  normalized.isSample = raw.isSample === true;
  return normalized;
}

export function validateDashboardData(rawData = {}) {
  const data = normalizeDashboardData(rawData, rawData);
  const issues = [];
  const addIssue = (code, fields, message) => issues.push({ code, fields, message });

  if (data.returningUsers > data.activeUsers) {
    addIssue("returning-users-exceed-active-users", ["returningUsers", "activeUsers"], "回訪使用者不可高於活躍使用者。");
  }
  if (data.engagedSessions > data.sessions) {
    addIssue("engaged-sessions-exceed-sessions", ["engagedSessions", "sessions"], "互動工作階段不可高於工作階段。");
  }
  if (data.intakeOpened > data.sessions) {
    addIssue("intake-opened-exceed-sessions", ["intakeOpened", "sessions"], "開啟健檢的工作階段不可高於工作階段。");
  }
  if (data.leads > data.intakeOpened) {
    addIssue("leads-exceed-intake-opened", ["leads", "intakeOpened"], "去重後成功送出需求不可高於開啟健檢的工作階段。");
  }
  if (data.qualifiedLeads > data.leads) {
    addIssue("qualified-leads-exceed-leads", ["qualifiedLeads", "leads"], "合格名單不可高於成功送出需求。");
  }
  if (data.respondedWithinOneDay > data.leads) {
    addIssue("responded-within-one-day-exceed-leads", ["respondedWithinOneDay", "leads"], "1 個工作天內回覆的需求不可高於成功送出需求。");
  }

  const identifiedSources = sourceFields.reduce((total, field) => total + data[field], 0);
  if (identifiedSources > data.sessions) {
    addIssue("identified-sources-exceed-sessions", sourceFields.concat("sessions"), "可辨識來源工作階段合計不可高於全部工作階段。");
  }

  return { data, identifiedSources, issues, isValid: issues.length === 0 };
}

export function calculateMarketingMetrics(rawData) {
  const dataQuality = validateDashboardData(rawData);
  const { data, identifiedSources } = dataQuality;
  const hasSourceData = identifiedSources > 0;
  const sourceCoverage = data.sessions > 0 ? boundedRatio(identifiedSources, data.sessions) || 0 : null;
  const hasSourceTotalIssue = dataQuality.issues.some((issue) => issue.code === "identified-sources-exceed-sessions");
  const canAssessSourceMix = hasSourceData && !hasSourceTotalIssue && (sourceCoverage || 0) >= RACE_THRESHOLDS.sourceCoverage;
  const sourceRows = hasSourceData
    ? sourceDefinitions.map((source) => ({ ...source, value: data[source.field] }))
    : [];
  const otherSessions = hasSourceData && !hasSourceTotalIssue ? Math.max(0, data.sessions - identifiedSources) : 0;
  if (otherSessions > 0) sourceRows.push({ name: "其他／未分類", value: otherSessions, tone: "gray" });
  const rankedSources = sourceRows.filter((source) => source.name !== "其他／未分類").sort((a, b) => b.value - a.value);
  const knownTopSource = rankedSources[0] || { name: "尚未填寫", value: 0, tone: "gray" };
  const topSource = {
    ...knownTopSource,
    share: canAssessSourceMix ? boundedRatio(knownTopSource.value, data.sessions) : null
  };
  const safeFunnel = {
    sessions: data.sessions,
    engagedSessions: Math.min(data.engagedSessions, data.sessions),
    intakeOpened: Math.min(data.intakeOpened, data.sessions),
    leads: Math.min(data.leads, data.intakeOpened, data.sessions)
  };

  return {
    engagementRate: boundedRatio(data.engagedSessions, data.sessions),
    ctaRate: boundedRatio(data.intakeOpened, data.sessions),
    formCompletionRate: boundedRatio(data.leads, data.intakeOpened),
    leadConversionRate: boundedRatio(data.leads, data.sessions),
    qualifiedLeadRate: boundedRatio(data.qualifiedLeads, data.leads),
    responseWithinOneDayRate: boundedRatio(data.respondedWithinOneDay, data.leads),
    returningUserRate: boundedRatio(data.returningUsers, data.activeUsers),
    dataQuality,
    hasSourceData,
    sourceCoverage,
    canAssessSourceMix,
    topSource,
    sourceRows,
    funnel: [
      { key: "sessions", value: safeFunnel.sessions, ratio: data.sessions > 0 ? 1 : 0 },
      { key: "engagedSessions", value: safeFunnel.engagedSessions, ratio: boundedRatio(safeFunnel.engagedSessions, data.sessions) || 0 },
      { key: "intakeOpened", value: safeFunnel.intakeOpened, ratio: boundedRatio(safeFunnel.intakeOpened, data.sessions) || 0 },
      { key: "leads", value: safeFunnel.leads, ratio: boundedRatio(safeFunnel.leads, data.sessions) || 0 }
    ]
  };
}

const statusFor = (score) => score >= 3 ? "優先處理" : score >= 1 ? "持續觀察" : "目前穩定";

export function generateMarketingRecommendations(rawData, metrics = calculateMarketingMetrics(rawData)) {
  const data = normalizeDashboardData(rawData, rawData);
  if (!metrics.dataQuality.isValid) {
    const issueSummary = metrics.dataQuality.issues.map((issue) => issue.message).join(" ");
    const cards = stageOrder.map((stage) => ({
      stage,
      score: 0,
      status: "等待校正",
      title: "本段暫不下行銷結論",
      diagnosis: "漏斗數字還不能放在同一個分母下比較。",
      action: "先回到 GA4／CRM 的同一期間報表，確認這個欄位是去重後的工作階段或有效詢問，而非原始事件次數。",
      target: "成功訊號：所有漏斗比例皆能落在 0% 至 100% 之間。"
    }));
    return {
      priority: {
        stage: "Plan",
        score: 4,
        status: "先校正資料",
        title: "先校正這一期的量測口徑",
        diagnosis: `暫停 RACE 診斷：${issueSummary}`,
        action: "把每一欄改填同一期間、去重後的工作階段或有效詢問；確認後再儲存，才適合排定行銷實驗。",
        target: "成功訊號：資料通過檢查後，再比較 Reach、Act、Convert、Engage 的瓶頸。"
      },
      cards,
      isDataQualityFallback: true
    };
  }
  if (data.sessions < RACE_THRESHOLDS.directionalSessions) {
    const cards = stageOrder.map((stage) => ({
      stage,
      score: stage === "Reach" ? 4 : 0,
      status: stage === "Reach" ? "先收集樣本" : "等待樣本",
      title: stage === "Reach" ? "先讓網站有可判讀的流量" : "先不要過早下結論",
      diagnosis: stage === "Reach" ? `本期工作階段少於 ${RACE_THRESHOLDS.directionalSessions}，任何百分比都容易被少量行為放大。` : "先累積足夠的 GA4 與商機資料，再判斷這一段的真正瓶頸。",
      action: stage === "Reach" ? "本週只選一個明確受眾與一個問題型內容主題，建立固定的發布與導流節奏。" : "先完成 Reach 的基礎資料，再安排這一段的優化實驗。",
      target: "成功訊號：連續 2 週都有足以比較的流量與事件資料。"
    }));
    return { priority: cards[0], cards };
  }

  const sourceConcentration = metrics.canAssessSourceMix ? metrics.topSource.share || 0 : 0;
  const reachScore = (data.sessions < RACE_THRESHOLDS.stableLearningSessions ? 2 : 0) + (sourceConcentration > RACE_THRESHOLDS.sourceConcentration ? 2 : 0) + (!metrics.hasSourceData ? 1 : 0) + ((metrics.returningUserRate || 0) < RACE_THRESHOLDS.returningUserRate ? 1 : 0);
  const actScore = ((metrics.engagementRate || 0) < RACE_THRESHOLDS.engagementRate ? 2 : 0) + ((metrics.ctaRate || 0) < RACE_THRESHOLDS.ctaRate ? 2 : 0);
  const convertScore = (data.intakeOpened > 0 && data.leads === 0 ? 3 : 0) + (data.intakeOpened > 0 && (metrics.formCompletionRate || 0) < RACE_THRESHOLDS.formCompletionRate ? 3 : 0) + ((metrics.leadConversionRate || 0) < RACE_THRESHOLDS.leadConversionRate ? 1 : 0);
  const engageScore = (data.leads > 0 && (metrics.responseWithinOneDayRate || 0) < RACE_THRESHOLDS.responseWithinOneDayRate ? 2 : 0) + (data.leads > 0 && (metrics.qualifiedLeadRate || 0) < RACE_THRESHOLDS.qualifiedLeadRate ? 2 : 0) + ((metrics.returningUserRate || 0) < RACE_THRESHOLDS.returningUserRate ? 1 : 0);

  const cards = [
    {
      stage: "Reach", score: reachScore, status: statusFor(reachScore),
      title: !metrics.hasSourceData ? "尚未填寫來源，先補資料再決定分散投資" : !metrics.canAssessSourceMix ? "來源覆蓋不足，先補齊再比較" : sourceConcentration > RACE_THRESHOLDS.sourceConcentration ? "流量太依賴單一入口" : data.sessions < RACE_THRESHOLDS.stableLearningSessions ? "流量基礎還不足以穩定學習" : "流量基礎可開始做來源取捨",
      diagnosis: !metrics.hasSourceData
        ? "尚未填寫可辨識來源，因此無法判斷流量是否集中。"
        : !metrics.canAssessSourceMix
          ? `目前可辨識來源只覆蓋 ${formatPercent(metrics.sourceCoverage)} 的工作階段；先補齊至少 ${formatPercent(RACE_THRESHOLDS.sourceCoverage)} 的來源，再比較集中度。`
          : sourceConcentration > RACE_THRESHOLDS.sourceConcentration
        ? `${metrics.topSource.name} 佔 ${formatPercent(sourceConcentration)}，一個來源波動就可能讓詢問量明顯起伏。`
        : `本期 ${formatNumber(data.sessions)} 個工作階段；${data.sessions < RACE_THRESHOLDS.stableLearningSessions ? "先建立可重複的導流節奏，再放大投資。" : "可比較不同來源帶來的意圖品質。"}`,
      action: !metrics.hasSourceData || !metrics.canAssessSourceMix
        ? `從已確認且不含個資的來源彙總，補上同一期間的來源工作階段；覆蓋至少 ${formatPercent(RACE_THRESHOLDS.sourceCoverage)} 後，再決定是否要分散投資。`
        : sourceConcentration > RACE_THRESHOLDS.sourceConcentration
        ? "保留目前最有效來源，同時安排一個第二來源實驗：合作露出、問題型搜尋內容或專業社群，三者只選一種。"
        : "把前兩名來源各自帶來的開啟健檢率列出；下週只加碼效率較高的一個來源。",
      target: "成功訊號：前兩名來源都能帶來可追蹤的健檢開啟，而非只有瀏覽。"
    },
    {
      stage: "Act", score: actScore, status: statusFor(actScore),
      title: (metrics.ctaRate || 0) < RACE_THRESHOLDS.ctaRate ? "訪客看完，卻沒有走向需求健檢" : (metrics.engagementRate || 0) < RACE_THRESHOLDS.engagementRate ? "首頁訊息與受眾還沒對準" : "內容有把一部分訪客推向下一步",
      diagnosis: `互動率 ${formatPercent(metrics.engagementRate)}；健檢開啟率 ${formatPercent(metrics.ctaRate)}。${(metrics.ctaRate || 0) < RACE_THRESHOLDS.ctaRate ? "意圖沒有被 CTA 接住。" : "可把焦點放在最能帶動開啟的說法。"}`,
      action: (metrics.ctaRate || 0) < RACE_THRESHOLDS.ctaRate
        ? "只測一個首頁變化：把首屏主張改成「誰的哪個工作問題能改善」，並讓『開始需求健檢』成為唯一主要動作。"
        : "找出帶來最多健檢開啟的內容或來源，將它的問題描述、案例證據與 CTA 複製到其他入口。",
      target: "成功訊號：下一期健檢開啟率上升，且互動率沒有下降。"
    },
    {
      stage: "Convert", score: convertScore, status: statusFor(convertScore),
      title: data.intakeOpened === 0 ? "還沒有足夠表單啟動來判斷轉換" : data.leads === 0 ? "有人打開表單，但沒有留下有效詢問" : (metrics.formCompletionRate || 0) < RACE_THRESHOLDS.formCompletionRate ? "表單開啟後流失是最大的漏點" : "詢問漏斗正在形成可優化的基線",
      diagnosis: data.intakeOpened === 0
        ? "目前還沒有訪客開啟需求健檢；先把焦點放在首頁訊息與 CTA，再檢查表單本身。"
        : `開啟健檢 ${formatNumber(data.intakeOpened)} 次，成功送出 ${formatNumber(data.leads)} 次，完成率 ${formatPercent(metrics.formCompletionRate)}。`,
      action: data.intakeOpened === 0
        ? "先執行 Act 的 CTA 實驗：把『開始需求健檢』放在客戶問題與可得到結果之後，並清楚說明只需 2 分鐘。"
        : data.leads === 0 || (metrics.formCompletionRate || 0) < RACE_THRESHOLDS.formCompletionRate
        ? "本週只做一個表單實驗：把第一步的選項文案改得更貼近客戶說法，並確認手機上不用捲動就能看見『下一步』。"
        : "檢查高意圖來源帶來的詢問率；將成效最佳來源導向最貼近其問題的方案段落。",
      target: "成功訊號：表單完成率提高，且成功送出需求不是由重複點擊造成。"
    },
    {
      stage: "Engage", score: engageScore, status: statusFor(engageScore),
      title: data.leads > 0 && (metrics.responseWithinOneDayRate || 0) < RACE_THRESHOLDS.responseWithinOneDayRate ? "詢問進來後，回覆速度還沒穩定" : data.leads > 0 && (metrics.qualifiedLeadRate || 0) < RACE_THRESHOLDS.qualifiedLeadRate ? "詢問量存在，但合格名單比例偏低" : "跟進品質已能支撐下一輪流量投資",
      diagnosis: `合格率 ${formatPercent(metrics.qualifiedLeadRate)}；1 個工作天內回覆率 ${formatPercent(metrics.responseWithinOneDayRate)}；回訪使用者率 ${formatPercent(metrics.returningUserRate)}。`,
      action: data.leads > 0 && (metrics.responseWithinOneDayRate || 0) < RACE_THRESHOLDS.responseWithinOneDayRate
        ? "建立一個最小 SLA：新詢問先在 1 個工作天內回覆『已收到＋下一步』，再安排完整需求確認。"
        : data.leads > 0 && (metrics.qualifiedLeadRate || 0) < RACE_THRESHOLDS.qualifiedLeadRate
          ? "在健檢前加上一句範圍與預算起點，讓不適合的期待提早自我篩選。"
          : "每週挑一個已合格需求回看來源與內容，整理成可匿名使用的案例或 FAQ，累積下一次觸及的信任。",
      target: "成功訊號：所有新詢問都有首次回覆時間，並可辨識是否為合格商機。"
    }
  ];

  const priority = cards.reduce((current, card) => card.score > current.score ? card : current, cards[0]);
  return { priority, cards };
}

function getBrowserStorage() {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function loadDashboardData(storage = getBrowserStorage()) {
  try {
    if (!storage) return { ...SAMPLE_DASHBOARD_DATA };
    const stored = storage.getItem(STORAGE_KEY);
    if (!stored) return { ...SAMPLE_DASHBOARD_DATA };
    return normalizeDashboardData(JSON.parse(stored), SAMPLE_DASHBOARD_DATA);
  } catch {
    return { ...SAMPLE_DASHBOARD_DATA };
  }
}

export function saveDashboardData(data, storage = getBrowserStorage()) {
  try {
    if (!storage) return { ok: false, reason: "unavailable" };
    storage.setItem(STORAGE_KEY, JSON.stringify({ ...data, isSample: false }));
    return { ok: true };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export function clearDashboardData(storage = getBrowserStorage()) {
  try {
    if (!storage) return { ok: false, reason: "unavailable" };
    storage.removeItem(STORAGE_KEY);
    return { ok: true };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}

function fillForm(data) {
  const form = document.querySelector("[data-dashboard-form]");
  if (!form) return;
  ["periodLabel", ...numberFields].forEach((field) => {
    if (form.elements[field]) form.elements[field].value = data[field] ?? "";
  });
}

function renderFunnel(data, metrics) {
  const funnelCard = document.querySelector(".funnel-card");
  const hasDataQualityIssue = !metrics.dataQuality.isValid;
  funnelCard?.classList.toggle("is-data-quality-invalid", hasDataQualityIssue);
  const funnelValues = { sessions: data.sessions, engagedSessions: data.engagedSessions, intakeOpened: data.intakeOpened, leads: data.leads };
  document.querySelectorAll("[data-funnel-value]").forEach((element) => {
    element.textContent = hasDataQualityIssue ? "—" : formatNumber(funnelValues[element.dataset.funnelValue]);
  });
  metrics.funnel.forEach((step) => {
    const item = document.querySelector(`[data-funnel-step="${step.key === "engagedSessions" ? "engaged" : step.key === "intakeOpened" ? "opened" : step.key === "leads" ? "lead" : "sessions"}"]`);
    if (item) item.style.setProperty("--funnel-width", hasDataQualityIssue ? "0%" : `${Math.max(8, step.ratio * 100)}%`);
  });
  const largestDrop = hasDataQualityIssue
    ? "本期資料需要校正，暫不把比例當成漏斗結論。"
    : data.sessions > 0 && data.intakeOpened === 0 ? "流量尚未推進到需求健檢。" : data.intakeOpened > 0 && data.leads === 0 ? "目前最大的漏點在開啟健檢後。" : `健檢開啟率 ${formatPercent(metrics.ctaRate)}；表單完成率 ${formatPercent(metrics.formCompletionRate)}。`;
  setText("[data-funnel-summary]", largestDrop);
}

function renderRace(recommendations) {
  recommendations.cards.forEach((card) => {
    const element = document.querySelector(`[data-race-card="${card.stage}"]`);
    if (!element) return;
    element.dataset.status = card.score >= 3 ? "priority" : card.score >= 1 ? "watch" : "steady";
    setText(`[data-race-card="${card.stage}"] [data-race-status]`, card.status);
    setText(`[data-race-card="${card.stage}"] [data-race-title]`, card.title);
    setText(`[data-race-card="${card.stage}"] [data-race-diagnosis]`, card.diagnosis);
    setText(`[data-race-card="${card.stage}"] [data-race-action]`, card.action);
    setText(`[data-race-card="${card.stage}"] [data-race-target]`, card.target);
  });
  const { priority } = recommendations;
  setText("[data-priority-title]", `先處理 ${priority.stage}：${priority.title}`);
  setText("[data-priority-diagnosis]", priority.diagnosis);
  setText("[data-priority-action]", priority.action);
  setText("[data-priority-success]", priority.target);
}

function renderSources(metrics) {
  const list = document.querySelector("[data-source-list]");
  if (!list) return;
  list.replaceChildren();
  const sourceDataHasIssue = metrics.dataQuality.issues.some((issue) => issue.code === "identified-sources-exceed-sessions");
  if (!metrics.hasSourceData) {
    setText("[data-source-note]", "尚未填寫可辨識來源，因此不知道流量是否集中；請填入同一期間、已確認且不含個資的來源彙總。 ");
    return;
  }
  if (sourceDataHasIssue) {
    setText("[data-source-note]", "來源資料需要校正：可辨識來源工作階段合計不可高於全部工作階段。校正前不顯示比例或集中度結論。");
    return;
  }
  metrics.sourceRows.filter((source) => source.value > 0).forEach((source) => {
    const item = document.createElement("li");
    item.dataset.tone = source.tone;
    const label = document.createElement("div");
    const name = document.createElement("b");
    const values = document.createElement("span");
    const bar = document.createElement("i");
    const fill = document.createElement("em");
    name.textContent = source.name;
    values.textContent = `${formatNumber(source.value)}｜${formatPercent(boundedRatio(source.value, metrics.funnel[0].value))}`;
    fill.style.width = `${Math.max(4, (boundedRatio(source.value, metrics.funnel[0].value) || 0) * 100)}%`;
    label.append(name, values);
    bar.append(fill);
    item.append(label, bar);
    list.append(item);
  });
  const note = !metrics.canAssessSourceMix
    ? `目前可辨識來源覆蓋 ${formatPercent(metrics.sourceCoverage)} 的工作階段；覆蓋至少 ${formatPercent(RACE_THRESHOLDS.sourceCoverage)} 前，不判定流量集中度。`
    : `目前最大來源是「${metrics.topSource.name}」（${formatPercent(metrics.topSource.share)}）。${(metrics.topSource.share || 0) > RACE_THRESHOLDS.sourceConcentration ? "來源過度集中，值得安排第二入口實驗。" : "來源結構可開始比較哪一個帶來較高意圖。"}`;
  setText("[data-source-note]", note);
}

function renderDashboard(data) {
  const metrics = calculateMarketingMetrics(data);
  const recommendations = generateMarketingRecommendations(data, metrics);
  const hasDataQualityIssue = !metrics.dataQuality.isValid;
  const dataQualityAlert = document.querySelector("[data-data-quality-alert]");
  document.querySelector("[data-dataset-state]")?.classList.toggle("is-sample", data.isSample);
  document.querySelector("[data-dataset-state]")?.classList.toggle("has-data-quality-issue", hasDataQualityIssue);
  if (dataQualityAlert) {
    dataQualityAlert.hidden = !hasDataQualityIssue;
    dataQualityAlert.textContent = hasDataQualityIssue ? `資料待校正：${metrics.dataQuality.issues.map((issue) => issue.message).join(" ")}` : "";
  }
  setText("[data-period-label]", data.periodLabel || "未命名期間");
  document.querySelectorAll("[data-source-coverage-target]").forEach((element) => {
    element.textContent = formatPercent(RACE_THRESHOLDS.sourceCoverage);
  });
  setText("[data-dataset-detail]", hasDataQualityIssue ? "資料待校正・暫不建立行銷診斷" : data.isSample ? "示範資料，尚未連線真實 GA4" : "這台裝置已儲存的資料・未公開傳送");
  setText('[data-metric="sessions"]', formatNumber(data.sessions));
  setText('[data-metric="engagementRate"]', hasDataQualityIssue ? "—" : formatPercent(metrics.engagementRate));
  setText('[data-metric="formCompletionRate"]', hasDataQualityIssue ? "—" : formatPercent(metrics.formCompletionRate));
  setText('[data-metric="leadConversionRate"]', hasDataQualityIssue ? "—" : formatPercent(metrics.leadConversionRate));
  renderFunnel(data, metrics);
  renderRace(recommendations);
  renderSources(metrics);
  fillForm(data);
}

function initDashboard() {
  let currentData = loadDashboardData();
  const form = document.querySelector("[data-dashboard-form]");
  const panel = document.querySelector("[data-input-panel]");
  const toggle = document.querySelector("[data-toggle-data]");
  const feedback = document.querySelector("[data-form-feedback]");

  const setPanelOpen = (open) => {
    if (!panel) return;
    panel.hidden = !open;
    toggle?.setAttribute("aria-expanded", String(open));
    if (open) panel.querySelector("input")?.focus();
    else toggle?.focus();
  };

  const clearValidationState = () => {
    form?.querySelectorAll("[aria-invalid='true']").forEach((input) => input.removeAttribute("aria-invalid"));
  };

  const showValidationState = (validation) => {
    clearValidationState();
    if (validation.isValid) return true;
    const invalidFields = [...new Set(validation.issues.flatMap((issue) => issue.fields))];
    invalidFields.forEach((field) => form?.elements[field]?.setAttribute("aria-invalid", "true"));
    feedback.textContent = `尚未儲存。${validation.issues.map((issue) => issue.message).join(" ")}`;
    form?.elements[invalidFields[0]]?.focus();
    return false;
  };

  renderDashboard(currentData);
  toggle?.addEventListener("click", () => setPanelOpen(panel.hidden));
  document.querySelector("[data-close-data]")?.addEventListener("click", () => setPanelOpen(false));
  document.querySelector("[data-reset-data]")?.addEventListener("click", () => {
    const clearResult = clearDashboardData();
    currentData = { ...SAMPLE_DASHBOARD_DATA };
    renderDashboard(currentData);
    feedback.textContent = clearResult.ok
      ? "已還原示範資料；你的先前匯總數字已從這台裝置移除。"
      : "已切回示範資料，但這個瀏覽器目前無法確認是否已移除先前儲存的數字。";
  });
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form));
    const validation = validateDashboardData({ ...values, isSample: false });
    if (!showValidationState(validation)) return;
    currentData = { ...validation.data, isSample: false };
    const saveResult = saveDashboardData(currentData);
    renderDashboard(currentData);
    if (!saveResult.ok) {
      feedback.textContent = "本期數字已暫時套用，但這個瀏覽器無法儲存；重新整理後會回到前一份可用資料。";
      feedback.focus();
      return;
    }
    feedback.textContent = "已儲存在這台裝置，儀表板與本週建議已更新。";
    setPanelOpen(false);
  });
}

if (typeof document !== "undefined") initDashboard();
