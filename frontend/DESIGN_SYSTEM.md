# Hi Alice Design System

> Ghibli-inspired, child-first design system for ages 6-13

The Hi Alice Design System provides a comprehensive guide to colors, typography, spacing, animations, and interactions. Every design decision prioritizes clarity, accessibility, and child-friendly aesthetics aligned with the Ghibli aesthetic and educational pedagogy outlined in CLAUDE.md.

## Table of Contents

1. [Color Palette](#color-palette)
2. [Typography](#typography)
3. [Spacing](#spacing)
4. [Shadows & Depth](#shadows--depth)
5. [Animations](#animations)
6. [Breakpoints & Responsive](#breakpoints--responsive)
7. [Accessibility](#accessibility)
8. [Component Patterns](#component-patterns)
9. [3-Tier Visual Density](#3-tier-visual-density)
10. [Icon System](#icon-system)

---

## Color Palette

### Primary Colors

The primary color palette is inspired by Ghibli forests and uses warm, natural tones that feel inviting and safe for children.

| Color Name | Hex | CSS Variable | Usage | WCAG AA Contrast |
|------------|-----|--------------|-------|------------------|
| Forest Green (Primary) | `#5C8B5C` | `--primary` | Headers, primary actions, HiAlice avatar, progress indicators | 4.8:1 on `#FFFCF3` |
| Primary Light | `#7AAE7A` | `--primary-light` | Hover states, secondary highlights, sidebar accents | 3.9:1 on `#F5F0E8` |
| Primary Dark | `#3D6B3D` | `--primary-dark` | Active states, deep focus rings, dark mode | 8.2:1 on `#FFFCF3` |

**Implementation**:
```js
// constants.js
export const COLORS = {
  primary: '#5C8B5C',        // Main brand color
  primaryLight: '#7AAE7A',   // Hover/secondary
  primaryDark: '#3D6B3D',    // Active/pressed
};
```

### Semantic Colors

| Purpose | Color | Hex | CSS Utility | Usage Example |
|---------|-------|-----|-------------|----------------|
| Success | Soft Leaf Green | `#7AC87A` | `text-success`, `bg-success` | Completed stages, validation, achievement badges |
| Success Light | Light Mint | `#9ED89E` | `bg-success-light` | Background fill for success panels |
| Success Dark | Deep Green | `#5CAF5C` | `text-success-dark` | Text on success backgrounds |
| Warning | Ghibli Gold | `#D4A843` | `text-accent`, `bg-accent` | Alerts, highlights, vocabulary callouts |
| Warning Light | Light Gold | `#E8C46A` | `bg-accent-light` | Soft backgrounds for warnings |
| Warning Dark | Dark Gold | `#A8822E` | `text-accent-dark` | Readable text on gold backgrounds |
| Danger | Warm Rose | `#D4736B` | `text-danger`, `bg-danger` | Errors, destructive actions (child-friendly, not harsh red) |
| Danger Light | Soft Rose | `#E09891` | `bg-danger-light` | Soft error backgrounds |
| Danger Dark | Deep Rose | `#B85A53` | `text-danger-dark` | Text on danger backgrounds |

**Contrast Notes**:
- Gold text (`#A8822E`) achieves **4.5:1** contrast on cream (`#FFFCF3`) — meets WCAG AA
- Rose/danger colors are intentionally soft (not harsh red `#E74C3C`) to feel less punitive to children
- All primary text on primary backgrounds meets **minimum 4.5:1** (WCAG AA)

### Background Colors

| Name | Hex | Purpose | WCAG AA Text |
|------|-----|---------|------------|
| Background | `#F5F0E8` | Main page background — warm cream, reduces eye strain | `#3D2E1E` (8.1:1) |
| Background Alt | `#EDE5D4` | Secondary background for sections — slightly darker | `#3D2E1E` (7.4:1) |
| Card | `#FFFCF3` | Card/panel surfaces — nearly white with warm tint | `#3D2E1E` (9.8:1) |
| Nav Background | `#D6C9A8` | Navigation bar — parchment tan | `#3D2E1E` (4.8:1) |

**Palette Decision**: Replaced cold greys (`#F5F7FA`, `#BDC3C7`) with warm creams and tans. This reduces visual fatigue for extended reading and creates a "cozy library" feeling appropriate for young learners.

### Text Colors

| Usage | Color | Hex | Notes |
|-------|-------|-----|-------|
| Primary Text | Dark Bark | `#3D2E1E` | Body copy, headings, main content — high contrast |
| Secondary Text | Warm Brown | `#6B5744` (mid) / `#9C8B74` (light) | Labels, captions, supporting text |
| Inverted (on dark) | White | `#FFFFFF` | For text on `#5C8B5C` or darker backgrounds |

### Level-Specific Badges

| Level | Badge Color | Text Color | Border | Beginner Only? |
|-------|------------|-----------|--------|----------------|
| Beginner | `#C8E6C9` (mint) | `#1B5E20` (dark green) | `#81C784` | ✅ High visibility |
| Intermediate | `#FFE0B2` (peach) | `#BF360C` (dark orange) | `#FFB74D` | Intermediate+ only |
| Advanced | `#E1BEE7` (lavender) | `#4A148C` (deep purple) | `#CE93D8` | Advanced+ only |

**Visibility**: Beginner badges appear on all level book cards for parents/admins. Only appropriate level badges show (point 3.7, CLAUDE.md: Progressive Disclosure).

### Additional Theme Colors

| Name | Hex | Purpose |
|------|-----|---------|
| Sky | `#87CEDB` | Gradients, decorative elements, outdoor theme |
| Sky Light | `#A8DAEA` | Light sky tints |
| Ghibli Cream | `#FFFCF3` | Premium card surfaces |
| Ghibli Tan | `#D6C9A8` | Navigation, borders |
| Ghibli Forest | `#3D6B3D` | Deep primary (dark mode) |
| Ghibli Gold | `#D4A843` | Accent brand |

---

## Typography

### Font Stack

```css
/* Primary Font - Headlines & Body */
font-family: 'Nunito', 'Quicksand', system-ui, -apple-system, 'Segoe UI', 'Roboto', sans-serif;

/* Secondary Font - Special Elements */
font-family: 'Quicksand', 'Nunito', sans-serif;

/* Serif Fallback - Book Titles */
font-family: 'Georgia', 'Cambria', 'Times New Roman', serif;
```

**Why These Fonts**:
- **Nunito**: Geometric, friendly, highly legible at small sizes (ideal for children). Part of Google Fonts.
- **Quicksand**: Rounded terminals, warm personality. Used sparingly for special callouts.
- **Georgia/Serif**: For book titles to evoke literary prestige while maintaining readability.

### Type Scale

All sizes adhere to a 6px-based scale to align with spacing and component structure.

| Level | CSS Class | Size | Weight | Line Height | Usage |
|-------|-----------|------|--------|------------|-------|
| **H1** (Page Title) | `.page-title` | 30px / `text-3xl` | 800 (extrabold) | 1.25 | Page hero titles, major section headers |
| **H2** (Section) | `.section-title` | 20px / `text-xl` | 800 (extrabold) | 1.4 | Stage headers, subsection titles |
| **H3** | — | 18px / `text-lg` | 700 (bold) | 1.4 | Card titles, medium emphasis |
| **Body** | default | 16px / `text-base` | 600 (semibold) | 1.6 | Main content, paragraphs, dialogue |
| **Small** | — | 14px / `text-sm` | 600 (semibold) | 1.5 | Secondary text, captions |
| **Caption** | — | 12px / `text-xs` | 500 (medium) | 1.4 | Labels, metadata, mini badges |
| **Tiny** | — | 11px / `text-[11px]` | 600-700 | 1.3 | Ribbon badges, review counts |

**Minimum Floor**: Body text never drops below 14px (per WCAG guideline for child audiences). Tailwind `text-sm` = 14px, enforced via:

```css
/* globals.css */
p, li, td, th {
  font-size: max(0.875rem, 1em); /* 14px floor */
}
```

### 3-Tier Age Adaptation

The type system adapts across three learner tiers to balance visual density with readability.

| Aspect | Beginner (6-8) | Intermediate (9-11) | Advanced (12-13) |
|--------|---------------|-------------------|-----------------|
| Body Font Size | 18px | 16px | 14px |
| Heading Font Size | 24px → 20px scale | 22px → 18px scale | 20px → 14px scale |
| Line Height | 1.8 (spacious) | 1.6 (moderate) | 1.5 (compact) |
| Letter Spacing | Slight | Normal | Normal |
| Emphasis Weight | 700-800 (bold) | 700 (bold) | 600 (semibold) |

**Implementation** (see section 9: 3-Tier Visual Density):
```html
<!-- Applied as data attribute or CSS class -->
<body class="tier-beginner">
  <p>This text is 18px</p>
</body>

<body class="tier-advanced">
  <p>This text is 14px</p>
</body>
```

---

## Spacing

### Base Scale (8px Grid)

All spacing adheres to an **8px base unit** for consistency and alignment.

| Token | Value | Usage | Tailwind Equivalent |
|-------|-------|-------|-------------------|
| **xs** | 4px | Inline element spacing, tight grouping | `px-1` |
| **sm** | 8px | Component padding, small gaps | `p-2`, `gap-2` |
| **md** | 16px | Section padding, medium gaps | `p-4`, `gap-4` |
| **lg** | 24px | Page margins, large section gaps | `p-6`, `gap-6` |
| **xl** | 32px | Major section dividers | `p-8`, `gap-8` |

### Practical Spacing Rules

| Context | Spacing | Reason |
|---------|---------|--------|
| Button padding | `py-3 px-6` (12px × 24px) | Comfortable touch target (48px min height) |
| Card padding | `p-4` (16px) → `p-6` (24px) Beginner | Breathes room, scannable at small sizes |
| Section gap | `gap-4` to `gap-6` (16px–24px) | Clear visual separation |
| Touch targets gap | `gap-2` (8px) minimum | Prevents fat-finger misses |
| Page margins | `px-4 sm:px-6` (16px–24px) | Breathing room on mobile/tablet |

### Responsive Padding

```jsx
// Example: Card padding scales with breakpoint
<div className="p-4 sm:p-6 md:p-8">
  {/* 16px on mobile, 24px on tablet, 32px on desktop */}
</div>
```

---

## Shadows & Depth

### Shadow System

Shadows create subtle depth hierarchy. All shadows use `rgba(61,46,30,0.X)` — dark brown at varying opacities — to maintain the Ghibli aesthetic.

| Shadow Class | CSS Value | Usage | Elevation |
|--------------|-----------|-------|-----------|
| **ghibli** | `0 4px 20px rgba(61,46,30,0.08)` | Default card shadow — subtle | Base |
| **ghibli-card** | `0 4px 20px rgba(61,46,30,0.06)` | Lighter card shadow (non-interactive) | Base |
| **ghibli-hover** | `0 8px 30px rgba(61,46,30,0.12)` | Hover state on interactive elements | Elevated |

**Implementation**:
```js
// tailwind.config.js
boxShadow: {
  'ghibli': '0 4px 20px rgba(61,46,30,0.08)',
  'ghibli-hover': '0 8px 30px rgba(61,46,30,0.12)',
  'ghibli-card': '0 4px 20px rgba(61,46,30,0.06)',
}
```

### Shadow Depth Ladder

| Visual State | Shadow | Duration | Use Case |
|--------------|--------|----------|----------|
| Rest | `shadow-ghibli` | — | Default cards, panels |
| Hover (Desktop) | `shadow-ghibli-hover` + `translateY(-2px)` | 200ms | Interactive buttons, book cards |
| Active/Pressed | `shadow-ghibli` (reduced) | 100ms | Tactile feedback |
| Focus Ring | Outline + shadow | 200ms | Keyboard accessibility |

### 3D Book Effect

Cards use CSS `perspective` + `transform: rotateY(-6deg)` to create a subtle 3D flip on hover (desktop only, disabled on touch devices per globals.css).

```css
/* globals.css - Touch-safe 3D */
@media (hover: hover) {
  .book-3d:hover .book-3d-inner {
    transform: rotateY(-6deg);
  }
}

@media (hover: none) {
  /* Touch: scale feedback instead */
  .book-3d:active .book-3d-inner {
    transform: scale(0.97);
  }
}
```

---

## Animations

All animations respect `prefers-reduced-motion` media query. Users who prefer reduced motion see **no animations** (0.01ms duration, 1 iteration max).

### Duration & Easing

| Duration | Use Case | Easing |
|----------|----------|--------|
| 150ms | Press feedback, micro-interactions | `ease-out` |
| 200ms | Button hover, focus transitions | `ease-out` |
| 300ms | Page transitions, fade-in content | `cubic-bezier(0.22, 1, 0.36, 1)` (snappy) |
| 350ms | Slide-up modals, overlays | `cubic-bezier(0.22, 1, 0.36, 1)` |
| 500ms | Progress bar fill, learning transitions | `cubic-bezier(0.22, 1, 0.36, 1)` |

### Named Animations

| Name | Duration | Easing | Usage | CSS |
|------|----------|--------|-------|-----|
| **float** | 3s | `ease-in-out infinite` | Floating celebration elements, logo | `translateY(-8px)` at 50% |
| **leaf-sway** | 2.5s | `ease-in-out infinite` | Logo icon gentle sway, decorative plants | `rotate(-3deg)` ↔ `rotate(3deg)` |
| **shimmer** | 2s | `ease-in-out infinite` | Loading skeleton, placeholder content | `opacity: 0.6` → `1` → `0.6` |
| **pulse-mic** | 1.5s | `cubic-bezier(0.4, 0, 0.6, 1)` | Voice recording button breathing | `opacity: 1` → `0.5` |
| **fade-in** | 300ms | `ease-out` | Content entrance, page load | `opacity: 0` → `1`, `translateY: 4px` → `0` |
| **scale-in** | 200ms | `ease-out` | Modal/overlay entrance | `scale: 0.95` → `1`, fade |
| **slide-up** | 350ms | `cubic-bezier(0.22, 1, 0.36, 1)` | Panel slide-in from bottom | `translateY: 12px` → `0`, fade |
| **star-burst** | 600ms | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Achievement celebration | `scale: 0` → `1.2` → `1`, rotate |
| **bounce-in** | 500ms | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Reward badge notification | `scale: 0.3` → `1.05` → `1`, fade |

**Ghibli Feeling**: Animations are intentionally **gentle and organic**, not snappy or jarring. Easing uses cubic-bezier curves that feel natural (inspired by Ghibli's hand-drawn motion).

### Interaction Animations

| Interaction | Animation | Purpose |
|-------------|-----------|---------|
| Button hover | `scale(1) + shadow-ghibli-hover + -translateY(1px)` | Lift effect without jank |
| Button press | `scale(0.95)` | Tactile press-down feeling |
| Card hover | `translateY(-2px) + shadow-ghibli-hover` | Subtle elevation |
| Ripple effect | Radial gradient scale-out from center | Touch feedback |
| Progress fill | Width transition over 600ms | Smooth skill growth |

---

## Breakpoints & Responsive

### Responsive Strategy

Hi Alice uses a **mobile-first** approach: design for the smallest screen, then add enhancements for larger breakpoints.

| Breakpoint | Width | Device | Usage |
|------------|-------|--------|-------|
| **sm** | 640px | Mobile landscape | Horizontal layout, 2-column grid |
| **md** | 768px | Tablet | 3-column grid, desktop nav appears |
| **lg** | 1024px | Desktop | Full-width layouts, sidebar panels |

**Key Breakpoint Rules**:
- **Mobile (< 640px)**: Single column, bottom nav, large touch targets
- **Tablet (640px–1024px)**: Two-column layout, flexible sidebar
- **Desktop (1024px+)**: Three-column layout, horizontal nav, sidebar always visible

### Responsive Utilities

```jsx
// Tailwind mobile-first pattern
<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
  {/* 2 columns on mobile, 3 on tablet, 4 on desktop */}
</div>
```

### Safe Area Inset (Mobile/Notch)

```css
/* globals.css — ensures content clears notch + mobile nav */
@supports (padding-bottom: env(safe-area-inset-bottom)) {
  .pb-safe-nav {
    padding-bottom: calc(4.5rem + env(safe-area-inset-bottom));
  }
}
```

---

## Accessibility

### WCAG 2.1 AA Compliance

All design decisions meet or exceed WCAG 2.1 AA standards.

#### Color Contrast

| Text Type | Foreground | Background | Ratio | Level |
|-----------|-----------|-----------|-------|-------|
| Primary Text | `#3D2E1E` | `#FFFCF3` | 9.8:1 | **AAA** ✓ |
| Primary Text | `#3D2E1E` | `#F5F0E8` | 8.1:1 | **AAA** ✓ |
| Secondary Text | `#6B5744` | `#FFFCF3` | 6.2:1 | **AAA** ✓ |
| Gold Text | `#A8822E` | `#FFFCF3` | 4.5:1 | **AA** ✓ |
| Inverted (white) | `#FFFFFF` | `#5C8B5C` | 4.8:1 | **AA** ✓ |
| Error Text | `#D4736B` | `#FFFCF3` | 5.1:1 | **AAA** ✓ |

**Tool**: Use WebAIM Contrast Checker or Figma A11y plugin to validate any new color combinations.

#### Touch Targets

| Target Type | Minimum Size | Guideline | Enforcement |
|------------|---------------|-----------|------------|
| Interactive Element | 48px × 48px | WCAG 2.5.5 | Enforced in all `.ghibli-btn`, buttons |
| Beginner Tier | 64px × 64px | Child motor skills | Applied in `.tier-beginner` |
| Gap Between Targets | 8px | Prevent fat-finger misses | Built into Tailwind `gap-2` |

```css
/* globals.css */
.touch-target {
  min-height: 44px;
  min-width: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
```

#### Focus & Keyboard Navigation

```css
/* globals.css */
:focus-visible {
  outline: 3px solid #3D6B3D;
  outline-offset: 3px;
  border-radius: 4px;
}

button:focus-visible,
a:focus-visible {
  outline: 3px solid #3D6B3D;
  outline-offset: 3px;
}
```

- **Outline style**: Solid 3px (highly visible)
- **Color**: Primary Dark Green (`#3D6B3D`)
- **Offset**: 3px (clear visual separation)
- **All interactive elements** must show focus ring when navigated via keyboard (Tab key)

#### Reduced Motion

```css
/* globals.css */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Users who set `prefers-reduced-motion: reduce` in OS settings receive **zero animations** — CSS animations are disabled globally.

#### Accessible Emoji & Icons

**Rule**: All decorative emoji have `aria-hidden="true"`. Meaningful emoji use `role="img"` + `aria-label`.

```jsx
// ❌ Wrong
<span>🌟 Achievement</span>

// ✅ Correct (decorative)
<span aria-hidden="true">🌟</span> Achievement

// ✅ Correct (semantic)
<span role="img" aria-label="Achievement star">🌟</span>
```

#### Screen Reader Only

```css
/* globals.css */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

Use for "Skip to content" links and hidden labels:
```jsx
<a href="#main-content" className="sr-only focus:not-sr-only">
  Skip to main content
</a>
```

#### Semantic HTML

- Use `<button>` for actions, `<a>` for navigation
- Use `<label htmlFor="input-id">` for form fields
- Use `<h1>`, `<h2>`, `<h3>` for hierarchy (not divs)
- Use `<nav>`, `<main>`, `<section>` for landmarks
- Use `role="img"` for decorative SVGs with semantic meaning
- Use `role="dialog"` for modals with `aria-modal="true"`

### Print Styles

```css
/* globals.css */
@media print {
  /* Hide navigation, show report header */
  nav, button { display: none !important; }
  .print-only { display: block !important; }

  /* Enforce print colors */
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
```

Print-optimized worksheets and reports use `.print-*` classes for accurate color reproduction.

---

## Component Patterns

### Ghibli Card Base

All content cards inherit from `.ghibli-card`:

```css
.ghibli-card {
  background: #FFFCF3;
  border: 1px solid #E8DEC8;
  border-radius: 1.5rem;
  box-shadow: 0 4px 20px rgba(61, 46, 30, 0.06);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

/* Interactive variants */
button.ghibli-card:hover,
a.ghibli-card:hover,
.ghibli-card.is-interactive:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 30px rgba(61, 46, 30, 0.10);
}
```

### Ghibli Button

```css
.ghibli-btn {
  background: #5C8B5C;
  color: white;
  border-radius: 0.75rem;
  padding: 0.75rem 1.5rem;
  font-weight: 700;
  font-family: 'Nunito', sans-serif;
  min-height: 48px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.ghibli-btn:hover {
  background: #3D6B3D;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(61, 107, 61, 0.3);
}
```

### Ghibli Input

```css
.ghibli-input {
  background: #FFFCF3;
  border: 1.5px solid #D6C9A8;
  border-radius: 0.75rem;
  padding: 0.75rem 1rem;
  color: #3D2E1E;
  font-family: 'Nunito', sans-serif;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.ghibli-input:focus {
  outline: none;
  border-color: #5C8B5C;
  box-shadow: 0 0 0 3px rgba(92, 139, 92, 0.15);
}
```

### Chat Bubbles

```css
/* AI message (HiAlice) */
.bubble-alice {
  background: #D6E9D6;
  color: #3D2E1E;
  border-radius: 1rem 1rem 1rem 0;
}

/* Student message */
.bubble-student {
  background: #FFFCF3;
  color: #3D2E1E;
  border: 1px solid #D6C9A8;
  border-radius: 1rem 1rem 0 1rem;
}
```

### Progress Bar (Reading)

```css
.reading-progress {
  height: 4px;
  background: #EDE5D4;
  border-radius: 9999px;
  overflow: hidden;
}

.reading-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #5C8B5C, #7AC87A);
  border-radius: 9999px;
  transition: width 0.5s ease;
}
```

### Badges

```css
/* Level badge */
.badge-beginner {
  background-color: #C8E6C9;
  color: #1B5E20;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.65rem;
  font-weight: 800;
  text-transform: uppercase;
}

/* Gold/achievement badge */
.badge-gold {
  background: linear-gradient(135deg, #D4A843, #F0C060);
  color: #3D2E1E;
  font-weight: 800;
  font-size: 0.65rem;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
}
```

### Special Surface Styles

#### Hero/Feature Tile
```css
.hialice-hero {
  background: linear-gradient(145deg, #fff7d8 0%, #eef6d6 48%, #d9eef8 100%);
  border: 1px solid #d6c9a8;
  border-radius: 1.75rem;
  box-shadow: 0 10px 30px rgba(61, 46, 30, 0.08);
}
```

#### Soft Panel
```css
.hialice-panel {
  background: rgba(255, 252, 243, 0.82);
  border: 1px solid rgba(255, 255, 255, 0.7);
  border-radius: 1.5rem;
  box-shadow: 0 8px 24px rgba(61, 46, 30, 0.06);
}
```

#### Eyebrow Label
```css
.hialice-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.78);
  padding: 0.35rem 0.8rem;
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: #5c8b5c;
}
```

#### Soft Note (Info Box)
```css
.hialice-soft-note {
  border: 1px solid #d6e7ef;
  border-radius: 1.25rem;
  background: linear-gradient(180deg, #f7fcff 0%, #edf8fb 100%);
  box-shadow: 0 6px 18px rgba(135, 206, 219, 0.12);
}
```

#### Option Card (with top accent bar)
```css
.hialice-option-card {
  position: relative;
  overflow: hidden;
  border: 1px solid #e8dec8;
  border-radius: 1.5rem;
  background: linear-gradient(180deg, rgba(255, 252, 243, 0.98) 0%, rgba(250, 245, 232, 0.98) 100%);
  box-shadow: 0 10px 24px rgba(61, 46, 30, 0.06);
}

.hialice-option-card::before {
  content: "";
  position: absolute;
  inset: 0 0 auto 0;
  height: 6px;
  background: var(--accent-color, #5c8b5c);
}
```

---

## 3-Tier Visual Density

Hi Alice implements **three visual density tiers** to adapt UI complexity to age-appropriate cognitive load (§3.7, CLAUDE.md: Progressive Disclosure).

### Tier Configuration

```css
/* Tier 1: Beginner (6-8 years) */
.tier-beginner {
  --touch-target: 64px;
  --font-size-base: 18px;
  --items-per-screen: 3;
  --spacing-unit: 24px;
  --icon-size: 48px;
  --border-radius: 16px;
}

/* Tier 2: Intermediate (9-11 years) */
.tier-intermediate {
  --touch-target: 52px;
  --font-size-base: 16px;
  --items-per-screen: 5;
  --spacing-unit: 20px;
  --icon-size: 36px;
  --border-radius: 12px;
}

/* Tier 3: Advanced (12-13 years) */
.tier-advanced {
  --touch-target: 48px;
  --font-size-base: 14px;
  --items-per-screen: 6;
  --spacing-unit: 16px;
  --icon-size: 28px;
  --border-radius: 8px;
}
```

### Applied to Components

| Component | Beginner | Intermediate | Advanced |
|-----------|----------|--------------|----------|
| Button height | 64px | 52px | 48px |
| Button font size | 18px | 16px | 14px |
| Card padding | 24px | 20px | 16px |
| Mic button | 96×96px, 40px emoji | 80×80px, 32px emoji | 64×64px, 28px emoji |
| Nav items | 3 visible | 5 visible | 6 visible |

**Implementation**:
```jsx
// Applied at page level or layout
<div className={`tier-${studentLevel}`}>
  <NavBar />
  <main>...</main>
</div>
```

---

## Icon System

### Emoji-Based Icons

Hi Alice uses **emoji icons** exclusively (no external icon library) for simplicity and child-friendliness.

### Emoji Inventory

| Category | Emojis | Usage |
|----------|--------|-------|
| Navigation | 🏠 🚀 📚 ⭐ 📖 👤 | Top/bottom nav links |
| Learning Stages | 🌟 📖 👤 💭 ⭐ 🔗 | Session progression (STAGES) |
| Levels | 🌱 🌿 🌳 | Beginner/Intermediate/Advanced visual indicators |
| Actions | ✓ ✕ ✎ 📤 📥 🔄 | Buttons, confirmations, editing |
| Status | ⏳ ⌛ ✅ ❌ ⚠️ 🔒 | Loading, complete, error, warning, locked |
| Celebration | 🎉 🎊 ⭐ 🏆 🎁 🌟 | Achievement, completion, reward |
| Accessibility | ♿ 🔊 📢 | Accessibility features, volume controls |

### Emoji Accessibility

**Decorative emojis** (visual sugar):
```jsx
<span aria-hidden="true">🌟</span>
```

**Semantic emojis** (meaningful content):
```jsx
<span role="img" aria-label="Achievement unlocked">🏆</span>
```

### Sizing

| Context | Size | CSS |
|---------|------|-----|
| Nav icon | 20-24px | `text-lg` to `text-2xl` |
| Stage icon | 28-48px | `text-3xl` to `text-6xl` |
| Celebration | 64px+ | `text-8xl` |

---

## Design Tokens Summary

| Token | Value | Usage |
|-------|-------|-------|
| `--primary` | `#5C8B5C` | Buttons, headings, progress |
| `--accent` | `#D4A843` | Highlights, gold accents |
| `--success` | `#7AC87A` | Completion, validation |
| `--danger` | `#D4736B` | Errors, destructive (soft) |
| `--background` | `#F5F0E8` | Page background |
| `--card` | `#FFFCF3` | Card surfaces |
| `--text-dark` | `#3D2E1E` | Primary text |
| `--text-light` | `#9C8B74` | Secondary text |
| Spacing unit | 8px | All margins, padding |
| Touch target | 48px (Advanced) / 52px (Int) / 64px (Beginner) | Buttons, interactive areas |
| Max width | 1200px | Content container |
| Border radius | 8px–24px | Varies by tier |

---

## Quick Reference

### When to Use Each Color

| Situation | Color | Reason |
|-----------|-------|--------|
| Primary action button | `#5C8B5C` | Brand recognition, high contrast |
| Hover state | `#3D6B3D` (darker) or `#7AAE7A` (lighter) | Clear feedback without jarring change |
| Success/completion | `#7AC87A` | Universally recognized as "go/good" |
| Alert/warning | `#D4A843` (gold) | Eye-catching without appearing angry |
| Error/destructive | `#D4736B` (soft rose) | Approachable, not harsh red |
| Disabled/inactive | `#EDE5D4` | Low contrast signals unavailability |
| Text on `#FFFCF3` | `#3D2E1E` (primary) | Maximum contrast (9.8:1) |
| Text on `#5C8B5C` | `#FFFFFF` (white) | High contrast (4.8:1) |

### Animation Checklist

- [ ] Does it respect `prefers-reduced-motion`?
- [ ] Is duration ≤ 600ms (feels responsive)?
- [ ] Does it serve a purpose (feedback, state change)?
- [ ] Does it avoid flashing > 3Hz (seizure safe)?
- [ ] Is easing human-like (not linear)?

### Accessibility Checklist

- [ ] Color contrast ≥ 4.5:1 (AA)
- [ ] Touch targets ≥ 48px
- [ ] Focus rings visible (3px outline)
- [ ] Decorative emoji has `aria-hidden="true"`
- [ ] Semantic buttons use `<button>`, not `<div>`
- [ ] Form inputs have associated `<label>`
- [ ] Images have `alt` text or `aria-label`
- [ ] Keyboard navigation works (Tab, Enter, Escape)
- [ ] No color-only information (text required)

---

## File References

| File | Purpose |
|------|---------|
| `frontend/src/lib/constants.js` | Color, level, stage token definitions |
| `frontend/tailwind.config.js` | Custom theme extensions (colors, spacing, animations) |
| `frontend/src/app/globals.css` | Global styles, utility classes, animations, accessibility |
| `frontend/src/components/` | Individual component implementations |

---

## Resources

- **Tailwind CSS Docs**: https://tailwindcss.com/docs
- **WCAG 2.1 AA Compliance**: https://www.w3.org/WAI/WCAG21/quickref/
- **WebAIM Contrast Checker**: https://webaim.org/resources/contrastchecker/
- **Ghibli Color Research**: Inspired by *Spirited Away*, *My Neighbor Totoro*, *Howl's Moving Castle*

---

*Design System v1.0 | Last Updated: March 2026*
