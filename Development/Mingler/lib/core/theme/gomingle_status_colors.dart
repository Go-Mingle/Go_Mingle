import 'package:flutter/material.dart';
import 'package:gomingle_customer_mobile/core/theme/gomingle_brand_colors.dart';

@immutable
class GoMingleStatusColors extends ThemeExtension<GoMingleStatusColors> {
  const GoMingleStatusColors({
    required this.pending,
    required this.confirmed,
    required this.arrived,
    required this.completed,
    required this.noShow,
    required this.cancelled,
  });

  final Color pending;
  final Color confirmed;
  final Color arrived;
  final Color completed;
  final Color noShow;
  final Color cancelled;

  static const dark = GoMingleStatusColors(
    pending:   GoMingleBrandColors.amber,
    confirmed: GoMingleBrandColors.teal,
    arrived:   GoMingleBrandColors.tealBright,
    completed: GoMingleBrandColors.textTertiary,
    noShow:    GoMingleBrandColors.coral,
    cancelled: GoMingleBrandColors.coralDark,
  );

  @override
  GoMingleStatusColors copyWith({
    Color? pending,
    Color? confirmed,
    Color? arrived,
    Color? completed,
    Color? noShow,
    Color? cancelled,
  }) =>
      GoMingleStatusColors(
        pending:   pending   ?? this.pending,
        confirmed: confirmed ?? this.confirmed,
        arrived:   arrived   ?? this.arrived,
        completed: completed ?? this.completed,
        noShow:    noShow    ?? this.noShow,
        cancelled: cancelled ?? this.cancelled,
      );

  @override
  GoMingleStatusColors lerp(
    ThemeExtension<GoMingleStatusColors>? other,
    double t,
  ) {
    if (other is! GoMingleStatusColors) return this;
    return GoMingleStatusColors(
      pending:   Color.lerp(pending,   other.pending,   t)!,
      confirmed: Color.lerp(confirmed, other.confirmed, t)!,
      arrived:   Color.lerp(arrived,   other.arrived,   t)!,
      completed: Color.lerp(completed, other.completed, t)!,
      noShow:    Color.lerp(noShow,    other.noShow,    t)!,
      cancelled: Color.lerp(cancelled, other.cancelled, t)!,
    );
  }
}

extension GoMingleStatusColorsContext on BuildContext {
  GoMingleStatusColors get statusColors =>
      Theme.of(this).extension<GoMingleStatusColors>() ??
      GoMingleStatusColors.dark;
}
