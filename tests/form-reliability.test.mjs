import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const backendSource = readFileSync(new URL("../backend/Code.gs", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const htmlSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");

const context = {
  PropertiesService: { getScriptProperties: () => ({}) },
  Utilities: { formatDate: () => "2026-08-12 16:00:00" },
  console
};
vm.runInNewContext(backendSource, context);

test("legacy autofilled companyWebsite is ignored", () => {
  const data = context.normalizeForm_({
    parameter: { companyWebsite: "https://autofill.example" },
    parameters: {}
  });
  assert.equal(data.honeypot, "");
});

test("current faxNumber trap is still enforced", () => {
  const data = context.normalizeForm_({
    parameter: { faxNumber: "bot value" },
    parameters: {}
  });
  assert.equal(data.honeypot, "bot value");
  assert.throws(() => context.validateInquiry_(data), /Invalid request/);
});

test("only safe validation messages are returned to visitors", () => {
  assert.equal(
    context.publicErrorMessage_(new Error("Email 格式不正確。")),
    "Email 格式不正確。"
  );
  assert.equal(
    context.publicErrorMessage_(new Error("NOTIFY_EMAIL 未設定")),
    "系統暫時無法送出，請稍後再試。"
  );
});

test("frontend supports mixed cached field names and versioned assets", () => {
  assert.match(appSource, /\["faxNumber", "companyWebsite"\]/);
  assert.match(htmlSource, /styles\.css\?v=20260812-4/);
  assert.match(htmlSource, /config\.js\?v=20260812-4/);
  assert.match(htmlSource, /app\.js\?v=20260812-4/);
});
