import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gomingle_customer_mobile/core/cache_client/cache_client.dart';
import 'package:gomingle_customer_mobile/core/theme/theme.dart';

class _MemoryCache implements CacheClient {
  final Map<String, Object> values = {};

  @override
  T? read<T extends Object>({required String key}) {
    final value = values[key];
    return value is T ? value : null;
  }

  @override
  void write<T extends Object>({required String key, required T value}) =>
      values[key] = value;

  @override
  Future<void> delete<T extends Object>({required String key}) async =>
      values.remove(key);

  @override
  Future<void> clear() async => values.clear();

  @override
  Future<void> close() async {}
}

void main() {
  group('GoMingleTheme', () {
    test('light and dark use Material 3, Poppins and the status colours', () {
      final light = GoMingleTheme.light();
      final dark = GoMingleTheme.dark();

      expect(light.useMaterial3, isTrue);
      expect(light.brightness, Brightness.light);
      expect(dark.brightness, Brightness.dark);
      expect(light.textTheme.bodyMedium?.fontFamily, GoMingleTheme.bodyFont);
      expect(light.extension<GoMingleStatusColors>(), GoMingleStatusColors.light);
      expect(dark.extension<GoMingleStatusColors>(), GoMingleStatusColors.dark);
      expect(dark.colorScheme.primary, GoMingleBrandColors.teal);
    });
  });

  group('ThemeController', () {
    test('follows the system until a mode is chosen', () {
      expect(ThemeController().value, ThemeMode.system);
      expect(ThemeController(cache: _MemoryCache()).value, ThemeMode.system);
    });

    test('remembers the chosen mode', () {
      final cache = _MemoryCache();
      final controller = ThemeController(cache: cache)..setMode(ThemeMode.dark);

      expect(controller.value, ThemeMode.dark);
      expect(cache.values[ThemeController.cacheKey], 'dark');
      expect(ThemeController(cache: cache).value, ThemeMode.dark);
    });

    test('ignores an unknown saved value', () {
      final cache = _MemoryCache()..values[ThemeController.cacheKey] = 'neon';
      expect(ThemeController(cache: cache).value, ThemeMode.system);
    });
  });

  testWidgets('GoMingleDisplayText uses the display font and theme colour',
      (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: GoMingleTheme.dark(),
        home: GoMingleDisplayText.d1('Dinner tonight'),
      ),
    );
    final text = tester.widget<Text>(find.text('Dinner tonight'));
    expect(text.style?.fontFamily, GoMingleTheme.displayFont);
    expect(text.style?.fontSize, 56);
    expect(text.style?.color, GoMingleTheme.dark().colorScheme.onSurface);
  });
}
