# UX Contract

## Product context

- Audience: Music listeners who discover albums, keep taste lists, and write reviews.
- Primary jobs: Browse, rate, review, and edit personal music activity.
- Target market(s): Global English-language web product.
- Active locales: English.
- Accessibility target: WCAG 2.2 AA.

## Business-context sources

No separate PRD, ADR, API schema, or policy document is maintained in this repository. `README.md` and the client API implementation are implementation evidence only.

## Visual contract

- Project `DESIGN.md`: `DESIGN.md`.
- Token ownership model: Existing CSS is canonical; `DESIGN.md` records existing system decisions.
- Runtime design-system/token source: `src/styles/global.css` and component/page CSS.

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Form | Page forms with `noValidate` | Existing forms | create / edit | unit + browser |
| Scrollbar | `src/styles/global.css` | Global stylesheet | geometry exceptions | computed style |
| Rating input | `VinylRatingPicker` | `src/components/ratings/VinylRatingPicker.jsx` | album review / edit review | keyboard + visual |
| Rating display | `RatingVinyls` | `src/components/ratings/RatingVinyls.jsx` | small / medium / large | component + visual |
| CRUD | API client plus page dialogs | `src/api/api.js` | create / edit / delete | unit + browser |

## Component behavior

| Component | Default | Hover | Focus | Active | Disabled | Busy | Error |
|---|---|---|---|---|---|---|---|
| Vinyl rating picker | Current rating | Preview next cycle state | Visible full-vinyl outline | Pressed vinyl | No pointer/action | Parent submit disabled | Inline review message |
| Rating display | Full muted disc base + optional fill | n/a | n/a | n/a | n/a | n/a | n/a |

## Flow ledger

| Operation | Trigger | Pending | Success destination | Success feedback | Failure recovery | Focus outcome | Source ref |
|---|---|---|---|---|---|---|---|
| Rate review | Tap a vinyl | Immediate local update | Stay in composer/editor | Full → half → clear cycle | Select another vinyl or retry cycle | Vinyl button remains focused | UI contract |
| Create review | Post form | Submit button disabled | Stay on review page | Inline confirmation | Inline error, retained text/rating | Form remains available | `src/api/api.js` |
| Edit review | Save dialog | Submit button disabled | Stay on originating list | Updated card | Inline error, retained inputs | Dialog action | `src/api/api.js` |
| Delete review | Confirm dialog | Action disabled | Stay on list | Card removed/message | Inline error, retry | Dialog action | `src/api/api.js` |

## Async and resilience

- Mutations are pessimistic and guard against duplicate submission with disabled buttons.
- Vinyl assets are preloaded after sign-in and stored cache-first by the service worker so rating icons do not depend on later network availability.
- Session expiry follows the existing login redirect behavior.

## Verification

- Required static commands: `npm run lint`, `npm test`, `npm run build`.
- Browser coverage: Editable album and review dialogs at desktop/mobile widths; mouse and keyboard rating selection; slow/offline asset reload.
