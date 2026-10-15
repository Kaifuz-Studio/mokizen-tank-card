# Mokizen Tank Card

A small living aquarium for your Home Assistant dashboard. The tank is drawn by the hosted
[Mokizen](https://mokizen.com) widget; this card frames it, keeps it light on battery and lets it react to Home Assistant.

## Install (HACS, custom repository)

1. HACS → Frontend → ⋮ → Custom repositories → add this repository as type **Dashboard**.
2. Install **Mokizen Tank Card**, reload the browser.

Manual: copy `dist/mokizen-tank-card.js` to `/config/www/` and add `/local/mokizen-tank-card.js` as a *JavaScript module* resource.

## Use

```yaml
type: custom:mokizen-tank-card
tank: reef-01                          # a public Mokizen tank id (default reef-01)
height: 240                            # 120–800 px (default 240)
day_night: true                        # the tank's light follows your home's time of day (default false)
feed_on: input_button.feed_fish        # a pellet drops and the fish go for it when this entity changes state
react_on: binary_sensor.front_door     # the fish dart when this entity changes state
fps: 20                                # frame cap, 5–60; 0 = uncapped (default 20)
```

| Option | Default | Notes |
|---|---|---|
| `tank` | `reef-01` | letters, digits, `_`, `-` |
| `height` | `240` | clamped to 120–800 |
| `day_night` | `false` | dawn, day, sunset, night from your Home Assistant time zone |
| `feed_on` | none | an entity id; any state change drops a pellet |
| `react_on` | none | an entity id; any state change makes the fish dart |
| `fps` | `20` | lower is easier on a wall tablet's battery |
| `base_url` | `https://mokizen.com` | where the widget is served; must be https |

`day_night`, `feed_on` and the clean frame (no buttons, no credit chip) need the Mokizen widget from 2026-10 or later;
on an older widget they are ignored and the tank simply plays as before.

## Good to know

- The dashboard device needs internet and WebGL. Without WebGL the card says so instead of showing a blank box.
- The tank is unloaded after the card has been off screen (or the page hidden) for 30 seconds, and loaded again when it comes back, so a wall tablet is not drawing a tank nobody sees.
- Use it with Mokizen's public tanks. A tank that lists licensed `domains` shows an "unlicensed embed" watermark on any other site, by design.

## Develop

```bash
npm test                     # config, frame cap and time-of-day logic
python3 -m http.server 8765  # then open /demo/index.html  (add ?local=1 to use a Mokizen checkout on :8766)
```

## Licence

[PolyForm Noncommercial 1.0.0](LICENSE): free for personal and other noncommercial use. Commercial use needs a licence from Kaifuz Studio.
This is source-available, not an OSI open-source licence.
