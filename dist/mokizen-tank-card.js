/* Mokizen Tank Card — a small living aquarium for a Home Assistant dashboard.
 * The tank itself is rendered by the hosted Mokizen widget in an iframe; this card only frames it,
 * saves battery (nothing runs while the card is off screen or the page is hidden) and reacts to HA. */

const DEFAULTS = {
  tank: "reef-01",
  height: 240,
  base_url: "https://mokizen.com",
  fps: 20,
  day_night: false,
  react_on: null,
  feed_on: null,
  language: null,
};

export const UNLOAD_AFTER_MS = 30000;
const ID_OK = /^[a-zA-Z0-9_-]{1,64}$/;

/* a two-letter language code ("de", "pt-BR" → "pt"), or null */
const lang2 = (v) => { const m = /^([a-z]{2})(?:[-_]|$)/i.exec(String(v || "")); return m ? m[1].toLowerCase() : null; };

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
  const f = Number(c.fps);
  c.fps = f === 0 ? 0 : Number.isFinite(f) ? Math.min(60, Math.max(5, Math.round(f))) : DEFAULTS.fps;
  c.day_night = c.day_night === true;
  const entity = (v) => (typeof v === "string" && /^[a-z_]+\.[a-z0-9_]+$/.test(v) ? v : null);
  c.react_on = entity(c.react_on);
  c.feed_on = entity(c.feed_on);
  c.language = lang2(c.language);
  return c;
}

/* the tank speaks the card's `language`, else Home Assistant's own (hass.language); the widget falls back to
   English for a language it does not have */
export function tankUrl(c, hassLanguage) {
  const hl = c.language || lang2(hassLanguage);
  return `${c.base_url}/app/tank.html?id=${encodeURIComponent(c.tank)}&embed=1&bare=1` + (c.fps ? `&fps=${c.fps}` : "") + (hl ? `&hl=${hl}` : "");
}

/* The hour of the day (0-24, fractional) in a time zone: the tank's light follows the home's own clock. */
export function localHour(date, timeZone) {
  let parts;
  try {
    parts = new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "numeric", hourCycle: "h23", timeZone }).formatToParts(date);
  } catch {
    return date.getHours() + date.getMinutes() / 60;
  }
  const n = (t) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return n("hour") + n("minute") / 60;
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
    this._lastFeed = undefined;
    this._build();
  }

  static getStubConfig() { return { tank: DEFAULTS.tank }; }
  getCardSize() { return Math.ceil(this._c.height / 50); }

  connectedCallback() {
    this._observe();
    document.addEventListener("visibilitychange", this._onVis ||= () => this._sync());
    /* the widget says "ready" once its tank is built; only then can it take the hour */
    window.addEventListener("message", this._onMsg ||= (e) => {
      if (e.source === this._frame?.contentWindow && e.origin === this._c?.base_url && e.data?.ns === "mokizen" && e.data.evt === "ready") this._sendHour();
    });
    this._hourTimer = setInterval(() => this._sendHour(), 60000);
  }
  disconnectedCallback() {
    clearTimeout(this._unloadTimer);
    clearInterval(this._hourTimer);
    this._io?.disconnect(); this._io = null;
    document.removeEventListener("visibilitychange", this._onVis);
    window.removeEventListener("message", this._onMsg);
    this._unload();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._c) return;
    this._timeZone = hass.config?.time_zone;
    if (this._c.react_on) this._lastReact = this._changed(hass, this._c.react_on, this._lastReact, () => this._send("dart"));
    if (this._c.feed_on) this._lastFeed = this._changed(hass, this._c.feed_on, this._lastFeed, () => this._send("feed"));
  }

  /* Runs `fire` when the entity's state differs from the previous one (not on the very first value). */
  _changed(hass, entity, previous, fire) {
    const s = hass.states[entity]?.state;
    if (previous !== undefined && s !== previous) fire();
    return s;
  }

  _sendHour() {
    if (this._c.day_night) this._send("setHour", [localHour(new Date(), this._timeZone)]);
  }

  _build() {
    const root = this.shadowRoot || this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        ha-card { overflow: hidden; }
        .box { position: relative; height: ${this._c.height}px; background: #021826; }
        iframe { border: 0; width: 100%; height: 100%; display: block; }
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
    f.src = tankUrl(this._c, this._hass?.language);
    f.title = `Mokizen tank ${this._c.tank}`;
    f.setAttribute("loading", "lazy");
    f.setAttribute("referrerpolicy", "no-referrer");
    f.setAttribute("sandbox", "allow-scripts allow-same-origin");
    this._frame = f;
    this._note.style.display = "none";
    this._box.appendChild(f);
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
