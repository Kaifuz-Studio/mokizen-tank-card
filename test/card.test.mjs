import test from "node:test";
import assert from "node:assert/strict";
import { normalise, tankUrl, sunBrightness } from "../dist/mokizen-tank-card.js";

test("defaults", () => {
  const c = normalise({});
  assert.equal(c.tank, "reef-01");
  assert.equal(c.height, 240);
  assert.equal(tankUrl(c), "https://mokizen.com/app/tank?id=reef-01&embed=1");
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
test("react_on needs an entity id; follow_sun is strictly boolean", () => {
  assert.equal(normalise({ react_on: "binary_sensor.door" }).react_on, "binary_sensor.door");
  assert.equal(normalise({ react_on: "door" }).react_on, null);
  assert.equal(normalise({ follow_sun: "yes" }).follow_sun, false);
  assert.equal(normalise({ follow_sun: true }).follow_sun, true);
});
test("sun brightness: dim at night, full by day, 1 when unknown", () => {
  assert.equal(sunBrightness(-30), 0.45);
  assert.equal(sunBrightness(30), 1);
  assert.equal(sunBrightness(0), 0.73);
  assert.equal(sunBrightness(undefined), 1);
});
