import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

test("the story images and system projects are exposed as separate carousels", () => {
  assert.equal((html.match(/data-carousel/g) || []).length >= 2, true);
  assert.match(html, /aria-label="系統專案輪播"/);
  assert.match(html, /aria-label="使用情境圖片輪播"/);
  assert.equal((html.match(/class="story-photo carousel-slide"/g) || []).length, 3);
});

test("each carousel has named controls and a focusable viewport", () => {
  assert.equal((html.match(/data-carousel-viewport tabindex="0"/g) || []).length, 2);
  assert.equal((html.match(/data-carousel-prev/g) || []).length, 2);
  assert.equal((html.match(/data-carousel-next/g) || []).length, 2);
  assert.match(app, /event\.key === "ArrowRight"/);
  assert.match(app, /event\.key === "ArrowLeft"/);
});

test("all story carousel image assets declare square dimensions", () => {
  const storyBlock = html.match(/<div class="carousel story-carousel[\s\S]*?<\/div>\n\s*<div class="feedback-grid"/);
  assert.ok(storyBlock);
  const images = storyBlock[0].match(/<img\b[^>]*>/g) || [];
  assert.equal(images.length, 3);
  images.forEach((image) => assert.match(image, /width="1254" height="1254"/));
});

test("carousel gestures leave vertical page scrolling available", () => {
  assert.doesNotMatch(styles, /\.carousel-viewport \{[^}]*touch-action:\s*pan-x/s);
  assert.doesNotMatch(html, /small-business-value-triptych/);
});
