import 'package:flutter/material.dart';
import 'package:gomingle_customer_mobile/core/cache_client/cache_client.dart';
import 'package:gomingle_customer_mobile/core/theme/gomingle_brand_colors.dart';
import 'package:gomingle_customer_mobile/core/theme/gomingle_status_colors.dart';

export 'package:gomingle_customer_mobile/core/theme/gomingle_brand_colors.dart';
export 'package:gomingle_customer_mobile/core/theme/gomingle_display_text.dart';
export 'package:gomingle_customer_mobile/core/theme/gomingle_status_colors.dart';

/// Light and dark themes for the Mingler app.
///
/// This is the foundation only: colours, fonts and shapes from the brand
/// tokens. The redesign replaces the tokens; screens read them through
/// `Theme.of(context)` so they follow automatically.
abstract final class GoMingleTheme {
  static const String bodyFont = 'Poppins';
  static const String displayFont = 'BricolageGrotesque';

  static ThemeData light() => _build(
        ColorScheme.fromSeed(
          seedColor: GoMingleBrandColors.teal,
          primary: GoMingleBrandColors.tealDark,
          secondary: GoMingleBrandColors.coral,
          error: GoMingleBrandColors.coralDark,
        ),
        GoMingleStatusColors.light,
      );

  static ThemeData dark() => _build(
        ColorScheme.fromSeed(
          seedColor: GoMingleBrandColors.teal,
          brightness: Brightness.dark,
          primary: GoMingleBrandColors.teal,
          secondary: GoMingleBrandColors.coral,
          error: GoMingleBrandColors.coral,
          surface: GoMingleBrandColors.surfaceBase,
          onSurface: GoMingleBrandColors.textPrimary,
        ),
        GoMingleStatusColors.dark,
      );

  static ThemeData _build(ColorScheme scheme, GoMingleStatusColors status) {
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      fontFamily: bodyFont,
      scaffoldBackgroundColor: scheme.surface,
      extensions: [status],
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(52),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
        ),
      ),
    );
  }
}

/// Holds the chosen theme mode and remembers it between launches.
class ThemeController extends ValueNotifier<ThemeMode> {
  ThemeController({CacheClient? cache})
      : _cache = cache,
        super(_restore(cache));

  static const String cacheKey = 'theme_mode';

  final CacheClient? _cache;

  static ThemeMode _restore(CacheClient? cache) {
    final saved = cache?.read<String>(key: cacheKey);
    return ThemeMode.values.firstWhere(
      (mode) => mode.name == saved,
      orElse: () => ThemeMode.system,
    );
  }

  void setMode(ThemeMode mode) {
    value = mode;
    _cache?.write<String>(key: cacheKey, value: mode.name);
  }
}
