import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

test("budget shortcuts remain native buttons inside a named group", () => {
  assert.match(index, /class="budget-ruler reveal" role="group" aria-label="依預算開始需求健檢"/);
  assert.equal((index.match(/<button type="button" data-budget="(?:three|five|ten|fifty)">/g) || []).length, 4);
  assert.doesNotMatch(index, /role="listitem"/);
});

test("small text and white-on-accent UI tokens meet the approved contrast palette", () => {
  assert.match(styles, /--teal: #35725f/);
  assert.match(styles, /--orange: #9b533d/);
  assert.match(styles, /--purple: #6f5b7e/);
  assert.match(styles, /\.node-scope small, \.node-scope span \{ color: #fff; \}/);
  for (const rule of [
    /\.work-note \{[^}]*color: var\(--muted\)/,
    /\.feedback-note \{[^}]*color: var\(--muted\)/,
    /\.budget-ruler small \{[^}]*color: var\(--muted\)/,
    /\.ruler-note \{[^}]*color: var\(--muted\)/,
    /footer \.brand small \{[^}]*color: var\(--muted\)/,
    /footer > small \{[^}]*color: var\(--muted\)/
  ]) assert.match(styles, rule);
});
