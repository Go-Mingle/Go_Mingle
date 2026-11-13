# Worked Examples — Figma → Ethr Flutter

Real conversions showing the pattern: how the Figma MCP response looks, how to map it, and what the final Dart output should be. Use these as templates.

---

## Example 1 — Login screen

### Figma node summary

`get_design_context` returns a frame with:
- Page background: `color/background/page`
- Top: `Heading/H2/Bold` text "Welcome back"
- `Body/Large/Regular` text "Sign in to continue"
- Two `Input / Outlined / Default` fields (Email, Password) — each with leading icon (`mail`, `lock`)
- One `Button / Primary / Large` "Sign In" — full width
- A `TextButton` "Forgot password?" — actually a Figma `Button / Tertiary / Small` (so use `EthrButton`, not raw text)
- Three `Social Button` instances (Google, Apple, Facebook)
- `Body/Small/Regular` "Don't have an account? Sign up" — the "Sign up" portion is a `Utility/Link/Small`

### Mapping plan

| Figma element | Ethr widget | Tokens |
|---|---|---|
| Page bg | `Scaffold` background | `theme.backgroundNeutralPrimary` |
| "Welcome back" | `EthrText.h2Bold` | `theme.contentNeutralPrimary` |
| "Sign in to continue" | `EthrText.bodyLarge` | `theme.contentNeutralSecondary` |
| Email field | `EthrInput(theme: InputTheme.outlined, prefix: EthrIcons.mail)` | — |
| Password field | `EthrInput(theme: InputTheme.outlined, prefix: EthrIcons.lock, obscureText: true, obscureToggle: true)` | `obscureToggle: true` auto-renders the eye/eye-slash suffix and toggles internally — no `setState` plumbing required. |
| "Sign In" button | `EthrButton(type: ButtonType.primary, size: ButtonSize.large, fullWidth: true)` | — |
| "Forgot password?" | `EthrButton(type: ButtonType.tertiary, size: ButtonSize.small)` | — |
| Social buttons row | three `EthrSocialButton` in a `Row` with `EthrSpacing.spacing12` gap | — |
| Footer text + link | `Row` of `EthrText.bodySmall(...)` + `EthrPressable(child: EthrText('Sign up', typography: EthrTypography.utilityLinkSmall, color: theme.contentBrandDefault))` | — |

### Final Dart

```dart
import 'package:flutter/material.dart';
import 'package:flutter_ether_2/flutter_ether_2.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _rememberMe = false;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.ethrThemeData;
    return Scaffold(
      backgroundColor: theme.backgroundNeutralPrimary,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(EthrPadding.padding24),
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                EthrText.h2Bold('Welcome back', color: theme.contentNeutralPrimary),
                const SizedBox(height: EthrSpacing.spacing8),
                EthrText.bodyLarge(
                  'Sign in to continue',
                  color: theme.contentNeutralSecondary,
                ),
                const SizedBox(height: EthrSpacing.spacing32),
                EthrInput(
                  theme: InputTheme.outlined,
                  title: 'Email',
                  placeholder: 'you@example.com',
                  prefix: EthrIcons.mail,
                  controller: _emailController,
                ),
                const SizedBox(height: EthrSpacing.spacing16),
                EthrInput(
                  theme: InputTheme.outlined,
                  title: 'Password',
                  placeholder: '••••••••',
                  prefix: EthrIcons.lock,
                  obscureText: true,
                  obscureToggle: true,
                  controller: _passwordController,
                ),
                const SizedBox(height: EthrSpacing.spacing12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    EthrCheckbox(
                      value: _rememberMe,
                      labelText: 'Remember me',
                      onChanged: (next) => setState(() => _rememberMe = next ?? false),
                    ),
                    EthrButton(
                      title: 'Forgot password?',
                      type: ButtonType.tertiary,
                      size: ButtonSize.small,
                      onPress: () {},
                    ),
                  ],
                ),
                const SizedBox(height: EthrSpacing.spacing24),
                EthrButton(
                  title: 'Sign In',
                  type: ButtonType.primary,
                  size: ButtonSize.large,
                  fullWidth: true,
                  onPress: () {},
                ),
                const SizedBox(height: EthrSpacing.spacing24),
                const EthrDivider(label: 'OR'),
                const SizedBox(height: EthrSpacing.spacing24),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    EthrSocialButton(brand: SocialBrand.google, iconOnly: true, onPress: () {}),
                    const SizedBox(width: EthrSpacing.spacing12),
                    EthrSocialButton(brand: SocialBrand.apple, iconOnly: true, onPress: () {}),
                    const SizedBox(width: EthrSpacing.spacing12),
                    EthrSocialButton(brand: SocialBrand.facebook, iconOnly: true, onPress: () {}),
                  ],
                ),
                const SizedBox(height: EthrSpacing.spacing24),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    EthrText.bodySmall(
                      "Don't have an account? ",
                      color: theme.contentNeutralSecondary,
                    ),
                    EthrPressable(
                      onPress: () {},
                      child: EthrText(
                        'Sign up',
                        typography: EthrTypography.utilityLinkSmall,
                        color: theme.contentBrandDefault,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
```

> **Notes**
>
> - `EthrSocialButton` uses `brand: SocialBrand.{google,apple,facebook,twitter,linkedIn,whatsapp,instagram,slack,discord,telegram,meta,youtube}` and `iconOnly: true` for compact icon buttons. There is no `provider:` prop.
> - `EthrInput(obscureToggle: true)` automatically renders the eye/eye-slash suffix and toggles internally — no manual `setState` for password visibility.
> - `EthrCheckbox(value: bool, onChanged: ValueChanged<bool?>?)` matches Material `Checkbox`. The legacy `checked:` / `onPressed:` API still works but is deprecated.
> - `EthrDivider(label: 'OR')` is the canonical "OR" rule between auth options. It pulls `theme.borderNeutralPrimary` by default.

---

## Example 2 — Profile card row

### Figma element

A horizontal layer named `Profile Row` with:
- 48px circular `Avatar / Image / Large`
- Vertical text stack: `Body/Large/Emphasis` name, `Body/Small/Regular` email
- Trailing `Icon / chevronRight / 24`

### Final Dart

```dart
import 'package:flutter/material.dart';
import 'package:flutter_ether_2/flutter_ether_2.dart';

class ProfileRow extends StatelessWidget {
  final String name;
  final String email;
  final String? avatarUrl;
  final VoidCallback? onTap;

  const ProfileRow({
    super.key,
    required this.name,
    required this.email,
    this.avatarUrl,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = context.ethrThemeData;
    return EthrPressable(
      onPress: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: EthrPadding.padding16,
          vertical: EthrPadding.padding12,
        ),
        child: Row(
          children: [
            EthrAvatar(
              type: avatarUrl != null ? AvatarType.image : AvatarType.initials,
              image: avatarUrl,
              initials: name.isNotEmpty ? name[0].toUpperCase() : '?',
              size: AvatarSize.large,
              shape: AvatarShape.rounded,
            ),
            const SizedBox(width: EthrSpacing.spacing12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  EthrText(
                    name,
                    typography: EthrTypography.bodyLargeEmphasis,
                    color: theme.contentNeutralPrimary,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: EthrSpacing.spacing2),
                  EthrText.bodySmall(
                    email,
                    color: theme.contentNeutralSecondary,
                  ),
                ],
              ),
            ),
            const SizedBox(width: EthrSpacing.spacing8),
            EthrIcon(
              name: EthrIcons.chevronRight,
              size: 24,
              color: theme.contentNeutralTertiary,
              flip: true,
            ),
          ],
        ),
      ),
    );
  }
}
```

> `EthrIcon.size` is a `double` — pass either a numeric literal (`24`) or `EthrIconSize.small.value.toDouble()`. `flip: true` mirrors the icon in RTL (chevrons / arrows). Omit `flip` to auto-detect from the active text direction.

---

## Example 3 — Settings screen with sections

### Figma layout

A scrollable list of `Accordion` groups, each containing several `List Item` rows with leading icons and trailing `Toggle` or `chevronRight`.

### Final Dart (excerpt)

```dart
import 'package:flutter/material.dart';
import 'package:flutter_ether_2/flutter_ether_2.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  bool _pushEnabled = true;
  bool _emailEnabled = false;

  @override
  Widget build(BuildContext context) {
    final theme = context.ethrThemeData;
    return Scaffold(
      backgroundColor: theme.backgroundNeutralPrimary,
      appBar: AppBar(
        backgroundColor: theme.backgroundNeutralPrimary,
        elevation: 0,
        leading: EthrIconButton(
          name: EthrIcons.arrowLeft,
          type: IconButtonType.tertiary,
          onPress: () => Navigator.pop(context),
        ),
        title: EthrText.h5Bold('Settings', color: theme.contentNeutralPrimary),
      ),
      body: ListView(
        padding: const EdgeInsets.all(EthrPadding.padding16),
        children: [
          _SectionHeader(title: 'Notifications'),
          const SizedBox(height: EthrSpacing.spacing8),
          _SettingsToggleRow(
            icon: EthrIcons.notification,
            label: 'Push notifications',
            value: _pushEnabled,
            onChanged: (v) => setState(() => _pushEnabled = v),
          ),
          _SettingsToggleRow(
            icon: EthrIcons.mail,
            label: 'Email notifications',
            value: _emailEnabled,
            onChanged: (v) => setState(() => _emailEnabled = v),
          ),
          const SizedBox(height: EthrSpacing.spacing24),
          _SectionHeader(title: 'Account'),
          const SizedBox(height: EthrSpacing.spacing8),
          _SettingsLinkRow(
            icon: EthrIcons.profile,
            label: 'Edit profile',
            onTap: () {},
          ),
          _SettingsLinkRow(
            icon: EthrIcons.lock,
            label: 'Change password',
            onTap: () {},
          ),
        ],
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  const _SectionHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    final theme = context.ethrThemeData;
    return EthrText(
      title,
      typography: EthrTypography.utilityCaptionMedium,
      color: theme.contentNeutralSecondary,
    );
  }
}

class _SettingsToggleRow extends StatelessWidget {
  final IconName icon;
  final String label;
  final bool value;
  final ValueChanged<bool> onChanged;

  const _SettingsToggleRow({
    required this.icon,
    required this.label,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final theme = context.ethrThemeData;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: EthrPadding.padding8),
      child: Row(
        children: [
          EthrIcon(name: icon, size: 24, color: theme.contentNeutralPrimary),
          const SizedBox(width: EthrSpacing.spacing12),
          Expanded(
            child: EthrText(
              label,
              typography: EthrTypography.bodyLargeRegular,
              color: theme.contentNeutralPrimary,
            ),
          ),
          EthrToggle(toggleState: value, onToggleChange: onChanged),
        ],
      ),
    );
  }
}

class _SettingsLinkRow extends StatelessWidget {
  final IconName icon;
  final String label;
  final VoidCallback onTap;

  const _SettingsLinkRow({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = context.ethrThemeData;
    return EthrPressable(
      onPress: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: EthrPadding.padding12),
        child: Row(
          children: [
            EthrIcon(name: icon, size: 24, color: theme.contentNeutralPrimary),
            const SizedBox(width: EthrSpacing.spacing12),
            Expanded(
              child: EthrText(
                label,
                typography: EthrTypography.bodyLargeRegular,
                color: theme.contentNeutralPrimary,
              ),
            ),
            EthrIcon(
              name: EthrIcons.chevronRight,
              size: 24,
              color: theme.contentNeutralTertiary,
              flip: true,
            ),
          ],
        ),
      ),
    );
  }
}
```

---

## Anti-Patterns — Things That Should NEVER Appear in Generated Code

### ❌ Hardcoded hex color
```dart
Container(color: const Color(0xFF1A6FE6))
```
### ✅ Semantic token
```dart
Container(color: theme.backgroundBrandPrimaryAction)
```

---

### ❌ Raw padding number
```dart
Padding(padding: const EdgeInsets.all(16))
```
### ✅ Token
```dart
Padding(padding: const EdgeInsets.all(EthrPadding.padding16))
```

---

### ❌ Material button
```dart
ElevatedButton(
  onPressed: () {},
  child: const Text('Save'),
)
```
### ✅ Ethr button
```dart
EthrButton(
  title: 'Save',
  type: ButtonType.primary,
  size: ButtonSize.medium,
  onPress: () {},
)
```

---

### ❌ Material text field
```dart
TextField(
  decoration: InputDecoration(
    labelText: 'Email',
    prefixIcon: Icon(Icons.email),
  ),
)
```
### ✅ Ethr input
```dart
EthrInput(
  theme: InputTheme.outlined,
  title: 'Email',
  prefix: EthrIcons.mail,
)
```

---

### ❌ Raw `Text` with manual styling
```dart
const Text(
  'Welcome back',
  style: TextStyle(fontSize: 32, fontWeight: FontWeight.w700),
)
```
### ✅ Typography token
```dart
EthrText.h2Bold('Welcome back', color: theme.contentNeutralPrimary)
```

---

### ❌ Helper method returning Widget
```dart
Widget _buildHeader() {
  return Row(children: [...]);
}
```
### ✅ Extract a private widget class
```dart
class _Header extends StatelessWidget {
  const _Header();
  @override
  Widget build(BuildContext context) {
    final theme = context.ethrThemeData;
    return Row(children: [...]);
  }
}
```

---

### ❌ Left/right padding (RTL-broken)
```dart
EdgeInsets.only(left: 8, right: 16)
```
### ✅ Directional padding
```dart
EdgeInsetsDirectional.only(start: 8, end: 16)
```
