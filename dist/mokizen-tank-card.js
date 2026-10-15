/* Mokizen Tank Card — a small living aquarium for a Home Assistant dashboard.
 * The tank itself is rendered by the hosted Mokizen widget in an iframe; this card only frames it,
 * saves battery (nothing runs while the card is off screen or the page is hidden) and reacts to HA. */

const DEFAULTS = {
  tank: "reef-01",
  height: 240,
  base_url: "https://mokizen.com",
  follow_sun: false,
  react_on: null,
};

export const UNLOAD_AFTER_MS = 30000;
const ID_OK = /^[a-zA-Z0-9_-]{1,64}$/;

/* Pure helpers (also used by the tests). */
export function normalise(config) {
  const c = { ...DEFAULTS, ...(config || {}) };
  if (!ID_OK.test(String(c.tank))) throw new Error("tank must be letters, digits, _ or - (max 64)");
  const h = Number(c.height);
  c.height = Number.isFinite(h) ? Math.min(800, Math.max(120, Math.round(h))) : DEFAULTS.height;
  let u;
  try { u = new URL(String(c.base_url)); } catch { throw new Error("base_url is not a valid URL"); }
  if (u.protocol !== "https:" && u.hostname !== "localhost") throw new Error("base_url must be https");
  c.base_url = u.origin;
  c.follow_sun = c.follow_sun === true;
  c.react_on = typeof c.react_on === "string" && c.react_on.includes(".") ? c.react_on : null;
  return c;
}

export function tankUrl(c) {
  return `${c.base_url}/app/tank?id=${encodeURIComponent(c.tank)}&embed=1`;
}

/* Brightness of the frame for the sun's position: full by day, dim at night (elevation in degrees). */
export function sunBrightness(elevation) {
  if (typeof elevation !== "number" || Number.isNaN(elevation)) return 1;
  const t = Math.min(1, Math.max(0, (elevation + 6) / 12)); // -6° (dusk) .. +6° (day)
  return Math.round((0.45 + 0.55 * t) * 100) / 100;
}

export function webglAvailable(doc = document) {
  try {
    const c = doc.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch { return false; }
}

const Base = typeof HTMLElement !== "undefined" ? HTMLElement : class {};

class MokizenTankCard extends Base {
  setConfig(config) {
    this._c = normalise(config);
    this._visible = false;
    this._frame = null;
    this._lastReact = undefined;
    this._build();
  }

  static getStubConfig() { return { tank: DEFAULTS.tank }; }
  getCardSize() { return Math.ceil(this._c.height / 50); }

  connectedCallback() { this._observe(); document.addEventListener("visibilitychange", this._onVis ||= () => this._sync()); }
  disconnectedCallback() {
    clearTimeout(this._unloadTimer);
    this._io?.disconnect(); this._io = null;
    document.removeEventListener("visibilitychange", this._onVis);
    this._unload();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._c) return;
    if (this._c.follow_sun) {
      const e = hass.states["sun.sun"]?.attributes?.elevation;
      if (this._frame) this._frame.style.filter = `brightness(${sunBrightness(e)})`;
    }
    if (this._c.react_on) {
      const s = hass.states[this._c.react_on]?.state;
      if (this._lastReact !== undefined && s !== this._lastReact) this._send("dart");
      this._lastReact = s;
    }
  }

  _build() {
    const root = this.shadowRoot || this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        ha-card { overflow: hidden; }
        .box { position: relative; height: ${this._c.height}px; background: #021826; }
        iframe { border: 0; width: 100%; height: 100%; display: block; transition: filter 1.5s; }
        .note { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
                color: #cfe8f3; font: 14px/1.4 sans-serif; text-align: center; padding: 16px; }
      </style>
      <ha-card><div class="box"><div class="note" part="note"></div></div></ha-card>`;
    this._box = root.querySelector(".box");
    this._note = root.querySelector(".note");
    if (!webglAvailable()) { this._note.textContent = "This device cannot draw the tank (WebGL is off)."; this._supported = false; }
    else { this._supported = true; this._note.textContent = ""; }
    this._observe();
  }

  _observe() {
    if (!this._box || this._io || typeof IntersectionObserver === "undefined") { this._visible ||= !this._io; return this._sync(); }
    this._io = new IntersectionObserver((es) => { this._visible = es.some((e) => e.isIntersecting); this._sync(); });
    this._io.observe(this);
  }

  /* The tank runs only while the card is on screen and the page is visible. */
  _sync() {
    if (!this._supported) return;
    clearTimeout(this._unloadTimer);
    if (this._visible && !document.hidden) { this._load(); return; }
    /* Every (re)load fetches the tank config from Mokizen, which is rate limited per IP per day, so a card that is
       only briefly out of sight keeps its tank; it is dropped after UNLOAD_AFTER_MS hidden. */
    this._unloadTimer = setTimeout(() => this._unload(), UNLOAD_AFTER_MS);
  }

  _load() {
    if (this._frame) return;
    const f = document.createElement("iframe");
    f.src = tankUrl(this._c);
    f.title = `Mokizen tank ${this._c.tank}`;
    f.setAttribute("loading", "lazy");
    f.setAttribute("referrerpolicy", "no-referrer");
    f.setAttribute("sandbox", "allow-scripts allow-same-origin");
    this._frame = f;
    this._note.style.display = "none";
    this._box.appendChild(f);
    if (this._hass) this.hass = this._hass;
  }

  _unload() {
    if (!this._frame) return;
    this._frame.src = "about:blank";
    this._frame.remove();
    this._frame = null;
    if (this._note) this._note.style.display = "";
  }

  _send(cmd, args = []) {
    try { this._frame?.contentWindow?.postMessage({ ns: "mokizen", cmd, args }, this._c.base_url); } catch { /* frame not ready */ }
  }
}

if (typeof customElements !== "undefined" && !customElements.get("mokizen-tank-card")) {
  customElements.define("mokizen-tank-card", MokizenTankCard);
  (window.customCards = window.customCards || []).push({
    type: "mokizen-tank-card",
    name: "Mokizen Tank",
    description: "A small living aquarium for your dashboard.",
  });
}
