import 'package:flutter/material.dart';
import 'package:flutter_ether_2/flutter_ether_2.dart';
import 'package:gomingle_customer_mobile/core/theme/gomingle_brand_colors.dart';

class GoMingleColorOverrides {
  GoMingleColorOverrides._();

  static const EthrColorOverrides overrides = EthrColorOverrides(
    // PRIMARY → TEAL
    primary5:  Color(0xFF020E0D),
    primary10: Color(0xFF051C1A),
    primary15: GoMingleBrandColors.tealSoft,
    primary20: GoMingleBrandColors.tealDeep,
    primary30: Color(0xFF085C56),
    primary40: GoMingleBrandColors.tealDark,
    primary50: GoMingleBrandColors.teal,
    primary60: GoMingleBrandColors.tealBright,
    primary70: Color(0xFF4DD3C9),
    primary80: Color(0xFF7FDED7),
    primary85: Color(0xFF99E5DF),
    primary90: Color(0xFFB3ECE7),
    primary95: Color(0xFFD6F4F1),
    primary98: Color(0xFFEDF9F8),

    // DANGER → CORAL
    danger5:  Color(0xFF150705),
    danger10: Color(0xFF2A0E0B),
    danger15: GoMingleBrandColors.coralSoft,
    danger20: GoMingleBrandColors.coralDeep,
    danger30: Color(0xFF99372E),
    danger40: GoMingleBrandColors.coralDark,
    danger50: GoMingleBrandColors.coral,
    danger60: Color(0xFFFF8A7D),
    danger70: Color(0xFFFFA89D),
    danger80: Color(0xFFFFC4BC),
    danger85: Color(0xFFFFD2CC),
    danger90: Color(0xFFFFE0DC),
    danger95: Color(0xFFFFEEEC),
    danger98: Color(0xFFFFF8F7),

    // ACCENT → CORAL (alias so chip/accent components match brand)
    accent5:  Color(0xFF150705),
    accent10: Color(0xFF2A0E0B),
    accent15: GoMingleBrandColors.coralSoft,
    accent20: GoMingleBrandColors.coralDeep,
    accent30: Color(0xFF99372E),
    accent40: GoMingleBrandColors.coralDark,
    accent50: GoMingleBrandColors.coral,
    accent60: Color(0xFFFF8A7D),
    accent70: Color(0xFFFFA89D),
    accent80: Color(0xFFFFC4BC),
    accent85: Color(0xFFFFD2CC),
    accent90: Color(0xFFFFE0DC),
    accent95: Color(0xFFFFEEEC),
    accent98: Color(0xFFFFF8F7),

    // WARNING → AMBER
    warning5:  Color(0xFF150C03),
    warning10: Color(0xFF1A1205),
    warning15: GoMingleBrandColors.amberSoft,
    warning20: GoMingleBrandColors.amberDeep,
    warning30: Color(0xFF8E681E),
    warning40: GoMingleBrandColors.amberDark,
    warning45: GoMingleBrandColors.amber,
    warning55: Color(0xFFF7C76A),
    warning70: Color(0xFFF9D38A),
    warning80: Color(0xFFFCE0AE),
    warning85: Color(0xFFFCE7C0),
    warning90: Color(0xFFFDEED2),
    warning95: Color(0xFFFEF6E5),
    warning98: Color(0xFFFEFAF2),

    // SUCCESS → TEAL (Confirmed/Arrived use brand teal, not Material green)
    success5:  Color(0xFF020E0D),
    success10: Color(0xFF051C1A),
    success15: GoMingleBrandColors.tealSoft,
    success20: GoMingleBrandColors.tealDeep,
    success30: Color(0xFF085C56),
    success40: GoMingleBrandColors.teal,
    success45: GoMingleBrandColors.teal,
    success55: GoMingleBrandColors.tealBright,
    success70: Color(0xFF4DD3C9),
    success80: Color(0xFF7FDED7),
    success85: Color(0xFF99E5DF),
    success90: Color(0xFFB3ECE7),
    success95: Color(0xFFD6F4F1),
    success98: Color(0xFFEDF9F8),

    // NEUTRAL → GOMINGLE CHARCOAL SURFACES
    // neutral5  → backgroundNeutralPrimary (root app background)
    // neutral10 → backgroundNeutralSecondary (card / elev 1)
    // neutral15 → backgroundNeutralTertiary / Surface / Input (elev 2)
    // neutral20 → backgroundNeutralHover (elev 3 / pressed state)
    neutral5:  GoMingleBrandColors.surfaceBase,
    neutral10: GoMingleBrandColors.surfaceElev1,
    neutral15: GoMingleBrandColors.surfaceElev2,
    neutral20: GoMingleBrandColors.surfaceElev3,
    neutral30: GoMingleBrandColors.borderDefault,
    neutral40: GoMingleBrandColors.textDisabled,
    neutral50: Color(0xFF6D6D77),
    neutral60: Color(0xFF8C8C95),
    neutral70: GoMingleBrandColors.textTertiary,
    neutral80: GoMingleBrandColors.textSecondary,
    neutral85: Color(0xFFD0D0D5),
    neutral90: Color(0xFFDFDFE3),
    neutral95: Color(0xFFEDEDF0),
    neutral98: Color(0xFFF7F7F9),
  );
}
