# MELA 系統需求健檢

一個可部署到 GitHub Pages 的靜態方案網站，包含 3 萬起／5 萬／10 萬／50 萬起預算比較、去識別化系統作品集與四步需求表單。50 萬起方案定位為 CRM、數據中台或儀表板的範圍受控第一期。表單透過 Google Apps Script 發送 Gmail 與 LINE Messaging API 通知；敏感憑證不會進入公開 repository。

## 網站檔案

- `index.html`：方案頁與需求健檢表單
- `styles.css`：RWD、動畫與表單樣式
- `app.js`：分步表單、驗證與送出狀態
- `config.js`：公開設定，只放 Apps Script Web App URL
- `privacy.html`：表單資料使用說明
- `consent.js`：GA4 Consent Mode v2、分析 Cookie 同意與撤回控制
- `dashboard.html`：本機行銷成效工作台；僅儲存手動輸入的彙總數字於目前瀏覽器
- `dashboard.js`：RACE 漏斗、資料口徑檢查與本週優化建議
- `assets/small-business-value-*.png`：三張 1:1 的 AI 生成小型企業工作情境輪播圖片
- `backend/Code.gs`：Gmail、LINE、選用 Google Sheet 的通知後端

## 1. 建立 Apps Script 後端

1. 前往 [script.google.com](https://script.google.com/) 建立新專案。
2. 將 `backend/Code.gs` 貼入 `Code.gs`；專案設定中的資訊清單可參考 `backend/appsscript.json`。
3. 在「專案設定 → 指令碼屬性」新增：
   - `NOTIFY_EMAIL`：接收詢問通知的 Gmail 地址。
   - `LINE_CHANNEL_ACCESS_TOKEN`：LINE Messaging API channel access token。
   - `SHEET_ID`：選填；若要把每筆詢問寫入 Google Sheet，填入試算表 ID。
   - `LINE_BINDING_CODE`：只在首次或更換 LINE 收件人時暫時設定；請使用至少 24 字元的隨機字串，完成綁定後立即刪除。
4. 按「部署 → 新增部署 → 網頁應用程式」。
   - 執行身分：我
   - 誰可以存取：任何人
5. 複製部署後的 `/exec` 網址，填入 `config.js` 的 `formEndpoint`。

> 修改 `Code.gs` 後必須建立「新版本」並重新部署，舊部署不會自動使用新程式碼。

## 2. 綁定 LINE 通知對象

1. 建立或使用既有的 LINE Official Account，啟用 Messaging API。
2. 在 LINE Developers Console 發行 channel access token，填入 Apps Script 的 `LINE_CHANNEL_ACCESS_TOKEN`。
3. 需要首次綁定或更換收件帳號時，把 Apps Script `/exec` 網址設成 LINE Messaging API Webhook URL，並開啟 Webhook。
4. 先在 Apps Script 指令碼屬性填入私密的 `LINE_BINDING_CODE`，再用自己的 LINE 加該官方帳號為好友，傳送：`綁定通知 你的綁定碼`
5. 收到「已綁定 MELA 網站詢問通知」後，Apps Script 已保存你的 `LINE_USER_ID`；立即刪除 `LINE_BINDING_CODE`，之後任何 LINE 訊息都不能改寫通知對象。

LINE Notify 已停止服務，本專案使用官方 Messaging API Push Message。Channel access token 只放在 Apps Script 屬性中，不得寫入 `config.js` 或 GitHub。

## 3. 測試

1. 在 Apps Script 編輯器直接執行 `testNotification()`，第一次會要求 Gmail、外部連線與選用 Sheet 權限。
2. 確認 Gmail 和 LINE 都收到測試訊息。
3. 從正式 GitHub Pages 填寫一次需求健檢，確認通知與欄位內容。

## 4. GA4、隱私與成效儀表板

網站使用 GA4 的 Consent Mode v2 進階模式。第一次造訪時，分析與廣告相關儲存都預設拒絕；訪客可選擇只使用必要功能，或允許分析 Cookie，並可在頁尾或隱私頁隨時撤回。拒絕或撤回時，網站會清除本頁可存取的 GA Cookie。即使未同意，進階模式仍可能傳送不使用 Cookie 的基本評估訊號。GA 的自動 `page_view` 已關閉，網站只會送出移除 query string、hash 與 referrer 的安全頁面網址。

GA4 只會收到下列不含個資的行為事件：

- `intake_opened`：開啟需求健檢；參數為 `cta_source`、`selected_budget`
- `form_step_completed`：完成第 1–3 步；參數為 `form_name`、`form_step`
- `lead_submit_failed`：後端逾時或端點失敗；參數為 `form_name`、`failure_type`
- `generate_lead`：Apps Script 確認成功送出後才送出；參數為 `form_name`

姓名、Email、電話、LINE ID、公司名稱、自由填寫內容與 URL query string 都不可傳送至 GA4。

`dashboard.html` 是手動更新的 RACE（Reach → Act → Convert → Engage）週檢表：把 GA4 與 CRM／Google Sheet 的**同一期間、去重後彙總數字**轉成每週行動建議。它不會自動讀取 GA4、不讀取或上傳個資，也不載入 GA；資料僅留在目前瀏覽器的 localStorage。由於網站會移除 URL query string 與完整 referrer 以保護隱私，來源欄位應只填已確認且不含個資的彙總值。GitHub Pages 是公開靜態網站，因此這個頁面本身不是有登入保護的私有系統；請勿在共用瀏覽器設定檔輸入敏感數字。

首次設定 GA4 時，請在後台把 `generate_lead` 標示為 Key event，並把 `cta_source`、`selected_budget`、`form_step`、`failure_type` 建立為 event-scoped custom dimensions。要建立自動更新且有登入保護的報表，應使用 Looker Studio 的 GA4 原生連接器與不含個資的 Google Sheet 匯總表；不要把 GA Property ID、OAuth token 或 service-account 憑證放進 GitHub Pages。

## 安全與維運

- 前端加入 honeypot、最短填寫時間、必填與聯絡方式驗證。
- 後端對相同聯絡資訊做 10 分鐘最多 4 次的簡易頻率限制。
- Google Sheet 會將 `=`, `+`, `-`, `@` 開頭的訪客輸入存成純文字，避免公式注入。
- 儀表板會拒絕不合理的漏斗數字（例如成功詢問高於開啟健檢），避免以超過 100% 的比率做錯誤決策。
- 不要在表單、GitHub commit、Issue 或聊天中貼 Gmail 密碼、LINE token 或其他 API 金鑰。
- 若 token 疑似外洩，立即在 LINE Developers Console 撤銷並重新發行。
- Apps Script、Gmail、LINE 與 GitHub Pages 都有各自用量與服務限制；正式投放廣告前應評估 reCAPTCHA 或更完整的 serverless 後端。

## 參考官方文件

- [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [Google Apps Script Web Apps](https://developers.google.com/apps-script/guides/web)
- [Google Apps Script Mail Service](https://developers.google.com/apps-script/reference/mail/mail-app)
- [LINE Messaging API - Send messages](https://developers.line.biz/en/docs/messaging-api/sending-messages/)
- [LINE channel access token](https://developers.line.biz/en/docs/basics/channel-access-token/)
- [Google Consent Mode](https://developers.google.com/tag-platform/security/guides/consent?consentmode=advanced&hl=zh-tw)
- [GA4 recommended events](https://developers.google.com/analytics/devguides/collection/ga4/reference/events)
