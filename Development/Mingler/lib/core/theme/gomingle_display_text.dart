import 'package:flutter/material.dart';

/// Display headings (D1/D2) in Bricolage Grotesque; body text uses Poppins
/// from the theme.
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
    return Text(
      text,
      textAlign: textAlign,
      style: TextStyle(
        fontFamily: 'BricolageGrotesque',
        fontSize: fontSize,
        fontWeight: fontWeight,
        height: 1.1,
        letterSpacing: -1,
        color: color ?? Theme.of(context).colorScheme.onSurface,
      ),
    );
  }
}
