import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const backendSource = readFileSync(new URL("../backend/Code.gs", import.meta.url), "utf8");

function loadBackend(properties = {}) {
  const stored = new Map(Object.entries(properties));
  const context = {
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (name) => stored.get(name) || "",
        setProperty: (name, value) => stored.set(name, value)
      })
    },
    ContentService: {
      MimeType: { JSON: "application/json" },
      createTextOutput: () => ({ setMimeType: () => ({}) })
    },
    console
  };
  vm.runInNewContext(backendSource, context);
  return { context, stored };
}

test("an unsigned LINE webhook cannot replace the notification recipient", () => {
  const { context, stored } = loadBackend({ LINE_USER_ID: "owner-user-id" });
  context.handleLineWebhook_({
    postData: {
      contents: JSON.stringify({
        events: [{
          source: { userId: "attacker-user-id" },
          message: { type: "text", text: "綁定通知" }
        }]
      })
    }
  });

  assert.equal(stored.get("LINE_USER_ID"), "owner-user-id");
});

test("a LINE recipient can be changed only with the private binding code", () => {
  const { context, stored } = loadBackend({
    LINE_USER_ID: "old-user-id",
    LINE_BINDING_CODE: "replace-with-a-long-private-code"
  });
  context.handleLineWebhook_({
    postData: {
      contents: JSON.stringify({
        events: [{
          source: { userId: "new-owner-user-id" },
          message: { type: "text", text: "綁定通知 replace-with-a-long-private-code" }
        }]
      })
    }
  });

  assert.equal(stored.get("LINE_USER_ID"), "new-owner-user-id");
});

test("sheet values that begin like formulas are stored as plain text", () => {
  const { context } = loadBackend();
  assert.equal(context.sheetCell_("=HYPERLINK(\"https://example.com\")"), "'=HYPERLINK(\"https://example.com\")");
  assert.equal(context.sheetCell_(" @SUM(A1:A2)"), "' @SUM(A1:A2)");
  assert.equal(context.sheetCell_("一般詢問"), "一般詢問");
});
