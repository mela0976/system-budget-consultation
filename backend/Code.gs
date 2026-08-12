const PROP = PropertiesService.getScriptProperties();
const LINE_PUSH_URL = 'https://api.line.me/v2/bot/message/push';
const LINE_REPLY_URL = 'https://api.line.me/v2/bot/message/reply';

function doGet() {
  return HtmlService.createHtmlOutput('MELA inquiry service is running.');
}

function doPost(e) {
  try {
    const contentType = String(e.postData && e.postData.type || '');
    if (contentType.indexOf('application/json') !== -1) {
      return handleLineWebhook_(e);
    }
    return handleInquiry_(e);
  } catch (error) {
    console.error(error.stack || error);
    const leadId = clean_(e && e.parameter && e.parameter.leadId, 80);
    return htmlResponse_('error', '系統暫時無法送出，請稍後再試。', leadId);
  }
}

function handleInquiry_(e) {
  const data = normalizeForm_(e);
  validateInquiry_(data);

  const cache = CacheService.getScriptCache();
  const rateKey = 'lead:' + digest_((data.email || data.phone || data.lineId || data.name).toLowerCase());
  const count = Number(cache.get(rateKey) || 0);
  if (count >= 4) throw new Error('短時間內送出次數過多，請稍後再試。');
  cache.put(rateKey, String(count + 1), 600);

  appendToSheet_(data);

  const deliveryErrors = [];
  try { sendEmail_(data); } catch (error) { deliveryErrors.push('Gmail: ' + error.message); }
  try { sendLine_(data); } catch (error) { deliveryErrors.push('LINE: ' + error.message); }

  if (deliveryErrors.length === 2) {
    throw new Error('通知服務尚未完成設定。');
  }
  if (deliveryErrors.length) console.warn(deliveryErrors.join(' | '));

  return htmlResponse_('success', '需求已送出。', data.leadId);
}

function normalizeForm_(e) {
  const p = e.parameter || {};
  const ps = e.parameters || {};
  return {
    leadId: clean_(p.leadId, 80),
    receivedAt: Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss'),
    primaryNeed: clean_(p.primaryNeed, 100),
    currentStage: clean_(p.currentStage, 100),
    timeline: clean_(p.timeline, 60),
    budget: clean_(p.budget, 60),
    features: (ps.features || []).map(value => clean_(value, 60)).filter(Boolean).join('、'),
    name: clean_(p.name, 50),
    company: clean_(p.company, 80),
    email: clean_(p.email, 120),
    phone: clean_(p.phone, 30),
    lineId: clean_(p.lineId, 80),
    preferredContact: clean_(p.preferredContact, 20),
    message: clean_(p.message, 1200),
    consent: clean_(p.consent, 10),
    source: clean_(p.source, 30),
    pageUrl: clean_(p.pageUrl, 500),
    referrer: clean_(p.referrer, 500),
    formStartedAt: Number(p.formStartedAt || 0),
    honeypot: clean_(p.companyWebsite, 200)
  };
}

function validateInquiry_(data) {
  if (data.honeypot) throw new Error('Invalid request.');
  if (!data.formStartedAt || Date.now() - data.formStartedAt < 2500) throw new Error('送出速度過快，請重新確認表單。');
  if (!data.name || !data.primaryNeed || !data.currentStage || !data.timeline || !data.budget) throw new Error('必填欄位不完整。');
  if (!data.email && !data.phone && !data.lineId) throw new Error('請至少留下 Email、電話或 LINE ID。');
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) throw new Error('Email 格式不正確。');
  if (data.consent !== 'yes') throw new Error('需要同意資料使用說明。');
}

function sendEmail_(data) {
  const notifyEmail = PROP.getProperty('NOTIFY_EMAIL');
  if (!notifyEmail) throw new Error('NOTIFY_EMAIL 未設定');

  const subject = '[新系統詢問] ' + data.budget + '｜' + data.name + (data.company ? '｜' + data.company : '');
  const rows = [
    ['收到時間', data.receivedAt], ['主要需求', data.primaryNeed], ['目前狀況', data.currentStage],
    ['希望時程', data.timeline], ['預算', data.budget], ['功能', data.features || '未勾選'],
    ['姓名', data.name], ['公司／品牌', data.company || '未填'], ['Email', data.email || '未填'],
    ['電話', data.phone || '未填'], ['LINE ID', data.lineId || '未填'], ['偏好聯絡', data.preferredContact],
    ['補充說明', data.message || '未填'], ['Lead ID', data.leadId]
  ];
  const htmlRows = rows.map(row => '<tr><th style="padding:9px 12px;text-align:left;border-bottom:1px solid #e5e7eb;background:#f8fafc;width:110px">' + html_(row[0]) + '</th><td style="padding:9px 12px;border-bottom:1px solid #e5e7eb">' + html_(row[1]).replace(/\n/g, '<br>') + '</td></tr>').join('');
  const htmlBody = '<div style="font-family:Arial,sans-serif;color:#172033;max-width:680px"><div style="padding:20px 24px;background:#2448e8;color:white"><div style="font-size:12px;letter-spacing:.08em">MELA INQUIRY</div><h1 style="margin:6px 0 0;font-size:24px">收到新的系統需求</h1></div><table style="width:100%;border-collapse:collapse;font-size:14px">' + htmlRows + '</table></div>';
  const plainBody = rows.map(row => row[0] + '：' + row[1]).join('\n');

  MailApp.sendEmail({
    to: notifyEmail,
    subject: subject,
    body: plainBody,
    htmlBody: htmlBody,
    replyTo: data.email || notifyEmail,
    name: 'MELA 系統需求健檢'
  });
}

function sendLine_(data) {
  const token = PROP.getProperty('LINE_CHANNEL_ACCESS_TOKEN');
  const userId = PROP.getProperty('LINE_USER_ID');
  if (!token) throw new Error('LINE_CHANNEL_ACCESS_TOKEN 未設定');
  if (!userId) throw new Error('LINE_USER_ID 尚未綁定');

  const text = [
    '【新的系統需求】',
    data.name + (data.company ? '｜' + data.company : ''),
    '需求：' + data.primaryNeed,
    '預算：' + data.budget,
    '時程：' + data.timeline,
    '偏好：' + data.preferredContact,
    data.email ? 'Email：' + data.email : '',
    data.phone ? '電話：' + data.phone : '',
    data.lineId ? 'LINE ID：' + data.lineId : '',
    data.message ? '說明：' + data.message.slice(0, 500) : ''
  ].filter(Boolean).join('\n');

  lineRequest_(LINE_PUSH_URL, token, { to: userId, messages: [{ type: 'text', text: text.slice(0, 1800) }] });
}

function handleLineWebhook_(e) {
  const payload = JSON.parse(e.postData.contents || '{}');
  const token = PROP.getProperty('LINE_CHANNEL_ACCESS_TOKEN');
  (payload.events || []).forEach(event => {
    const userId = event.source && event.source.userId;
    const text = event.message && event.message.type === 'text' ? event.message.text.trim() : '';
    if (!userId || text !== '綁定通知') return;
    PROP.setProperty('LINE_USER_ID', userId);
    if (token && event.replyToken) {
      lineRequest_(LINE_REPLY_URL, token, { replyToken: event.replyToken, messages: [{ type: 'text', text: '已綁定 MELA 網站詢問通知。之後有新表單時，會傳訊息到這裡。' }] });
    }
  });
  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}

function lineRequest_(url, token, payload) {
  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  const code = response.getResponseCode();
  if (code < 200 || code >= 300) throw new Error('LINE API ' + code + ': ' + response.getContentText().slice(0, 250));
}

function appendToSheet_(data) {
  const sheetId = PROP.getProperty('SHEET_ID');
  if (!sheetId) return;
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = SpreadsheetApp.openById(sheetId).getSheets()[0];
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['收到時間','Lead ID','主要需求','目前狀況','時程','預算','功能','姓名','公司','Email','電話','LINE ID','偏好聯絡','說明','來源頁面']);
    }
    sheet.appendRow([data.receivedAt,data.leadId,data.primaryNeed,data.currentStage,data.timeline,data.budget,data.features,data.name,data.company,data.email,data.phone,data.lineId,data.preferredContact,data.message,data.pageUrl]);
  } finally {
    lock.releaseLock();
  }
}

function htmlResponse_(status, message, leadId) {
  const payload = JSON.stringify({ source: 'mela-inquiry', status: status, message: message, leadId: leadId });
  const output = HtmlService.createHtmlOutput('<!doctype html><meta charset="utf-8"><script>window.top.postMessage(' + payload + ', "*");<\/script><p>' + html_(message) + '</p>');
  output.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  return output;
}

function clean_(value, maxLength) {
  return String(value || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, maxLength);
}

function html_(value) {
  return String(value || '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function digest_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value).map(byte => ('0' + ((byte + 256) % 256).toString(16)).slice(-2)).join('').slice(0, 32);
}

function testNotification() {
  const sample = {
    leadId: 'test-' + Date.now(), receivedAt: Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss'),
    primaryNeed: '測試通知', currentStage: '已有網站／系統', timeline: '一至三個月', budget: '10 萬元級',
    features: '登入與權限、表單與通知', name: '測試訪客', company: 'MELA', email: '', phone: '', lineId: '',
    preferredContact: 'Email', message: '如果 Gmail 與 LINE 都收到這則訊息，代表通知設定完成。'
  };
  sendEmail_(sample);
  sendLine_(sample);
}
