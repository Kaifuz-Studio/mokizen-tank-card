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
tank: reef-01        # a Mokizen tank id (default reef-01)
height: 240          # 120–800 px (default 240)
follow_sun: true     # dims the tank at night, from sun.sun (default false)
react_on: binary_sensor.front_door   # the fish dart when this entity changes state (optional)
```

| Option | Default | Notes |
|---|---|---|
| `tank` | `reef-01` | letters, digits, `_`, `-` |
| `height` | `240` | clamped to 120–800 |
| `base_url` | `https://mokizen.com` | where the widget is served; must be https |
| `follow_sun` | `false` | brightness follows `sun.sun` elevation |
| `react_on` | none | any entity id; any state change makes the fish dart |

## Good to know

- The dashboard device needs internet and WebGL. Without WebGL the card says so instead of showing a blank box.
- The tank is unloaded after the card has been off screen (or the page hidden) for 30 seconds, and loaded again when it comes back, so a wall tablet is not drawing a tank nobody sees.
- The frame rate cannot be capped from outside the widget (it is a separate origin), so a long-lived tablet will still use some battery while the tank is visible.
- The widget shows its own small controls (language, fullscreen) and a Mokizen credit.

## Develop

```bash
npm test                     # config and brightness logic
python3 -m http.server 8765  # then open /demo/index.html
```
