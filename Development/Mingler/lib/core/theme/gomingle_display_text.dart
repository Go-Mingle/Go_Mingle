import 'package:flutter/material.dart';
import 'package:flutter_ether_2/flutter_ether_2.dart';

// Sanctioned exception to the "Ethr widgets only" rule:
// EthrTypography supports a single font family, so Bricolage Grotesque for
// D1/D2 display moments cannot flow through EthrText. Use this widget only.
class GoMingleDisplayText extends StatelessWidget {
  const GoMingleDisplayText(
    this.text, {
    required this.fontSize,
    super.key,
    this.fontWeight = FontWeight.w700,
    this.color,
    this.textAlign,
  });

  factory GoMingleDisplayText.d1(
    String text, {
    Key? key,
    Color? color,
    TextAlign? textAlign,
  }) =>
      GoMingleDisplayText(
        text,
        key: key,
        fontSize: 56,
        fontWeight: FontWeight.w800,
        color: color,
        textAlign: textAlign,
      );

  factory GoMingleDisplayText.d2(
    String text, {
    Key? key,
    Color? color,
    TextAlign? textAlign,
  }) =>
      GoMingleDisplayText(
        text,
        key: key,
        fontSize: 40,
        color: color,
        textAlign: textAlign,
      );

  final String text;
  final double fontSize;
  final FontWeight fontWeight;
  final Color? color;
  final TextAlign? textAlign;

  @override
  Widget build(BuildContext context) {
    final theme = context.ethrThemeData;
    return Text(
      text,
      textAlign: textAlign,
      style: TextStyle(
        fontFamily: 'BricolageGrotesque',
        fontSize: fontSize,
        fontWeight: fontWeight,
        height: 1.1,
        letterSpacing: -1,
        color: color ?? theme.contentNeutralPrimary,
      ),
    );
  }
}
