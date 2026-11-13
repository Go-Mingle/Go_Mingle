---
description: When implementing UI from a Figma design (or any new UI) in a Flutter project that depends on the Ethr SDK, use ONLY the Ethr SDK (flutter_ether_2) widgets and design tokens — never raw Material widgets for components, never hardcoded colors or sizes.
globs: lib/**/*.dart,example/lib/**/*.dart
alwaysApply: false
---

# Figma → Flutter: Use Ethr SDK Only

When converting a Figma design or building any UI in a Flutter project that depends on `flutter_ether_2`, every visible component MUST come from the Ethr SDK. Material widgets are allowed ONLY as non-visual layout primitives.

## Allowed Material widgets (layout only)

`Scaffold`, `AppBar`, `SafeArea`, `Row`, `Column`, `Stack`, `Wrap`, `Flex`, `Expanded`, `Flexible`, `SizedBox`, `Padding`, `Container`, `ListView`, `GridView`, `SingleChildScrollView`, `Align`, `Center`, `Positioned`, `ClipRRect`, `ClipOval`, `Transform`, `Opacity`, `Visibility`, `Builder`, `LayoutBuilder`.

## NEVER use raw Material — use the Ethr equivalent

| ❌ Material | ✅ Ethr |
|---|---|
| `Text(...)` | `EthrText(...)` / `EthrText.h3Bold('...')` |
| `Icon(Icons.*)` | `EthrIcon(name: EthrIcons.xxx)` |
| `ElevatedButton` / `FilledButton` / `OutlinedButton` / `TextButton` | `EthrButton(type: ButtonType.{primary,secondary,tertiary,danger})` |
| `IconButton` | `EthrIconButton` |
| `TextField` / `TextFormField` | `EthrInput` (or `EthrNumericInput`, `EthrPinInput`, `EthrTextAreaInput`, `EthrContactInput`) |
| `SearchBar` | `EthrSearchBar` |
| `Checkbox` | `EthrCheckbox` |
| `Switch` | `EthrToggle` |
| `Radio` / `RadioListTile` | `EthrRadioButton` / `EthrRadioButtonGroup` |
| `Slider` / `RangeSlider` | `EthrRangeSlider` |
| `Chip` / `FilterChip` / `ChoiceChip` / `ActionChip` | `EthrChip` |
| `Card` | `EthrBasicCard` / `EthrProductCard` / `EthrWalletCard` |
| `ListTile` | `EthrList` |
| `ExpansionTile` / `ExpansionPanel` | `EthrAccordionGroup` + `EthrAccordionDetail` |
| `Stepper` | `EthrStepper` |
| `BottomNavigationBar` / `NavigationBar` | `EthrBottomNavigation` |
| `Drawer` / `NavigationDrawer` | `EthrDrawerNavigation` |
| `TabBar` / `TabBarView` | `EthrTab` + `EthrTabView` |
| `AlertDialog` / `Dialog` / `SimpleDialog` | `EthrModal` |
| `showModalBottomSheet` / `BottomSheet` | `EthrBottomSheet` |
| `SnackBar` / `MaterialBanner` | `EthrSnackbar` |
| `CircularProgressIndicator` | `EthrLoader` |
| `LinearProgressIndicator` | `EthrProgressBar(type: ProgressBarType.linear)` |
| `Tooltip` | `EthrTooltip` |
| `Badge` | `EthrDefaultBadge` / `EthrCounterBadge` / `EthrDotBadge` |
| `CircleAvatar` | `EthrAvatar` |
| `CalendarDatePicker` / `showDatePicker` | `EthrCalendar` |
| `PageView` (as carousel) | `EthrCarousel<T>` |
| `DataTable` | `EthrTable` |
| `GestureDetector(onTap:)` styled tap target | `EthrPressable(onPress:)` |

## Hardcoded values are forbidden

```dart
// BAD
Container(
  color: const Color(0xFF1A6FE6),
  padding: const EdgeInsets.all(16),
  decoration: BoxDecoration(borderRadius: BorderRadius.circular(8)),
  child: const Text('Hello', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
)

// GOOD
Container(
  color: theme.backgroundBrandPrimaryAction,
  padding: const EdgeInsets.all(EthrPadding.padding16),
  decoration: BoxDecoration(borderRadius: EthrBorderRadius.circular8),
  child: EthrText.h5Bold('Hello', color: theme.contentNeutralInverse),
)
```

## Theme access pattern (every `build()`)

```dart
@override
Widget build(BuildContext context) {
  final theme = context.ethrThemeData;
  return Scaffold(
    backgroundColor: theme.backgroundNeutralPrimary,
    body: ...,
  );
}
```

Never use `Theme.of(context)` for component colors — always `context.ethrThemeData`.

## RTL safety

```dart
// BAD — breaks Arabic / Hebrew layouts
EdgeInsets.only(left: 8, right: 16)

// GOOD
EdgeInsetsDirectional.only(start: 8, end: 16)
```

For directional icons (arrows, chevrons), set `matchTextDirection: true`.

## Variants are enums, not strings

```dart
// BAD
EthrButton(title: 'Save', type: 'primary', size: 'large')

// GOOD
EthrButton(title: 'Save', type: ButtonType.primary, size: ButtonSize.large)
```

## Mutually-exclusive icon slots

Every Ethr component with an icon slot accepts EITHER a named icon OR a custom widget — never both:

```dart
// GOOD — named icon
EthrButton(title: 'Send', prefix: EthrIcons.send)

// GOOD — custom widget
EthrButton(title: 'Send', customPrefix: const MyAnimatedIcon())

// BAD — both set, will throw an assertion
EthrButton(title: 'Send', prefix: EthrIcons.send, customPrefix: const MyAnimatedIcon())
```

## No widget-building helper methods

```dart
// BAD
class _ScreenState extends State<Screen> {
  Widget _buildHeader() => Row(children: [...]);
  Widget _buildBody()   => Column(children: [...]);
  @override
  Widget build(BuildContext context) => Column(children: [_buildHeader(), _buildBody()]);
}

// GOOD — extract private widget classes
class _ScreenState extends State<Screen> {
  @override
  Widget build(BuildContext context) =>
      Column(children: const [_Header(), _Body()]);
}

class _Header extends StatelessWidget {
  const _Header();
  @override
  Widget build(BuildContext context) {
    final theme = context.ethrThemeData;
    return Row(children: [...]);
  }
}
```

## When user shares a Figma URL

1. Load the `figma-to-ethr-flutter` skill before generating any code.
2. Call the Figma MCP tools (`get_design_context`, `get_variable_defs`, `get_screenshot`) to read the design — never guess from the URL alone.
3. Map every Figma element to an Ethr widget per the skill's `COMPONENT_MAP.md`.
4. Map every Figma variable to an Ethr token per the skill's `TOKEN_MAP.md`.
5. Run `flutter analyze` on the new file before declaring done.
