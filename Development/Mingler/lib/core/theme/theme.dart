import 'package:flutter_ether_2/flutter_ether_2.dart';
import 'package:gomingle_customer_mobile/core/theme/gomingle_color_overrides.dart';
import 'package:gomingle_customer_mobile/core/theme/gomingle_typography_overrides.dart';

export 'package:gomingle_customer_mobile/core/theme/gomingle_brand_colors.dart';
export 'package:gomingle_customer_mobile/core/theme/gomingle_color_overrides.dart';
export 'package:gomingle_customer_mobile/core/theme/gomingle_display_text.dart';
export 'package:gomingle_customer_mobile/core/theme/gomingle_status_colors.dart';
export 'package:gomingle_customer_mobile/core/theme/gomingle_typography_overrides.dart';

Future<EthrThemeController> buildGoMingleThemeController() {
  return EthrThemeController.load(
    colorOverrides: GoMingleColorOverrides.overrides,
    typographyOverrides: GoMingleTypographyOverrides.overrides,
  );
}
