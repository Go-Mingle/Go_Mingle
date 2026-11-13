# Figma → Ethr Component Map

The complete reference for picking the right `Ethr*` widget from a Figma layer name or visual pattern. **Every visible UI element in a Figma frame must map to one of the rows below.** If you can't find a match, use `Container` with Ethr tokens — never a Material widget.

---

## Picking the Right Component (by Figma layer name)

Figma component libraries built on Ethr usually name layers with the SDK component name (e.g. `Button / Primary / Large`, `Input / Outlined / Error`). Match the **first segment** of the layer name to the table below.

### Buttons & touchables

| Figma layer | Ethr widget | Key enums / props |
|---|---|---|
| `Button` | `EthrButton` | `size: ButtonSize.{small,medium,large,xLarge}`, `type: ButtonType.{primary,secondary,tertiary,danger}`, `shape: ButtonShape.{rectangular,rounded,circle}`, `state: ButtonState.{defaultState,pressed,disabled}`, `prefix`/`suffix` (icon name), `isLoading`, `fullWidth` |
| `IconButton` / `Icon Button` | `EthrIconButton` | `name: EthrIcons.xxx` (NOT `iconName:` — that is deprecated), `size: IconButtonSize.{small,medium,large,xLarge}`, `type: IconButtonType.{primary,secondary,tertiary}`, `shape: IconButtonShape.{rectangular,rounded}`, `state: IconButtonState.{defaultState,pressed,disabled}`, `isFAB: bool`, `onPress` |
| `LogoButton` / `Logo Button` | `EthrLogoButton` | `size: LogoButtonSize.*`, `shape: LogoButtonShape.*`, `logoPosition: LogoPosition.{prefix,suffix}` |
| `SocialButton` / Social sign-in tile | `EthrSocialButton` | per-provider variant |
| Generic touchable wrapper / clickable area | `EthrPressable` | `onPress`, `child` |

### Inputs

| Figma layer | Ethr widget | Key enums |
|---|---|---|
| `Input` / `TextField` | `EthrInput` | `theme: InputTheme.{filled,outlined}`, `state: InputState.{defaultState,focused,typing,typed,error,success,disabled}`, `optionality: InputOptionality.{optional,mandatory,none}`, `prefix`/`suffix`, `clearTextEnabled`, `count` (char limit), `obscureText`, `obscureToggle` (auto password-visibility toggle) |
| `Numeric Input` / number field | `EthrNumericInput` | mirrors `EthrInput` |
| `Text Area Input` / multi-line input | `EthrTextAreaInput` | — |
| `Pin Input` / OTP / passcode field | `EthrPinInput` | — |
| `Contact Input` / phone with country picker | `EthrContactInput` | `theme: ContactInputTheme.*`, `dropdownStyle: ContactDropdownStyle.{textAndVisual,textOnly,visualOnly}`, `dropdownType: ContactDropdownType.{prefix,suffix}`, `flagShape: ContactFlagShape.{circle,rectangle}` |
| `Search Bar` / search field | `EthrSearchBar` | — |
| `Range Slider` / dual-thumb slider | `EthrRangeSlider` | — |
| `Toggle` / switch / on-off | `EthrToggle` | `toggleState: bool?` (current state), `onToggleChange: ValueChanged<bool>?` (next state), `toggleSize: ToggleSize.{small,medium,large}` (note: `toggleSize:`, NOT `size:`), `direction: ToggleDirection.{left,right}`. |
| `Checkbox` | `EthrCheckbox` | `value: bool` (current state), `onChanged: ValueChanged<bool?>?` (next state), `size: CheckboxSize.{small,medium}` (only two sizes!), `state: CheckboxState.{defaultState,hover,disabled}`, `shape: CheckboxShape.{rectangular,circle}`, `labelText: String`, `partial: bool` (indeterminate). Note: `checked:` / `onPressed:` are deprecated aliases. |
| `Radio Button` (single) | `EthrRadioButton` | — |
| `Radio Button Group` (group) | `EthrRadioButtonGroup` | — |
| `Rating Input` (interactive star rating) | `EthrRatingInput` | `size: RatingInputSize.{xSmall,small,medium,large}`, `alignment: RatingInputAlignment.{left,center}` |
| `Dropdown` / select / picker | `EthrDropdown` | — |
| `Prompt Bar` / AI input bar | `EthrPromptBar` | `state: PromptBarState.{defaultState,listening,generating}`, `sendType: PromptBarSendType.{icon,button}` |

### Text & icons

| Figma layer | Ethr widget | Notes |
|---|---|---|
| `Text` / `Heading` / `Body` / any text | `EthrText` | use factory `EthrText.h1Bold(...)` … `EthrText.bodySmall(...)` OR `EthrText('...', typography: EthrTypography.headingH3Semibold)` |
| `Text Block` / multi-line content block | `EthrTextBlock` | — |
| `Icon` (any single glyph) | `EthrIcon` | `name: EthrIcons.xxx`, `size: <double>` (e.g. `24` or `EthrIconSize.small.value.toDouble()` — accepts a `double`, NOT the `EthrIconSize` enum directly), `color: theme.<token>`, `flip: true` for arrows/chevrons that should mirror in RTL (NOT `matchTextDirection:` — that prop does not exist; `flip` defaults to auto-detect). Available `EthrIconSize` values: `xxSmall(16) / xSmall(20) / small(24) / medium(32) / large(40) / xLarge(48) / xxLarge(58)`. |
| `Styled Icon` / icon with colored container background | `EthrStyledIcon` | — |
| `Logo` / brand logo (Google, Apple, etc.) | `EthrLogos` | `name: EthrLogoNames.{google,apple,facebook,instagram,twitter}`, `logoShape: LogoShape.{simple,circle,square}` (note: `logoShape:`, NOT `shape:`), `logoSize: LogoSize.{xxSmall,xSmall,small,medium,large,xLarge}` (note: `logoSize:`, NOT `size:`) |
| `Flag` / country flag | `EthrFlag` | — |

### Display, badges, indicators

| Figma layer | Ethr widget | Notes |
|---|---|---|
| `Avatar` (single) | `EthrAvatar` | `type: AvatarType.{image,initials,icon,placeholder}`, `size: AvatarSize.{xsmall,small,medium,large,xlarge}` (all lowercase!), `shape: AvatarShape.{rounded,rectangular}`, `badge: AvatarBadge.{counter,dotStatus,iconStatus,none}`, `image: <url-or-ImageProvider>` (NOT `imageUrl:`), `initials: 'AB'`, `icon: EthrIcons.xxx` |
| `Avatar Group` (overlapping avatars) | `EthrAvatarGroup` | max visible + overflow counter |
| `Badge` (label badge) | `EthrDefaultBadge` | `size: DefaultBadgeSize.*`, `type: DefaultBadgeType.{duotone,outline,filled,ghost}`, `shape: DefaultBadgeShape.{rounded,rectangular}`, `color: DefaultBadgeColor.*` |
| `Dot Badge` / status dot | `EthrDotBadge` | — |
| `Counter Badge` / numeric pill | `EthrCounterBadge` | `changeNumber: int` (the value, REQUIRED), `BadgeStyle: CounterBadgeStyle.{ghost,duotone,filled}` (note: `BadgeStyle:` with capital `B` — matches the React Native prop name), `size: CounterBadgeSize.{medium,large}` (only two sizes!), `shape: CounterBadgeShape.{rounded,rectangular}`, `colour: CounterBadgeColor.*` (British spelling) |
| `Calendar Badge` / date chip | `EthrCalendarBadge` | `size: CalendarBadgeSize.{small,medium,large}` |
| `Chip` (selectable tag) | `EthrChip` | `label: String` (REQUIRED), `state: ChipState.{defaultState,hover,selected,dragged,disabled}`, `size: ChipSize.{small,medium,large}`, `shape: ChipShape.{rounded,rectangular}`, `colour: ChipColour.{danger,success,warning,featured,primary,neutral}` (British spelling), `prefix:` accepts an `IconName` directly (e.g. `EthrIcons.star`) or a `ChipPrefix.{placeholder,initials,none}`, `counterBadge: int?` (NOT `counter:`), `actionIcon: IconName?` (NOT `action:`), `customAction: Widget?`, `onPress: VoidCallback?` |
| `Tooltip` / popover hint | `EthrTooltip` | `colour: TooltipColour.*`, `placement: TooltipPlacement.*` |
| `Popover` / floating panel | `EthrPopover` | — |
| `Loader` / spinner | `EthrLoader` | `size: LoaderSize.{xSmall,small,medium,large,xLarge}`, `platform: LoaderPlatform.{auto,ios,android}` (lowercase `ios`; there is no `custom` value — pass `custom: true` plus `customSource:` or `customComponent:` instead) |
| `Skeleton Loader` / shimmer placeholder | `EthrSkeletonLoader` | sub: `EthrSkeletonItem`, `EthrSkeletonText`, `EthrSkeletonListItem`, `EthrSkeletonAvatar`, `EthrSkeletonCard` |
| `Progress Bar` (linear) | `EthrProgressBar` | `type: ProgressBarType.{linear,segmented}`, `size: ProgressBarSize.*` |
| `Rating View` (read-only stars) | `EthrRatingView` | `size: RatingViewSize.*`, `type: RatingViewType.{single,multi}` |
| `Score Card` / numeric stat card | `EthrScoreCard` | — |
| `Map Pin` / marker | `EthrMapPin` | `size: MapPinSize.{small,medium,large}`, `shape: MapPinShape.{rectangle,circle}` (note: `rectangle`, not `rectangular`), `state: MapPinState.{defaultState,pressed,disabled}`, `appearance: MapPinAppearance.{defaultAppearance,detailed}` |

### Cards, containers, lists

| Figma layer | Ethr widget | Notes |
|---|---|---|
| `Divider` / `Separator` / `OR rule` | `EthrDivider` | `orientation: DividerOrientation.{horizontal,vertical}`, `size: EthrDividerSize.{thin,thick}`, `label: String?` (e.g. `'OR'`) or `customLabel: Widget?`, `color: Color?` (defaults to `theme.borderNeutralPrimary`). For between-list-row separators, prefer `EthrList(dividerSize: DividerSize.{full,half})`. |
| `Card` / generic card | `EthrBasicCard` | `imagePlacement: CardImagePlacement.*`, `footerType: CardFooterType.*` |
| `Product Card` / e-commerce card | `EthrProductCard` | `imagePosition: ProductCardImagePosition.{none,top,left,right}`, `size: ProductCardSize.*`, `footerType: ProductCardFooterType.{button,buttonGroup,counter,outOfStock}`, `secondaryInfoType: ProductCardSecondaryInfoType.*` |
| `Wallet Card` / payment / membership card | `EthrWalletCard` | `layout: WalletCardLayout.{horizontal,vertical}`, `namePosition: WalletCardNamePosition.{top,bottom}` |
| `Media Block` / image+caption block | `EthrMediaBlock` | `type: MediaBlockType.*`, `aspectRatio: MediaAspectRatio.*` |
| `List Item` / single row | `EthrList` | `state: ListState.{defaultState,disabled}`, `listStyle: ListStyle.{filled,outlined}` (note: prop is `listStyle:`, NOT `style:`). Slots: `prefix: IconName?`, `suffix1: IconName?`, `suffix2: IconName?` (and `customPrefix`, `customSuffix1`, `customSuffix2`), `primaryText`, `secondaryText`, `label`, `titleText`. Inter-row separator: `divider: DividerConfig(size: DividerSize.{full,half})` (NOT a top-level `dividerSize:`). |
| `Flat List` / scrollable list of items | `EthrFlatList` | wrap items in builder |
| `Accordion` / expandable | `EthrAccordionGroup` (container) + `EthrAccordionDetail` (single panel) | `variant: AccordionVariant.{defaultVariant,filled}`, `spacing: AccordionSpacing.{defaultSpacing,compact}`, `state: AccordionState.{defaultState,disabled}`, `expanderPosition: ExpanderPosition.{left,right}` |
| `Table` / data grid | `EthrTable` | — |
| `Pagination` / page numbers | `EthrPagination` | `totalPages: int`, `currentPage: int` (1-based), `onPageChange: ValueChanged<int>`, `paginationType: PaginationType.{number,grid,results}` (note: `paginationType:`, NOT `type:`), `controlType: PaginationControlType.{none,icons,buttons,customInstance}`, `shape: PaginationShape.{circle,square,bordered}`, `paginationPosition: PaginationPosition.{left,center,right}` |
| `Stepper` / multi-step progress | `EthrStepper` | `stepType: StepType.{number,icon,bullet}`, `state: EthrStepState.*`, `size: StepSize.{small,medium}`, `orientation: StepOrientation.{vertical,horizontal}` |

### Navigation, headers, layout

| Figma layer | Ethr widget | Notes |
|---|---|---|
| `Basic Header` / top app bar / page header | `EthrBasicHeader` | `type: BasicHeaderType.{aligned,centered,stacked,brandLogo}`, `customCenter: Widget?` (required for `brandLogo` — drop in your logo / breadcrumb / search field). Wrap inside `Scaffold(appBar: ...)` only when needed; otherwise place at top of `body`. |
| `Bottom Navigation` / tab bar at bottom | `EthrBottomNavigation` | `tabs: List<EthrTabItem>` (NOT `items:`), `initialRouteName: String?` (defaults to first tab's `name`; NOT `currentIndex:`), `onTabSelected: ValueChanged<int>?` (NOT `onTap:`). `EthrTabItem(name:, page:, icon: IconName?, customIcon: Widget?, badgeCount: int?)` |
| `Drawer` / side drawer / hamburger menu | `EthrDrawerNavigation` | — |
| `Tabs` / segmented control / top tabs | `EthrTab` (header) + `EthrTabView` (body) | `style: TabStyle.{rounded,lined}`, `size: TabSize.{small,medium,large}` |
| `Carousel` / slider / image gallery | `EthrCarousel<T>` | `data: List<T>` (NOT `items:`), `renderItem: Widget Function(BuildContext, T, int)`, `autoPlay: bool`, `loop: bool`, `stepperType: CarouselStepperType.{dotStepper,text,progressBar}` (note: `dotStepper`, NOT `dot`), `layout: CarouselLayout.{fullWidth,hero,twoColumn}`, `onChangeIndex: ValueChanged<int>?` |
| `Carousel With Overlay` / slide with overlay text | `EthrCarouselOverlay` | — |

### Overlays & feedback

| Figma layer | Ethr widget | Notes |
|---|---|---|
| `Modal` / dialog / alert | `EthrModal` | shown via `showDialog(builder: (_) => EthrModal(...))` |
| `Bottom Sheet` / drawer from bottom | `EthrBottomSheet` | shown via `showModalBottomSheet(builder: (_) => EthrBottomSheet(...))`. Header: `EthrBottomSheetHeader`. Footer: `EthrBottomSheetFooter` with `orientation: FooterOrientation.{horizontal,vertical}` |
| `Snackbar` / toast | `EthrSnackbar` | `type: SnackbarType.{defaultType,success,warning,danger}`, `position: SnackbarPosition.{top,bottom}` |

### Calendar & date

| Figma layer | Ethr widget | Notes |
|---|---|---|
| `Calendar` / date picker | `EthrCalendar` | `view: CalendarView.{month,range,months,years,agenda}`, `size: CalendarSize.*` |
| `Calendar Badge` / day chip | `EthrCalendarBadge` | (see badges section) |

### Charts & data viz

| Figma layer | Ethr widget |
|---|---|
| `Line Chart` | `EthrLineChart` |
| `Area Chart` | `EthrAreaChart` |
| `Stacked Area Chart` | `EthrStackedAreaChart` |
| `Bar Chart` (basic) | `EthrBasicBarChart` |
| `Bar Chart` (grouped) | `EthrGroupedBarChart` |
| `Bar Chart` (stacked) | `EthrStackedBarChart` |
| `Column Chart` (basic) | `EthrBasicColumnChart` |
| `Column Chart` (grouped) | `EthrGroupedColumnChart` |
| `Column Chart` (stacked) | `EthrStackedColumnChart` |
| `Pie Chart` | `EthrPieChart` |
| `Donut Chart` | `EthrDonutChart` |
| Chart legend | `EthrCartesianLegendWrapper` / `EthrCircularLegendWrapper` |

### Chat & AI

| Figma layer | Ethr widget |
|---|---|
| `Chat Bubble` (user/AI) | `EthrChatBubble` — `type: ChatBubbleType.{user,ai}`, `messageType: ChatMessageType.*`, `status: ChatMessageStatus.{pending,sent,delivered,failed}` |
| AI prompt input bar | `EthrPromptBar` (see Inputs) |

---

## Forbidden Material Widget → Ethr Replacement

If you see any of the LEFT-column widgets in scaffolding code or generated React reference, REPLACE with the RIGHT-column Ethr widget.

| ❌ Material / Cupertino | ✅ Ethr |
|---|---|
| `Text(...)` | `EthrText(...)` / `EthrText.h3Bold(...)` |
| `RichText(...)` | `EthrText(...)` with composed strings, or multiple `EthrText` widgets in a `Wrap`/`Row` |
| `Icon(Icons.xxx)` / `Icon(IconData(...))` | `EthrIcon(name: EthrIcons.xxx)` |
| `ElevatedButton`, `FilledButton`, `OutlinedButton`, `TextButton`, `CupertinoButton` | `EthrButton(type: ButtonType.{primary,secondary,tertiary,danger})` |
| `IconButton`, `CupertinoButton.icon` | `EthrIconButton(name: EthrIcons.xxx)` |
| `TextField`, `TextFormField`, `CupertinoTextField` | `EthrInput` (or specialized `EthrNumericInput`, `EthrPinInput`, `EthrTextAreaInput`, `EthrContactInput`) |
| `SearchBar`, `SearchAnchor` | `EthrSearchBar` |
| `Checkbox`, `CheckboxListTile` | `EthrCheckbox` |
| `Switch`, `SwitchListTile`, `CupertinoSwitch` | `EthrToggle` |
| `Radio`, `RadioListTile` | `EthrRadioButton` (single) / `EthrRadioButtonGroup` (group) |
| `Slider`, `RangeSlider`, `CupertinoSlider` | `EthrRangeSlider` |
| `Chip`, `ActionChip`, `FilterChip`, `ChoiceChip`, `InputChip` | `EthrChip` |
| `Card` | `EthrBasicCard` (generic) / `EthrProductCard` / `EthrWalletCard` |
| `ListTile` | `EthrList` |
| `ExpansionTile`, `ExpansionPanel` | `EthrAccordionGroup` + `EthrAccordionDetail` |
| `Stepper`, `Step` | `EthrStepper` |
| `BottomNavigationBar`, `NavigationBar` | `EthrBottomNavigation` |
| `Drawer`, `NavigationDrawer` | `EthrDrawerNavigation` |
| `TabBar`, `TabBarView` | `EthrTab` (header) + `EthrTabView` (body) |
| `AlertDialog`, `Dialog`, `SimpleDialog`, `CupertinoAlertDialog` | `EthrModal` |
| `BottomSheet`, `showModalBottomSheet`, `CupertinoActionSheet` | `EthrBottomSheet` |
| `SnackBar`, `MaterialBanner` | `EthrSnackbar` |
| `CircularProgressIndicator`, `CupertinoActivityIndicator` | `EthrLoader` |
| `LinearProgressIndicator` | `EthrProgressBar(type: ProgressBarType.linear)` |
| `Tooltip` | `EthrTooltip` |
| `Divider`, `VerticalDivider` | `EthrDivider` |
| `Badge` | `EthrDefaultBadge` / `EthrCounterBadge` / `EthrDotBadge` |
| `CircleAvatar`, `Image.network` (when used as avatar) | `EthrAvatar` |
| `CalendarDatePicker`, `showDatePicker` | `EthrCalendar` |
| `PageView` (used as carousel) | `EthrCarousel<T>` |
| `DataTable` | `EthrTable` |
| `Image.network` for product / wallet cards | `EthrBasicCard` / `EthrProductCard` / `EthrWalletCard` |
| `GestureDetector(onTap:...)` for styled tap target | `EthrPressable(onPress: ...)` |

---

## Common API Foot-Guns — Memorize Before Generating

These are the named-parameter mismatches that look right but won't compile. Pin them in your mental model — every one of these has bitten an integration before.

| ❌ Looks reasonable | ✅ Actual API | Component |
|---|---|---|
| `EthrIconButton(iconName: ...)` | `EthrIconButton(name: ...)` | `EthrIconButton` (legacy `iconName:` is deprecated) |
| `EthrCheckbox(checked: x, onPressed: () => ...)` | `EthrCheckbox(value: x, onChanged: (next) => ...)` | `EthrCheckbox` (legacy props deprecated) |
| `EthrToggle(size: ToggleSize.medium)` | `EthrToggle(toggleSize: ToggleSize.medium)` | `EthrToggle` |
| `EthrIcon(size: EthrIconSize.small)` | `EthrIcon(size: 24)` or `size: EthrIconSize.small.value.toDouble()` | `EthrIcon` (`size` is `double?`) |
| `EthrIcon(matchTextDirection: true)` | `EthrIcon(flip: true)` | `EthrIcon` |
| `EthrLogos(shape: ..., size: ...)` | `EthrLogos(logoShape: ..., logoSize: ...)` | `EthrLogos` |
| `EthrAvatar(imageUrl: url)` | `EthrAvatar(image: url)` | `EthrAvatar` (`image` is `dynamic` — accepts URL string or `ImageProvider`) |
| `EthrCounterBadge(style: CounterBadgeStyle.filled, color: ...)` | `EthrCounterBadge(BadgeStyle: ..., colour: ...)` | `EthrCounterBadge` (capital `B`, British `colour:`) |
| `EthrChip(counter: 5, action: EthrIcons.close)` | `EthrChip(counterBadge: 5, actionIcon: EthrIcons.close)` | `EthrChip` |
| `EthrLoader(platform: LoaderPlatform.iOS)` | `EthrLoader(platform: LoaderPlatform.ios)` | `EthrLoader` (lowercase `ios`; no `custom` value — use `custom: true` with `customSource:` / `customComponent:`) |
| `EthrList(style: ListStyle.filled, dividerSize: ...)` | `EthrList(listStyle: ListStyle.filled, divider: DividerConfig(size: DividerSize.full))` | `EthrList` |
| `EthrPagination(type: PaginationType.number)` | `EthrPagination(paginationType: PaginationType.number)` | `EthrPagination` |
| `EthrBottomNavigation(items: ..., currentIndex: i, onTap: ...)` | `EthrBottomNavigation(tabs: ..., initialRouteName: 'Home', onTabSelected: ...)` | `EthrBottomNavigation` |
| `EthrCarousel(items: list, stepperType: CarouselStepperType.dot)` | `EthrCarousel(data: list, stepperType: CarouselStepperType.dotStepper)` | `EthrCarousel<T>` |
| `EthrInput(suffix: EthrIcons.eye, ...manual setState plumbing)` | `EthrInput(obscureText: true, obscureToggle: true)` | `EthrInput` (auto password reveal) |
| `EthrAccordionGroup(variant: AccordionVariant.default)` | `... AccordionVariant.defaultVariant` | `EthrAccordion*` (`default` is a Dart keyword) |
| `EthrAccordionGroup(spacing: AccordionSpacing.default)` | `... AccordionSpacing.defaultSpacing` | `EthrAccordion*` |
| `EthrText.h5Bold('...')` *(was previously missing)* | Now ships as a factory ✓ — also `h4Bold`, `h6Bold`, `bodyLargeEmphasis`, `bodySmallEmphasis` | `EthrText` |

> If you can't find a documented variant, prefer `EthrText('...', typography: EthrTypography.<token>)` over inventing a factory — every typography token in the design system is reachable through the `EthrTypography` class.

---

## Theme Provider Quickstart

Apps that just want a working theme can skip building an `EthrThemeController`:

```dart
// main.dart
import 'package:flutter/material.dart';
import 'package:flutter_ether_2/flutter_ether_2.dart';

void main() {
  runApp(
    EthrThemeProvider.simple(
      themeMode: EthrThemeMode.light, // EthrThemeMode is a typedef alias for ThemeModes
      child: MaterialApp(home: HomeScreen()),
    ),
  );
}
```

Inside any descendant `build()`:

```dart
final theme = context.ethrThemeData;       // throws if EthrThemeProvider is missing
final theme = context.ethrThemeDataOrNull; // null-safe variant for shared widgets
```

Use `EthrThemeProvider(controller: ...)` (the controller-based form) only when the app needs to flip theme mode / locale at runtime.

---

## Allowed Non-Ethr Widgets (Layout Only)

These are **always allowed** because they have no visual styling of their own:

`Scaffold`, `AppBar` (with Ethr children), `SafeArea`, `Row`, `Column`, `Stack`, `Wrap`, `Flex`, `Expanded`, `Flexible`, `SizedBox`, `Padding`, `Container` (only when no Ethr container fits — must use Ethr tokens for color/border/radius), `ListView`, `GridView`, `SingleChildScrollView`, `CustomScrollView`, `Sliver*`, `Align`, `Center`, `Positioned`, `Transform`, `Opacity`, `ClipRRect`, `ClipOval`, `ClipPath`, `Visibility`, `AnimatedContainer`, `AnimatedOpacity`, `Builder`, `LayoutBuilder`, `MediaQuery`.

> **Container guard**: if you reach for `Container(decoration: BoxDecoration(...))`, first check whether `EthrBasicCard`, `EthrAccordionDetail`, `EthrList`, or another Ethr container would do the job. Only use raw `Container` for purely structural backgrounds with no semantic component meaning.
