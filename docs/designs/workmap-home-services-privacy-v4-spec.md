# WorkMap Homepage - Services and Privacy V4

This specification is authoritative for:

- `docs/designs/workmap-home-services-privacy-desktop-v4.png`
- `docs/designs/workmap-home-services-privacy-mobile-v4.png`

The PNG files communicate composition and visual rhythm. Generated microcopy, FAQ indexes, and tiny UI details are not authoritative. Use this copy and real repository components or verified screenshots.

## Product Sources

- Authoritative Hero Virtual Office panorama: `docs/designs/workmap-virtual-office-panorama.png`
- Earlier Virtual Office reference: `docs/designs/screen.png`
- Virtual Office implementation: `workmap/apps/web/components/office/OfficeMap.tsx`
- Office interactions: `workmap/apps/web/components/office`
- Reports: `workmap/apps/web/components/reports/ReportSummaryPanel.tsx`
- Compliance: `workmap/apps/web/components/compliance/CompliancePolicyPanel.tsx`
- Real DIY avatar layers: `workmap/apps/web/public/assets/avatars/layers`
- Exact eight-avatar composition reference: `docs/designs/workmap-avatar-combinations-reference.png`
- Pixel handbook: `workmap/apps/web/public/assets/temporary-objects/Handbook_DIY_Crafting_Table_32x32.png`
- Pixel signs: `workmap/apps/web/public/assets/temporary-objects/Sign_1_32x32.png`, `Sign_2_32x32.png`, and `Sign_Blank_32x32.png`
- Map and office assets: `workmap/apps/web/public/maps` and `workmap/apps/web/public/modern-office`

Render pixel assets at integer multiples with nearest-neighbour sampling. Do not redraw, smooth, or generate replacement pixel characters, computers, furniture, locks, or policy boards.

## Page Order

1. Navigation
2. Hero
3. Why choose WorkMap / services tabs
4. How WorkMap works
5. Employee privacy and controls
6. FAQ
7. Consent and acknowledgement
8. CTA
9. Footer

## Core Tokens

| Token | Value | Role |
| --- | --- | --- |
| Ink Navy | `#080D22` | Navigation, Hero, privacy, CTA, footer |
| Signal Jade | `#27E0A2` | Primary action, selected tab, collected signal |
| Civic Amber | `#F7B731` | Consent band, section markers, warm emphasis |
| Paper | `#F6F7F2` | Light page surface |
| White | `#FFFFFF` | Elevated surface and text on Navy |
| Ink Muted | `#62697A` | Supporting text |
| Rule | `#DDE1DB` | Borders and ledger lines |
| Blocked Coral | `#FF645E` | Not-collected semantic only |

- Desktop container: `1280px` maximum, `64px` side gutters at `1440px`.
- Desktop grid: 12 columns, `24px` gutter.
- Mobile grid: 4 columns, `16px` outer gutter, `12px` gutter.
- Radius: `4px` controls, `8px` panels, `12px` maximum for Hero media.
- Tap target: minimum `44px`.
- Shadows: reserved for real product media and temporary overlays.

## Navigation

- Desktop height `72px`, reducing to `60px` after `24px` scroll.
- Links: Product, How it works, Privacy, FAQ; actions: Sign in and Create owner account.
- Mobile height `64px`; brand, Sign in, and menu trigger.
- Header resize/background: `500ms cubic-bezier(.22,1,.36,1)`.
- Link hover: Jade underline grows left-to-right over `280ms`.
- Mobile menu: opacity and `translateY(-12px)` over `320ms`.

## Hero

Desktop copy occupies columns 1-4/5 and real product media occupies the remaining width. Use the complete `1904 x 949` panorama at its native `1904 / 949` aspect ratio. Do not crop, stretch, reconstruct, relabel, or rearrange any part of the screenshot. All map labels, status controls, characters, rooms, and navigation must come directly from the source pixels. Do not add metrics, charts, fake people, fake rooms, or substitute controls.

- Eyebrow: `Transparent work visibility`
- Heading: `See the work. Keep the boundary clear.`
- Body: `WorkMap shows app and domain time, presence, and device status. Never screens, keystrokes, or private content.`
- Primary: `Create owner account`
- Secondary: `Explore privacy`
- Proof: `Explainable signals` / `Employee visibility` / `Clear limits`
- Media captions: `Presence is visible` / `Tracking stays transparent`

Mobile places copy before the complete panorama. Render it with `width: 100%`, `height: auto`, and `object-fit: contain`; do not use the earlier crop. Preserve the full left outdoor area, full office building, top controls, minimap, status dock, and right zoom controls. The image may become visually dense on a phone, but its content must remain geometrically correct and must never be reflowed or AI-redrawn.

Motion and feedback:

- Eyebrow enters after `80ms`.
- Heading lines clip-reveal with `90ms` stagger and `600ms` duration.
- Body and actions rise `16px`, delayed `220ms` and `300ms`.
- The complete panorama frame reveals left-to-right and scales `1.015 -> 1` over `900ms`; the bitmap itself is not warped or split into layers.
- The map does not zoom on hover. Captions gain a coloured rule and `4px` icon movement.
- Primary hover: `translateY(-2px)`, Jade lightens to `#55E9B8`, arrow moves `4px`.
- Pressed: `scale(.985)` for `100ms`.

## Why Choose WorkMap

### Tabs

1. `Work visibility` - `Understand activity without private content.`
2. `Reports` - `Review clear, role-aware summaries.`
3. `Virtual Office` - `Meet, signal availability, and interact.`

Selected state uses Navy text, Jade icon, and a `3px` Jade bottom rule. Hover extends the rule over `300ms`. Mobile uses a horizontally scrollable snap strip with no truncated active label.

On change, old content exits `8px` upward over `180ms`; new content enters from `14px` below over `420ms`; media clip-reveals over `520ms`. Keyboard arrows change tabs and focus stays on the selected tab.

### Work Visibility

- Heading: `Progress you can explain. Privacy people can see.`
- Body: `WorkMap records the minimum signals needed to understand work patterns - nothing more.`
- Bullets: `Foreground app name and active duration` / `Browser hostname and active duration` / `Idle and locked time stop counting` / `Employees can review their own summary`

Desktop places these four benefits in a true `2 x 2` grid. The benefit grid and the Signal View ledger share the same top edge in a `4 / 8` or `5 / 7` split, so no empty upper-right area remains. Mobile keeps the benefits `2 x 2` and places the ledger below.

The media is a schema illustration, not a dashboard:

| Signal | Included | Discarded |
| --- | --- | --- |
| App | App name, duration | Window title and content |
| Domain | Hostname, duration | Path, query, fragment, and title |
| Presence | Status and room | Private content |
| Device | Heartbeat and coverage | Files, media, and screen content |

### Reports

- Heading: `Patterns you can review. Boundaries you can explain.`
- Body: `Employees see their own activity. Owners see company summaries and role-allowed detail.`
- Bullets: `Apps and domains` / `Focus-active time` / `Device coverage` / `CSV and text export`

Use a verified screenshot of the real `ReportSummaryPanel`. The repository currently has no approved Reports screenshot. Do not use the fictional public-homepage dashboard and do not invent values.

### Virtual Office

- Heading: `A shared place to be present, available, and easy to reach.`
- Body: `See who is around, move between rooms, wave, send a quick message, and understand room context.`
- Bullets: `Live presence` / `Focus, busy, away, and offline states` / `Room context` / `Wave and quick message`

Use `docs/designs/screen.png`. Additional wave, busy, avatar-builder, and room-entry layers require screenshots captured from the real running product; they do not currently exist as approved assets. Layer no more than three verified screenshots.

## How WorkMap Works

Heading: `One workspace. Two visible agents. Clear reports.`

| Node | Customer copy |
| --- | --- |
| WorkMap Web | `Owners create the workspace and invite the team.` |
| One-time pairing | `Employees pair each device with a short-lived code.` |
| Desktop Agent | `Records foreground app name and active duration. Idle and locked time stops.` |
| Browser Extension | `Records hostname and active duration. Path, title, and content are discarded.` |
| Offline recovery | `A bounded queue retries safely after a network gap.` |
| Role-aware reports | `Employees see their own summary. Owners see aggregate and allowed views.` |

The system path is strictly `WorkMap Web -> One-time pairing -> Desktop Agent / Browser Extension -> Offline recovery -> Role-aware reports`. Desktop Agent and Browser Extension are the only parallel branch; they merge before Offline recovery. Every connector has a visible arrowhead.

Use modern line icons for browser, desktop, queue, key, and report concepts. Use one real DIY avatar beside WorkMap Web, one different avatar beside Pairing, and a group of two other avatars beside Reports. Avatars sit outside node boxes and connector turns and never overlap a line. Do not create pixel hardware, furniture, or characters. Desktop uses a left-to-right route; mobile uses a top-to-bottom route.

The route draws once when `18%` of the section is visible (`900ms`). Nodes enter with `90ms` stagger and `translateY(14px)`. Actionable-node hover strengthens its border and shifts the arrow `4px`; explanatory nodes must not pretend to be links.

## Employee Privacy

Heading: `Always visible. Always limited. Always under your control.`

Collected:

- `App name and duration`
- `Domain hostname and duration`
- `Presence status and room`
- `Device heartbeat and coverage`
- `Policy acknowledgement timestamp`

Never collected:

- `Screenshots or screen recordings`
- `Keystrokes or clipboard content`
- `Window or page titles`
- `Full URLs, paths, queries, or fragments`
- `Page, form, email, or private message content`
- `Camera or microphone data`

Employee controls:

- `Tracking status stays visible in the Agent and Extension UI.`
- `Employees can stop the Agent or disable the Extension.`
- `Employees can review their own summary.`
- `The monitoring policy can be reviewed and acknowledged.`

Use four different real DIY avatar combinations for the four controls. Do not repeat one character, and do not use the generated orange-haired character from V2.

The centre filter is a CSS/vector ledger gate, not a pixel asset and not a generic shield card. Collected routes use Jade; blocked routes use Coral and stop before the gate.

- Background wipes left-to-right over `700ms`.
- Collected routes draw toward the filter; blocked routes stop and retract `8px`.
- Items stagger by `60ms`; hover highlights the corresponding route.
- Running status may use a restrained `2.4s` opacity pulse, disabled under reduced motion.

### Product-Truth Limitation

Current code records backend policy acknowledgement, but no current web/API code blocks pairing or ingestion until acknowledgement exists. The homepage must not claim `consent is required before tracking` as an enforced guarantee. That requires a separately approved functional change. Safe current copy is `The monitoring policy can be reviewed and acknowledged.`

## Consent and CTA

- Quote: `WorkMap works with your people, not around them.`
- Principle: `Transparent signals. Clear boundaries. Fair by design.`
- Principle: `Policy first. People always.`
- CTA: `Transparency you can trust. Visibility you can explain.`
- Actions: `Create owner account` / `Sign in`

The Amber band appears after FAQ. It mask-reveals over `650ms`. Use one real DIY avatar combination not already used in the adjacent controls. It may play one short existing sequence once; do not generate frames or loop continuously.

## FAQ

FAQ appears before Consent and CTA.

Desktop uses a `36% / 64%` grid. The left panel uses `position: sticky; top: 112px; align-self: start`. The right accordion pane has a visible restrained scrollbar, `max-height: min(68vh, 720px)`, and `overflow-y: auto`. Wheel input over the right pane scrolls the questions while the left stays fixed. When the right pane reaches its bottom, normal scroll chaining continues to the Consent section; do not trap the user or globally hijack the wheel. The left primary line and every right question label use the same `22px` size and line-height.

Mobile places the intro normally above full-width accordions, removes the inner scrollbar, and uses `18px` for both the primary FAQ line and question labels.

1. **What does the Desktop Agent do?** `It records the foreground app name and active duration. It stops when Windows is idle or locked.`
2. **What does the Browser Extension do?** `It records the active website hostname and duration. It discards paths, queries, titles, and page content.`
3. **What does WorkMap collect?** `App and domain duration, presence, room, device heartbeat, and policy acknowledgement.`
4. **What does WorkMap never collect?** `No screenshots, keystrokes, clipboard, full URLs, private content, camera, or microphone.`
5. **Can employees stop tracking?** `Yes. They can stop the Desktop Agent or disable the Browser Extension.`
6. **What happens when a device is offline?** `A limited local queue retries with backoff when the network returns.`
7. **What can employees see?** `Their own activity summary, device status, and compliance state.`
8. **What can owners see?** `Company summaries and role-allowed employee views inside the same tenant.`
9. **How does secure pairing work?** `A short-lived, one-time code creates a device-scoped credential. Revoking the device stops access.`
10. **How do I start using WorkMap?** `Create an owner account, set up the workspace, invite the team, then pair the Agent and Extension.`

Row hover gives the index an Amber background and rotates plus `90deg` over `240ms`. Open answer expands over `360ms cubic-bezier(.22,1,.36,1)`. Focus-visible ring is `3px` Jade with `3px` offset.

## Footer

Only include real routes or anchors: Work visibility, Reports, Virtual Office, What we collect, What we never collect, Employee controls, Policy, Sign in, and Create owner account. Privacy Policy and Terms appear only when real destinations exist. Do not add Pricing, Blog, Careers, Documentation, Guides, Status, or Support without real destinations.

## Global Motion and Validation

| Token | Duration | Use |
| --- | ---: | --- |
| Immediate | `100ms` | Press states |
| Fast | `180ms` | Icon and colour feedback |
| Standard | `300ms` | Hover and tabs |
| Reveal | `600ms` | Text and section entrances |
| Spatial | `900ms` | Map and route reveals |

- Entrance: `cubic-bezier(.22,1,.36,1)`
- Standard UI: `cubic-bezier(.4,0,.2,1)`
- Section wipe: `cubic-bezier(.65,0,.35,1)`
- Use `IntersectionObserver` around threshold `.18` and bottom root margin `-12%`.
- Reveals run once. No scroll hijacking, cursor following, constant parallax, or delayed interaction.
- Under `prefers-reduced-motion: reduce`, remove transforms, clipping, route drawing, pulse, smooth scroll, and automatic sprite playback.
- Validate at `360`, `390`, `768`, `1024`, `1280`, `1440`, and `1920px`.
- No horizontal overflow, clipped CTA, truncated tab, unreadable product screenshot, hover-only action, or invented product data.
- Generated visual text never overrides this document or repository truth.
