# Figma Variable → Ethr Design Token Map

Use this when `get_variable_defs` returns Figma variable names like `color/brand/primary` or `spacing/m`. Translate every variable to an Ethr token before writing code. **Never use the raw hex value the variable resolves to** — use the named Ethr token so the result reacts to theme changes.

---

## Theme Access in Every `build()`

Always start with:

```dart
final theme = context.ethrThemeData;
```

`theme` is an `EthrTheme` instance with 380+ semantic color fields. The compiler will autocomplete every token name. Always prefer this over `EthrColors.*` primitives.

---

## Color Tokens — Figma → `theme.<token>`

### Background colors

| Figma variable (typical name) | Ethr token | Use for |
|---|---|---|
| `color/background/page`, `color/bg/primary` | `theme.backgroundNeutralPrimary` | page / screen background |
| `color/background/secondary`, `color/bg/secondary` | `theme.backgroundNeutralSecondary` | section / card background |
| `color/background/tertiary` | `theme.backgroundNeutralTertiary` | nested card / chip background |
| `color/background/surface`, `color/surface` | `theme.backgroundNeutralSurface` | elevated surface |
| `color/background/input` | `theme.backgroundNeutralInput` | input field fill |
| `color/background/overlay`, `color/scrim` | `theme.backgroundNeutralOverlay` | modal scrim / overlay |
| `color/background/disabled` | `theme.backgroundNeutralDisabled` | disabled control fill |
| `color/background/hover` | `theme.backgroundNeutralHover` | hover/pressed state on neutral |
| `color/background/brand/primary`, `color/bg/brand/default` | `theme.backgroundBrandPrimaryAction` | primary brand button fill |
| `color/background/brand/primary/pressed` | `theme.backgroundBrandPrimaryActionPressed` | pressed state for primary button |
| `color/background/brand/secondary` | `theme.backgroundBrandSecondaryAction` | secondary brand button fill |
| `color/background/brand/secondary/pressed` | `theme.backgroundBrandSecondaryActionPressed` | pressed state for secondary button |
| `color/background/brand/surface` | `theme.backgroundBrandSurface` | brand-tinted card / chip |
| `color/background/brand/subtle`, `color/bg/brand/light` | `theme.backgroundBrandFilled` | very light brand surface |
| `color/background/danger/*` | `theme.backgroundDanger{Filled,Hover,Surface,Input,PrimaryAction,PrimaryActionPressed,SecondaryAction,SecondaryActionPressed}` | danger / error states |
| `color/background/success/*` | `theme.backgroundSuccess{Filled,Hover,Surface,Input}` | success states |
| `color/background/warning/*` | `theme.backgroundWarning{Filled,Hover,Surface,Input}` | warning states |
| `color/background/featured/*` | `theme.backgroundFeatured{Filled,Hover,Surface,Input}` | featured / accent states |
| `color/background/accent/*` | `theme.backgroundAccent{Filled,Hover,Surface,Input}` | accent states |

### Content (text, icon) colors

| Figma variable | Ethr token | Use for |
|---|---|---|
| `color/text/primary`, `color/content/primary` | `theme.contentNeutralPrimary` | primary text |
| `color/text/secondary` | `theme.contentNeutralSecondary` | secondary text / muted |
| `color/text/tertiary` | `theme.contentNeutralTertiary` | placeholder / very muted |
| `color/text/disabled` | `theme.contentNeutralDisabled` | disabled text |
| `color/text/inverse`, `color/text/on-brand` | `theme.contentNeutralInverse` | text on dark/colored fills (e.g. on a primary button) |
| `color/text/brand`, `color/icon/brand` | `theme.contentBrandDefault` | brand-colored text & icons |
| `color/text/brand/light` | `theme.contentBrandLight` | light brand emphasis |
| `color/text/brand/bold` | `theme.contentBrandBold` | strong brand emphasis |
| `color/text/danger`, `color/icon/danger` | `theme.contentDangerDefault` | error text |
| `color/text/success`, `color/icon/success` | `theme.contentSuccessDefault` | success text |
| `color/text/warning`, `color/icon/warning` | `theme.contentWarningDefault` | warning text |
| `color/text/featured` | `theme.contentFeaturedDefault` | featured text |
| `color/text/accent` | `theme.contentAccentDefault` | accent text |
| `color/icon/disabled` | `theme.contentInputDisabled` | disabled input icon |

### Border colors

| Figma variable | Ethr token |
|---|---|
| `color/border/default`, `color/stroke/primary` | `theme.borderNeutralPrimary` |
| `color/border/secondary` | `theme.borderNeutralSecondary` |
| `color/border/tertiary` | `theme.borderNeutralTertiary` |
| `color/border/disabled` | `theme.borderNeutralDisabled` |
| `color/border/brand`, `color/stroke/brand` | `theme.borderBrandDefault` |
| `color/border/brand/light` | `theme.borderBrandLight` |
| `color/border/brand/bold` | `theme.borderBrandBold` |
| `color/border/danger` | `theme.borderDangerDefault` |
| `color/border/success` | `theme.borderSuccessDefault` |
| `color/border/warning` | `theme.borderWarningDefault` |
| `color/border/featured` | `theme.borderFeaturedDefault` |
| `color/border/accent` | `theme.borderAccentDefault` |

### Data visualization (charts)

For chart series colors (line, bar, area, pie, donut), use:

| Series role | Ethr token |
|---|---|
| Series 1 / brand / info | `theme.dataVisualizationInformationDefault` (or `*Bold` / `*Light`) |
| Series 2 / featured | `theme.dataVisualizationFeaturedDefault` |
| Series 3 / accent | `theme.dataVisualizationAccentDefault` |
| Series 4 / success | `theme.dataVisualizationSuccessDefault` |
| Series 5 / warning | `theme.dataVisualizationWarningDefault` |
| Series 6 / danger | `theme.dataVisualizationDangerDefault` |
| Neutral / placeholder | `theme.dataVisualizationNeutralDefault` |

Each role has `Bold`, `Default`, `Light`, `ExtraLight` variants — pick by visual weight in the chart.

### When the Figma value is a raw hex (no variable bound)

If `get_variable_defs` returns a literal hex (e.g. `#1A6FE6`) instead of a token:

1. Compare the hex to known semantic tokens by **role** (where it appears: text? button fill? border?).
2. If still unclear, fall back to the closest brand color shade — but choose the **semantic token**, not `EthrColors.primary500`.
3. As a last resort only, use `EthrColors.<palette><shade>` directly. Document this in your final report so the user knows the design wasn't fully tokenized.

---

## Spacing & Padding — Figma → `EthrSpacing` / `EthrPadding`

Figma autolayout `gap` and `padding` properties resolve to numeric variables. Map by value:

| Figma value | `EthrSpacing.*` | `EthrPadding.*` |
|---|---|---|
| `2` | `spacing2` | — |
| `4` | `spacing4` | `padding4` |
| `6` | `spacing6` | `padding6` |
| `8` | `spacing8` | `padding8` |
| `10` | `spacing10` | `padding10` |
| `12` | `spacing12` | `padding12` |
| `14` | `spacing14` | `padding14` |
| `16` | `spacing16` | `padding16` |
| `20` | `spacing20` | `padding20` |
| `24` | `spacing24` | `padding24` |
| `28` | `spacing28` | `padding28` |
| `32` | `spacing32` | `padding32` |
| `40` | `spacing40` | `padding40` |
| `48` | `spacing48` | `padding48` |
| `64` | `spacing64` | `padding64` |
| `80` | `spacing80` | `padding80` |
| `120` | `spacing120` | `padding120` |
| `160` | `spacing160` | `padding160` |

**Use `EthrSpacing.*` for `SizedBox`/gap. Use `EthrPadding.*` for `EdgeInsets.*` paddings.**

If a Figma value is between two scale steps (e.g. `18`, `26`, `36`), round to the nearest available step — never invent a new value.

```dart
// gap between children
const SizedBox(height: EthrSpacing.spacing12)

// padding around a section
Padding(
  padding: const EdgeInsets.symmetric(
    horizontal: EthrPadding.padding16,
    vertical: EthrPadding.padding12,
  ),
  child: ...,
)

// directional padding (RTL safe)
Padding(
  padding: const EdgeInsetsDirectional.only(
    start: EthrPadding.padding8,
    end: EthrPadding.padding16,
  ),
  child: ...,
)
```

---

## Border Radius — Figma → `EthrBorderRadius`

| Figma `cornerRadius` | Ethr token |
|---|---|
| `4` | `EthrBorderRadius.circular4` |
| `6` | `EthrBorderRadius.circular6` |
| `8` | `EthrBorderRadius.circular8` |
| `10` | `EthrBorderRadius.circular10` |
| `12` | `EthrBorderRadius.circular12` |
| `16` | `EthrBorderRadius.circular16` |
| `20` | `EthrBorderRadius.circular20` |
| `24` | `EthrBorderRadius.circular24` |
| Round / pill / fully rounded | `BorderRadius.circular(999)` (or use the component's built-in `shape: ShapeName.rounded` enum if the wrapping Ethr widget exposes one) |

```dart
Container(
  decoration: BoxDecoration(
    color: theme.backgroundBrandSurface,
    borderRadius: EthrBorderRadius.circular12,
  ),
  ...
)
```

---

## Typography — Figma `Text Style` → `EthrTypography` / `EthrText`

Figma `textStyleId` typically resolves to a name like `Heading/H3/Bold` or `Body/Large/Regular`. Map by the **role + size + weight**:

| Figma style | Ethr typography (use one of these) |
|---|---|
| `Heading/H1/Bold` (44 / 700) | `EthrTypography.headingH1Bold` or `EthrText.h1Bold('...')` |
| `Heading/H1/Semibold` | `EthrTypography.headingH1Semibold` |
| `Heading/H1/Medium` | `EthrTypography.headingH1Medium` |
| `Heading/H2/{Bold,Semibold,Medium}` (32) | `EthrTypography.headingH2{Bold,Semibold,Medium}` |
| `Heading/H3/{Bold,Semibold,Medium}` (24) | `EthrTypography.headingH3{Bold,Semibold,Medium}` or `EthrText.h3Bold('...')` |
| `Heading/H4/{Bold,Semibold,Medium}` (20) | `EthrTypography.headingH4{Bold,Semibold,Medium}` |
| `Heading/H5/{Bold,Semibold,Medium}` (16) | `EthrTypography.headingH5{Bold,Semibold,Medium}` |
| `Heading/H6/{Bold,Semibold,Medium}` (14) | `EthrTypography.headingH6{Bold,Semibold,Medium}` |
| `Body/Large/Regular` (16 / 400) | `EthrTypography.bodyLargeRegular` or `EthrText.bodyLarge('...')` |
| `Body/Large/Emphasis` (16 / 600) | `EthrTypography.bodyLargeEmphasis` |
| `Body/Small/Regular` (14 / 400) | `EthrTypography.bodySmallRegular` or `EthrText.bodySmall('...')` |
| `Body/Small/Emphasis` (14 / 600) | `EthrTypography.bodySmallEmphasis` |
| `Body/Micro/Regular` (12 / 400) | `EthrTypography.bodyMicroRegular` |
| `Body/Micro/Emphasis` (12 / 600) | `EthrTypography.bodyMicroEmphasis` |
| `Utility/Button/Large` (16 / 600) | `EthrTypography.utilityButtonLarge` |
| `Utility/Button/Small` (14 / 600) | `EthrTypography.utilityButtonSmall` |
| `Utility/Link/Large` (16 / 500, underlined) | `EthrTypography.utilityLinkLarge` |
| `Utility/Link/Small` (14 / 500, underlined) | `EthrTypography.utilityLinkSmall` |
| `Utility/Caption/Medium` (12 / 500) | `EthrTypography.utilityCaptionMedium` |
| `Utility/Caption/Small` (11 / 500) | `EthrTypography.utilityCaptionSmall` |

Two equivalent ways to apply typography:

```dart
// Option A — factory constructor (preferred for common headings)
EthrText.h3Bold('Page title', color: theme.contentNeutralPrimary)

// Option B — full control
EthrText(
  'Custom heading',
  typography: EthrTypography.headingH3Semibold,
  color: theme.contentBrandDefault,
)
```

**Never** write `Text('...', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600))`.

---

## Icon Sizes — Figma → `EthrIconSize`

`EthrIconSize` is an `enum` with named pixel values. Read the resolved pixel value via `.value`:

| Figma icon size | `EthrIconSize` enum | Pixels |
|---|---|---|
| `16` | `EthrIconSize.xxSmall` | 16 |
| `20` | `EthrIconSize.xSmall` | 20 |
| `24` | `EthrIconSize.small` | 24 |
| `32` | `EthrIconSize.medium` | 32 (default) |
| `40` | `EthrIconSize.large` | 40 |
| `48` | `EthrIconSize.xLarge` | 48 |
| `58` | `EthrIconSize.xxLarge` | 58 |

> **API note**: `EthrIcon(size: ...)` takes a `double`, NOT the `EthrIconSize` enum. Convert with `.value.toDouble()`. To mirror an icon in RTL, use `flip: true` (NOT `matchTextDirection`). When `flip` is `null` (the default), `EthrIcon` auto-mirrors based on the active text direction.

```dart
// Numeric literal (most idiomatic for fixed-size icons)
EthrIcon(
  name: EthrIcons.chevronRight,
  size: 24,
  color: theme.contentBrandDefault,
  flip: true, // mirror in RTL — for arrows/chevrons. Omit for auto-detect.
)

// Token-based (when matching the Figma scale step)
EthrIcon(
  name: EthrIcons.chevronRight,
  size: EthrIconSize.small.value.toDouble(),
  color: theme.contentBrandDefault,
)
```

---

## Elevations / Shadows

Figma drop-shadow values map to `EthrElevations.elevation0` … `elevation11`. Pick the level whose blur/spread/y-offset most closely matches the Figma effect. If none match exactly, prefer the next level **down** (less heavy) — Ethr designs tend to favor subtle elevation.

```dart
Container(
  decoration: BoxDecoration(
    color: theme.backgroundNeutralPrimary,
    borderRadius: EthrBorderRadius.circular12,
    boxShadow: EthrElevations.elevation3,
  ),
  ...
)
```
