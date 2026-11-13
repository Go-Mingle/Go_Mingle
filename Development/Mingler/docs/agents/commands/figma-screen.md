Convert the Figma design at the URL provided in this message into a Flutter screen or widget using the Ethr SDK (`flutter_ether_2`).

Load and follow the `figma-to-ethr-flutter` skill end-to-end. Honor the `ethr-figma-to-flutter` rule on every line of generated code.

## Step-by-step (do not skip any step)

1. Read `docs/agents/skills/figma-to-ethr-flutter/SKILL.md` and treat it as the master workflow.
2. Validate the target project:
   - `pubspec.yaml` exists at the workspace root and lists `flutter_ether_2` under `dependencies:` — if missing, STOP and ask the user to add it.
   - `lib/main.dart` (or app entry) wraps the app in `EthrThemeProvider` — if not, flag this in the final summary.
3. Parse the Figma URL from this message:
   - Extract `fileKey` from the URL segment after `/design/` (or `branchKey` for branch URLs).
   - Extract `nodeId` from `?node-id=...` and convert `-` to `:` (e.g. `12-345` → `12:345`).
   - If no `node-id` is provided, call `get_metadata` on `0:1` first and ask the user which frame to convert.
4. Call the Figma MCP tools in parallel (single batched message):
   - `get_design_context` with `clientFrameworks: "flutter"`, `clientLanguages: "dart"`
   - `get_variable_defs`
   - `get_code_connect_map`
   - (`get_screenshot` only if the screenshot was excluded due to size)
5. Build an in-memory translation plan:
   - For every visible element, choose the matching Ethr widget per `docs/agents/skills/figma-to-ethr-flutter/COMPONENT_MAP.md`.
   - For every Figma variable, choose the matching semantic token per `docs/agents/skills/figma-to-ethr-flutter/TOKEN_MAP.md` (use `theme.<token>`, never `EthrColors.*` primitives).
   - For every dp value, pick the closest `EthrSpacing.*` / `EthrPadding.*` / `EthrBorderRadius.*` step.
   - For every Figma text style, pick the matching `EthrTypography.*` (or use an `EthrText.*` factory).
   - For every icon, pick the matching `EthrIcons.*` constant and `EthrIconSize.*`.
6. Decide the output file path and class name:
   - If the user specified `Output:` and `class name:` in this message, use those exactly.
   - Otherwise, propose a path matching the project's existing convention (`lib/screens/<name>_screen.dart`, `lib/features/<feature>/presentation/...`, `lib/widgets/<name>.dart`) and ask for confirmation.
7. Generate the Dart file:
   - First line of every `build()` is `final theme = context.ethrThemeData;`
   - Use `Scaffold` with `backgroundColor: theme.backgroundNeutralPrimary`
   - Wrap content in `SafeArea` + `SingleChildScrollView` if vertical scrolling fits the design
   - Extract any sub-block of UI into a private `StatelessWidget` class — never use a `Widget _buildXxx()` helper method
   - Use `EdgeInsetsDirectional` for any directional padding
   - For mutually-exclusive icon slots (e.g. `prefix` vs `customPrefix`), set only one
8. Run the self-review checklist before declaring done:
   - [ ] No `Color(0x...)` literals
   - [ ] No raw int dp values — every value comes from `EthrSpacing.*` / `EthrPadding.*` / `EthrBorderRadius.*`
   - [ ] No raw `Text(...)` — only `EthrText(...)` / `EthrText.<factory>(...)`
   - [ ] No `Icon(...)` from Material — only `EthrIcon(name: EthrIcons.xxx)`
   - [ ] No Material controls (`ElevatedButton`, `TextField`, `Checkbox`, `Switch`, `Slider`, `Card`, `Chip`, `BottomNavigationBar`, `AlertDialog`, `Drawer`, `TabBar`, `SnackBar`, `CircularProgressIndicator`, `LinearProgressIndicator`, `CircleAvatar`, `Badge`, `Tooltip`)
   - [ ] All directional padding uses `EdgeInsetsDirectional.only(start:, end:)`
   - [ ] Variant strings (size, type, state, shape) are enums, not raw strings
   - [ ] No widget-building helper methods — extracted into private `StatelessWidget` classes
   - [ ] Imports clean: only `package:flutter/material.dart` (for layout primitives) and `package:flutter_ether_2/flutter_ether_2.dart`
9. Run `flutter analyze <path/to/new_file.dart>` and fix every error and warning before declaring done.
10. If a Figma element references an Ethr component that does not exist in `lib/flutter_ether_2.dart` exports, STOP and tell the user — do NOT improvise with a Material widget or a Container hack.

## Final report (return to the user)

After everything is done, summarize in this exact shape:

- **File created**: `<full path>`
- **Figma node**: `<fileKey> / <nodeId>`
- **Ethr components used**: bullet list (`EthrButton`, `EthrInput`, `EthrAvatar`, ...)
- **Substitutions made**: any Figma element that didn't have a 1:1 Ethr match, and what was used instead
- **Unmapped tokens**: any Figma variable / hex value that didn't map cleanly to a semantic theme token
- **TODOs for the user**: handlers, dynamic content, navigation wiring, missing data props
- **How to use it**: a one-paragraph snippet showing how to navigate to or import the new screen/widget

## User-supplied details (parse from this message body)

The user's message after `/figma-screen` may contain:

- A Figma URL (required) — `figma.com/design/...?node-id=...`
- An optional `Output:` line specifying the file path
- An optional `class name:` line specifying the Dart class name
- An optional `Purpose:` line describing what the screen does — use this to name handlers and write minimal comments

If any of `Output`, `class name`, or `Purpose` are missing, infer them from the Figma frame name and propose values before generating code (do not silently pick a path).

## Hard constraint

Use ONLY the Ethr SDK for visible UI. The only allowed non-Ethr widgets are layout primitives: `Scaffold`, `AppBar`, `SafeArea`, `Row`, `Column`, `Stack`, `Wrap`, `Expanded`, `Flexible`, `SizedBox`, `Padding`, `Container`, `ListView`, `GridView`, `SingleChildScrollView`, `Align`, `Center`, `Positioned`, `ClipRRect`, `ClipOval`. Anything else visual must be an `Ethr*` widget.
