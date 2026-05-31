---
name: WorkMap Design System
colors:
  surface: '#f8f9ff'
  surface-dim: '#ccdbf3'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e6eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d5e3fc'
  on-surface: '#0d1c2e'
  on-surface-variant: '#454650'
  inverse-surface: '#233144'
  inverse-on-surface: '#eaf1ff'
  outline: '#767681'
  outline-variant: '#c6c5d1'
  surface-tint: '#4f5b94'
  primary: '#000c43'
  on-primary: '#ffffff'
  primary-container: '#16235a'
  on-primary-container: '#808cc9'
  inverse-primary: '#b9c3ff'
  secondary: '#0051d5'
  on-secondary: '#ffffff'
  secondary-container: '#316bf3'
  on-secondary-container: '#fefcff'
  tertiary: '#0c151d'
  on-tertiary: '#ffffff'
  tertiary-container: '#212932'
  on-tertiary-container: '#88909b'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dde1ff'
  primary-fixed-dim: '#b9c3ff'
  on-primary-fixed: '#06154d'
  on-primary-fixed-variant: '#37437b'
  secondary-fixed: '#dbe1ff'
  secondary-fixed-dim: '#b4c5ff'
  on-secondary-fixed: '#00174b'
  on-secondary-fixed-variant: '#003ea8'
  tertiary-fixed: '#dbe3ef'
  tertiary-fixed-dim: '#bfc7d3'
  on-tertiary-fixed: '#141c25'
  on-tertiary-fixed-variant: '#3f4851'
  background: '#f8f9ff'
  on-background: '#0d1c2e'
  surface-variant: '#d5e3fc'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.25'
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.3'
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.4'
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.2'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-max: 1440px
  gutter: 24px
  margin-desktop: 40px
  margin-tablet: 24px
  margin-mobile: 16px
---

## Brand & Style

The design system is engineered for a work visibility platform that balances operational transparency with individual privacy. The brand personality is **Professional, Trustworthy, and Empathetic**. It avoids the cold, mechanical aesthetics of surveillance software, opting instead for a **Modern Corporate** style that incorporates subtle **Playful** elements to humanize the digital workspace.

The visual language uses high-quality whitespace and soft depth to create a "calm" interface. By prioritizing "visibility for collaboration" over "monitoring for control," the UI employs friendly rounded shapes and a vibrant status palette to make the 2D office environment feel inviting and communal.

## Colors

The palette is anchored by a deep navy primary to establish authority and compliance, paired with a vibrant secondary blue for action and momentum. 

- **Primary (#16235A):** Used for navigation sidebars, headers, and primary brand moments.
- **Secondary (#2563EB):** Used for primary calls-to-action and active states.
- **Surface & Background:** The application sits on a soft gray (#F4F7FB) to reduce eye strain, with pure white cards providing clear content separation.
- **Semantic Status Palette:** A sophisticated range of colors represents availability. These should be used as small indicators (dots or thin rings) to provide at-a-glance information without overwhelming the layout.

## Typography

This design system utilizes **Inter** for its exceptional legibility in data-dense SaaS environments. 

- **Headlines:** Use Bold (700) and Semi-Bold (600) weights with slightly tighter letter spacing to create a strong visual hierarchy.
- **Body Text:** Standardizes on a 16px base for optimal readability. Use #0F172A for primary body and #475569 for secondary descriptive text.
- **Labels:** Small labels and captions use Medium (500) or Semi-Bold (600) weights to ensure they remain distinct from body content at smaller sizes.

## Layout & Spacing

The layout follows a **Fixed-Fluid hybrid grid**. Sidebars and navigation menus are fixed width, while the main workspace/map area fluidly expands to fill the viewport.

- **Grid:** A 12-column system is used for dashboard layouts, while the "Map View" uses a free-form canvas with a hidden 8px snap-grid.
- **Rhythm:** All margins and paddings are multiples of 8px. 
- **Adaptivity:** 
  - **Desktop (>1024px):** 12 columns, 40px outer margins.
  - **Tablet (768px-1023px):** 8 columns, 24px outer margins. Sidebars collapse into icons or drawers.
  - **Mobile (<767px):** 4 columns, 16px outer margins. Navigation moves to a bottom bar or top-level hamburger menu.

## Elevation & Depth

This design system uses **Tonal Layers** and **Soft Ambient Shadows** to distinguish between the background, the workspace, and interactive overlays.

- **Level 0 (Background):** #F4F7FB. No shadow.
- **Level 1 (Cards/Surface):** Pure White (#FFFFFF). Uses a very soft, diffused shadow: `0px 4px 20px rgba(15, 23, 42, 0.05)`.
- **Level 2 (Dropdowns/Modals):** Pure White (#FFFFFF). Uses a more pronounced shadow to indicate focus: `0px 12px 32px rgba(15, 23, 42, 0.12)`.
- **Borders:** All Level 1 surfaces use a 1px solid border (#D8E0EC) to maintain definition against the light background, even if shadows are disabled in accessibility settings.

## Shapes

The shape language is purposefully soft to evoke a friendly, collaborative environment. 

- **Small Elements (Buttons, Inputs):** 8px (0.5rem) radius.
- **Medium Elements (Cards, Modals):** 16px (1rem) radius.
- **Large Elements (Sections, Feature Blocks):** 24px (1.5rem) radius.
- **Avatars:** Always circular to distinguish "people" from "objects" or "tools" within the workspace map.

## Components

### Buttons
- **Primary:** #2563EB background, White text. High-contrast.
- **Secondary:** White background, #16235A border and text.
- **Ghost:** No background/border, Primary Navy text. Used for low-priority actions.

### Cards
Cards are the primary container. They must have a 16px or 24px radius and a 1px #D8E0EC border. Header sections within cards should have a subtle bottom border to separate titles from content.

### Inputs & Fields
- **Default State:** White background, #D8E0EC border, 8px radius.
- **Focus State:** #2563EB 2px ring with 4px offset.
- **Privacy Toggle:** A specific component with a "Shield" icon to indicate when a user is in private mode.

### Status Indicators
Small 8px - 12px circular dots. For "Busy" status, use a 2px white stroke around the red dot to make it "pop" against avatar backgrounds.

### Map Nodes
Individual "desks" or "work zones" in the 2D office view should be rendered as simplified isometric or flat rectangles with 12px rounded corners, utilizing the primary brand colors for structural lines and status colors for the occupant's presence.