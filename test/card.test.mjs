import test from "node:test";
import assert from "node:assert/strict";
import { normalise, tankUrl, localHour } from "../dist/mokizen-tank-card.js";

test("defaults", () => {
  const c = normalise({});
  assert.equal(c.tank, "reef-01");
  assert.equal(c.height, 240);
  assert.equal(tankUrl(c), "https://mokizen.com/app/tank.html?id=reef-01&embed=1&bare=1&fps=20");
});
test("height is clamped and tank id is validated", () => {
  assert.equal(normalise({ height: 10 }).height, 120);
  assert.equal(normalise({ height: 5000 }).height, 800);
  assert.equal(normalise({ height: "abc" }).height, 240);
  assert.throws(() => normalise({ tank: "../x" }));
  assert.throws(() => normalise({ tank: "a b" }));
});
test("base_url must be https (or localhost) and is reduced to its origin", () => {
  assert.equal(normalise({ base_url: "https://example.com/some/path?x=1" }).base_url, "https://example.com");
  assert.throws(() => normalise({ base_url: "http://example.com" }));
  assert.throws(() => normalise({ base_url: "nope" }));
  assert.equal(normalise({ base_url: "http://localhost:8000" }).base_url, "http://localhost:8000");
});
test("react_on and feed_on need an entity id; day_night is strictly boolean", () => {
  assert.equal(normalise({ react_on: "binary_sensor.door" }).react_on, "binary_sensor.door");
  assert.equal(normalise({ react_on: "door" }).react_on, null);
  assert.equal(normalise({ feed_on: "input_button.feed" }).feed_on, "input_button.feed");
  assert.equal(normalise({ feed_on: "x y.z" }).feed_on, null);
  assert.equal(normalise({ day_night: "yes" }).day_night, false);
  assert.equal(normalise({ day_night: true }).day_night, true);
});
test("fps: default 20, clamped to 5-60, 0 means uncapped and leaves the url alone", () => {
  assert.equal(normalise({}).fps, 20);
  assert.equal(normalise({ fps: 1 }).fps, 5);
  assert.equal(normalise({ fps: 500 }).fps, 60);
  assert.equal(normalise({ fps: "abc" }).fps, 20);
  const c0 = normalise({ fps: 0 });
  assert.equal(c0.fps, 0);
  assert.ok(!tankUrl(c0).includes("fps="));
});
test("localHour reads the hour in the given time zone", () => {
  const d = new Date("2026-10-15T00:30:00Z");
  assert.equal(localHour(d, "Asia/Saigon"), 7.5);
  assert.equal(localHour(d, "UTC"), 0.5);
  assert.equal(localHour(d, "America/New_York"), 20.5);
  assert.equal(typeof localHour(d, "Not/AZone"), "number");
});
