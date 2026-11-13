---
name: figma-to-ethr-flutter
description: Convert Figma designs (built with the Ethr design system) into production Flutter code using ONLY the Ethr SDK (flutter_ether_2). Use this skill whenever the user provides a figma.com URL in a Flutter project that depends on flutter_ether_2, or when the user says "convert this Figma to Flutter", "implement this design", "build this screen from Figma", "generate Flutter from this Figma", or shares a Figma node URL referring to Ethr components.
---

# Figma → Ethr Flutter Code

Translates a Figma frame into a Flutter widget/screen using **only** `flutter_ether_2` components and design tokens. Works in any Flutter project that has `flutter_ether_2` as a dependency.

The agent uses the Figma MCP server (`get_design_context`, `get_metadata`, `get_screenshot`, `get_variable_defs`, `get_code_connect_map`) to read the design, then maps every visible element to an Ethr widget and every styling value to an Ethr token before writing a single line of Dart.

---

## Hard Rules — Never Break These

1. **Only Ethr widgets for visible UI.** Every visual element MUST be an `Ethr*` component. The only allowed non-Ethr widgets are layout primitives: `Scaffold`, `AppBar`, `SafeArea`, `Row`, `Column`, `Stack`, `Wrap`, `Expanded`, `Flexible`, `SizedBox`, `Padding`, `Container` (only for backgrounds/borders that no Ethr component provides), `ListView`, `SingleChildScrollView`, `Align`, `Center`, `Positioned`, `GestureDetector` (use `EthrPressable` whenever possible).
2. **Zero hardcoded colors.** Every color comes from `context.ethrThemeData.<token>`. `Color(0xFF...)` literals are FORBIDDEN.
3. **Zero hardcoded spacing/radius.** Every dp value comes from `EthrSpacing.spacingNN` / `EthrPadding.paddingNN` / `EthrBorderRadius.circularNN`.
4. **Zero raw `Text(...)`.** Use `EthrText(...)` or factory `EthrText.h3Bold(...)` etc.
5. **Zero raw icons.** Use `EthrIcon(name: EthrIcons.xxx)` for icon rendering.
6. **Zero Material UI controls.** Replace `ElevatedButton`, `TextField`, `Checkbox`, `Switch`, `Slider`, `AlertDialog`, `BottomSheet`, `Chip`, `Card`, `BottomNavigationBar`, `Drawer`, `TabBar`, `Tooltip`, `Snackbar`, `CircleAvatar`, `Badge`, `CircularProgressIndicator`, etc. with their Ethr equivalents (see [COMPONENT_MAP.md](COMPONENT_MAP.md)).
7. **RTL safe.** Use `EdgeInsetsDirectional.only(start:, end:)` — never `left/right`.
8. **Variants are enums.** `ButtonType.primary`, `ButtonSize.large`, `InputState.error` — never raw strings.
9. **No widget-building methods.** Never write `Widget _buildHeader()`. Extract a private `StatelessWidget` class instead (see Ethr Dart standards).

---

## Workflow — Follow Every Step in Order

### Step 1 — Validate the target project

1. Read `pubspec.yaml` at the workspace root. Confirm `flutter_ether_2` is in `dependencies:`.
   - **If missing**, stop and ask the user to add it. Prefer a tagged release (`flutter_ether_2: ^1.1.0`) over `ref: master` so the conversion is reproducible. For a local path, use `flutter_ether_2: { path: ../ethr-flutter-sdk }`.
2. Open `lib/main.dart` (or wherever the app entry lives). Confirm the app is wrapped with `EthrThemeProvider`.
   - **If not wrapped**, document this in your final output and provide a one-line diff to add it. Do not attempt to refactor the user's app entry without asking.
   - For a quickstart wrapper that does **not** require constructing an `EthrThemeController`, suggest:
     ```dart
     EthrThemeProvider.simple(
       themeMode: EthrThemeMode.light,
       child: MaterialApp(home: HomeScreen()),
     )
     ```
     Use the controller-based form only when the app needs to toggle theme/locale at runtime.
3. Read 1 existing screen in `lib/` to learn the project's file/naming conventions (folder layout, screen suffix `_screen.dart` vs `_page.dart`, theme access pattern).

### Step 2 — Parse the Figma URL

The user provides a URL like:
```
https://www.figma.com/design/abcDEF1234/MyDesign?node-id=12-345
```

Extract:
- **fileKey**: the segment after `/design/` (e.g. `abcDEF1234`).
  - For `figma.com/design/:fileKey/branch/:branchKey/...`, use `branchKey` as the fileKey.
  - For `figma.com/make/:makeFileKey/...`, use `makeFileKey`.
- **nodeId**: the value of `?node-id=...` with `-` converted to `:` (e.g. `12-345` → `12:345`).

If the user gives only a fileKey or pastes a URL with no `node-id`, call `get_metadata` first with `nodeId: "0:1"` (the page root) to discover frames, then ask the user which frame to convert.

### Step 3 — Pull design data via Figma MCP (in parallel)

Call these in a single batched message:
1. **`get_design_context`** — primary tool. Returns reference React+Tailwind code, screenshot, and contextual hints. Pass `clientFrameworks: "flutter"` and `clientLanguages: "dart"`.
2. **`get_variable_defs`** — design tokens used in this node, e.g. `{"color/brand/primary": "#1A6FE6", "spacing/m": 16}`.
3. **`get_code_connect_map`** — check whether any sub-nodes are already mapped to specific code components (rare for Flutter; common for Web teams).
4. **`get_screenshot`** — only call separately if the screenshot inside `get_design_context` was excluded due to size. Use this as the visual ground truth when you're unsure.

If the Figma frame is large/complex, also call **`get_metadata`** to see the full node tree, then drill into children one at a time with `get_design_context`.

### Step 4 — Build the translation plan (think before coding)

Walk every element in the design and produce an in-memory mapping table. For each node, decide:

| Question | How to answer |
|---|---|
| Which Ethr widget? | Match name + visual shape against [COMPONENT_MAP.md](COMPONENT_MAP.md). When in doubt, prefer the component whose name matches the Figma layer name (Ethr Figma libraries usually mirror SDK naming). |
| Which variant/enum? | Read the Figma component's variant properties (e.g. `Type=Primary, Size=Large, State=Default`) and translate to the matching Dart enum. |
| Which design tokens? | Look up Figma variable names (e.g. `color/brand/primary`, `spacing/m`) in [TOKEN_MAP.md](TOKEN_MAP.md) to get the Ethr equivalent (`theme.backgroundBrandPrimaryAction`, `EthrSpacing.spacing8`). |
| Which layout primitive? | `Row` for horizontal autolayout, `Column` for vertical, `Stack` for absolute positioning / overlapping nodes, `Wrap` for wrapping flex. |
| Which paddings/gaps? | Autolayout `padding` → `Padding(padding: EdgeInsets.all(EthrPadding.padding16))`. Autolayout `gap` → `SizedBox(width/height: EthrSpacing.spacingN)` between children, or `Wrap(spacing: ...)` / `Flex` `gap`. |

If a Figma element has no Ethr equivalent (rare): use the closest layout primitive (`Container`) styled with Ethr tokens, never a Material widget. Flag it in the final output.

> **Before writing a single line of Dart**, scan the "Common API Foot-Guns" table in [COMPONENT_MAP.md](COMPONENT_MAP.md#common-api-foot-guns--memorize-before-generating). Roughly half of the prop names you'd guess from the React Native SDK or from typical Flutter conventions are slightly different in Ethr (e.g. `EthrToggle.toggleSize`, `EthrPagination.paginationType`, `EthrAvatar.image`). Memorize the table; it is the single biggest source of compile errors in fresh conversions.

### Step 5 — Decide the output file path

Match the existing project layout. Common patterns:

| Output | Path |
|---|---|
| Full screen | `lib/screens/<name>_screen.dart` (or `lib/pages/<name>_page.dart` if the project uses that) |
| Reusable widget | `lib/widgets/<name>.dart` |
| Feature-scoped | `lib/features/<feature>/presentation/<name>_screen.dart` (Clean Architecture projects) |

If the project has no obvious convention, default to `lib/screens/<name>_screen.dart` and tell the user.

### Step 6 — Generate the Dart file

Required scaffolding (see [EXAMPLES.md](EXAMPLES.md) for full converted screens):

```dart
import 'package:flutter/material.dart';
import 'package:flutter_ether_2/flutter_ether_2.dart';

class <Name>Screen extends StatelessWidget {
  const <Name>Screen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = context.ethrThemeData;
    return Scaffold(
      backgroundColor: theme.backgroundNeutralPrimary,
      appBar: AppBar(
        backgroundColor: theme.backgroundNeutralPrimary,
        elevation: 0,
        leading: EthrIconButton(
          name: EthrIcons.arrowLeft, // (`iconName:` is deprecated; use `name:` going forward)
          type: IconButtonType.tertiary,
          onPress: () => Navigator.pop(context),
        ),
        title: EthrText.h5Bold('Screen Title', color: theme.contentNeutralPrimary),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(EthrPadding.padding16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ... mapped Ethr widgets here
            ],
          ),
        ),
      ),
    );
  }
}
```

Use a `StatefulWidget` only if the screen owns local state (form values, selected tab, etc.).

### Step 7 — Self-review checklist (run through every item)

- [ ] No `Color(0x...)` literals — every color is `theme.<token>`
- [ ] No raw int dp values — every dp comes from `EthrSpacing.*` / `EthrPadding.*` / `EthrBorderRadius.*`
- [ ] No raw `Text(...)` — only `EthrText(...)` or `EthrText.<factory>(...)`
- [ ] No `Icon(...)` from Material — only `EthrIcon(name: EthrIcons.xxx)`
- [ ] No Material controls (`ElevatedButton`, `TextField`, `Checkbox`, `Switch`, `Slider`, `Card`, `Chip`, `BottomNavigationBar`, `AlertDialog`, `Drawer`, `TabBar`, `SnackBar`, `CircularProgressIndicator`, `LinearProgressIndicator`, `CircleAvatar`, `Badge`, `Tooltip`) — every one replaced with the Ethr equivalent (see [COMPONENT_MAP.md](COMPONENT_MAP.md))
- [ ] All directional padding uses `EdgeInsetsDirectional.only(start:, end:)`
- [ ] Variant strings (size, type, state, shape) are enums, not raw strings
- [ ] Mutually-exclusive icon slots (`prefix` vs `customPrefix`) are not both set
- [ ] No widget-building helper methods — extracted into private `StatelessWidget` classes
- [ ] `final theme = context.ethrThemeData;` is the first line of every `build()`
- [ ] Imports are clean (`package:flutter_ether_2/flutter_ether_2.dart`, `package:flutter/material.dart` only for primitives)
- [ ] Use the **current** APIs (no deprecation warnings, no compile errors). Cross-check every component call against the "Common API Foot-Guns" table in [COMPONENT_MAP.md](COMPONENT_MAP.md#common-api-foot-guns--memorize-before-generating). The most common drifts:
  - `EthrIconButton(name: ...)`  not `iconName:`
  - `EthrCheckbox(value: ..., onChanged: (next) => ...)`  not `checked:` / `onPressed:`
  - `EthrToggle(toggleSize: ...)` not `size:` (the rest of the SDK uses `size:` — toggle is the exception)
  - `EthrIcon(size: 24, flip: true)` — `size` is a `double`, NOT the `EthrIconSize` enum; the RTL-mirror prop is `flip:`, NOT `matchTextDirection:`
  - `EthrAvatar(image: url)` not `imageUrl:`
  - `EthrLogos(logoShape: ..., logoSize: ...)` not `shape:` / `size:`
  - `EthrCounterBadge(BadgeStyle: ..., colour: ...)` — capital `B`, British `colour`
  - `EthrChip(counterBadge: ..., actionIcon: ...)` not `counter:` / `action:`
  - `EthrLoader(platform: LoaderPlatform.ios)` (lowercase, no `custom` value)
  - `EthrList(listStyle: ..., divider: DividerConfig(size: DividerSize.full))`
  - `EthrPagination(paginationType: ...)` not `type:`
  - `EthrBottomNavigation(tabs: ..., onTabSelected: ...)` not `items:` / `onTap:`
  - `EthrCarousel(data: list, stepperType: CarouselStepperType.dotStepper)` not `items:` / `dot`
  - `AccordionVariant.defaultVariant` / `AccordionSpacing.defaultSpacing` (`default` is reserved)
  - For password fields: `EthrInput(obscureText: true, obscureToggle: true)` instead of wiring up `suffix` + `setState` manually
  - `EthrIcons.visibility` / `EthrIcons.visibilityOff` (canonical) — `EthrIcons.eye` / `eyeSlash` are aliases

### Step 8 — Run the linter

```bash
flutter analyze <path/to/new_file.dart>
```

Fix every error and warning before declaring done. Common fixes:
- Missing `const` on constructor calls → add `const`
- Unused imports → remove
- Switch on enum missing cases → add the missing enum value branches

### Step 9 — Report back to the user

Summarize:
1. **File created**: full path
2. **Figma node converted**: `fileKey/nodeId` and the screen/component name
3. **Ethr components used**: bullet list (`EthrButton`, `EthrInput`, `EthrAvatar`, ...)
4. **Substitutions made**: any Figma element that didn't have a 1:1 Ethr match, and what you used instead
5. **Open questions**: any data the design implied (e.g. `onPress` handlers, dynamic content) that the user must wire up
6. **SDK pin**: include a one-liner footer like `Generated against flutter_ether_2 @ <ref-or-tag>` so future debugging has an audit trail. Read the resolved git ref from the project's `pubspec.lock`.

Provide a one-paragraph "How to use it" snippet showing how to navigate to the new screen.

---

## Reference Material (read on demand)

| Need | File |
|---|---|
| Full Figma element → Ethr widget mapping (every Ethr component listed) | [COMPONENT_MAP.md](COMPONENT_MAP.md) |
| Figma variable / hex value → Ethr design token | [TOKEN_MAP.md](TOKEN_MAP.md) |
| Worked before/after conversion examples | [EXAMPLES.md](EXAMPLES.md) |

> **Companion rule**: this workflow is reinforced by `docs/agents/rules/ethr-figma-to-flutter.md`. If the rule file is missing in the target project, you may copy it from the Ethr SDK repo to ensure the agent enforces "Ethr-only" widget choice on every future edit.
