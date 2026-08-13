import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

test("mobile first step keeps its six needs in a compact two-column grid", () => {
  const mobileStyles = styles.match(/@media \(max-width: 700px\) \{([\s\S]*?)\n\}/)?.[1] || "";

  assert.match(mobileStyles, /\.intake-form \{ display: grid; grid-template-rows: auto minmax\(0, 1fr\) auto; height: 100vh; height: 100dvh;/);
  assert.match(mobileStyles, /\.form-step \{ min-height: 0; padding: 0 2px; overflow-y: auto; overscroll-behavior: contain;/);
  assert.match(mobileStyles, /\.choice-grid-main \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); gap: 8px; \}/);
  assert.match(mobileStyles, /\.choice-grid-main label > span \{ min-height: 76px; padding: 10px; \}/);
  assert.match(mobileStyles, /\.choice-grid-main label > span small \{ font-size: 12px; line-height: 1\.35; \}/);
  assert.match(mobileStyles, /\.form-actions \{ position: static; margin: 0 -16px -16px; padding: 10px 16px 16px;/);
});
