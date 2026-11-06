// ignore_for_file: non_constant_identifier_names

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

extension FormatDateTime on DateTime {
  /// Formats the date as `yyyy-MM-dd Hm`.
  String get formatyyyyMMddHHmm => CustomDateFormat.yyyyMMddHHmm.format(this);

  String get formatddMMMyyyy => CustomDateFormat.ddMMMyyyy.format(this);

  String get formatddMMMMyyyy => CustomDateFormat.ddMMMMyyyy.format(this);

  String get formatddMMyyyy => CustomDateFormat.ddMMyyyy.format(this);

  String get formatddMMM => CustomDateFormat.ddMMM.format(this);

  String get formatMMM => CustomDateFormat.MMM.format(this);

  String get formatMMMyyyy => CustomDateFormat.MMMyyyy.format(this);
}

extension ParseDateTime on String {
  /// Parse with [DateTime.tryParse]
  DateTime get parseDateTime => DateTime.parse(this);
}

extension DateTimeHelpers on DateTime {
  bool get isCurrentYear => DateTime.now().year == year;
}

class CustomDateFormat {
  CustomDateFormat._();

  /// Formats the date as `yyyy-MM-dd Hm`.
  static DateFormat get yyyyMMddHHmm => DateFormat('yyyy-MM-dd HH:mm');

  static DateFormat get ddMMMyyyy => DateFormat('d MMM yyyy');

  static DateFormat get ddMMMMyyyy => DateFormat('d MMMM yyyy');

  static DateFormat get ddMMyyyy => DateFormat('dd/MM/yyyy');

  static DateFormat get ddMMM => DateFormat('d MMM');

  static DateFormat get MMM => DateFormat('MMM');

  static DateFormat get MMMyyyy => DateFormat('MMM yyyy');
}

extension DateTimeRangeExt on DateTimeRange {
  bool get isSameDay =>
      start.day == end.day &&
      start.month == end.month &&
      start.year == end.year;

  bool get isSameMonth => start.month == end.month && start.year == end.year;

  bool get isSameYear => start.year == end.year;

  String get formatddMMM => start.formatddMMM;

  String get formatddMMMyyyy => start.formatddMMMyyyy;

  String get formatddddMMM => '${start.day}-${end.day} ${end.formatMMM}';

  String get formatddddMMMyyyy =>
      '${start.day}-${end.day} ${end.formatMMMyyyy}';

  String get formatddMMMddMMM => '${start.formatddMMM} - ${end.formatddMMM}';

  String get formatddMMMddMMMyyyy =>
      '${start.formatddMMM} - ${end.formatddMMMyyyy}';

  String get formatddMMMyyyyddMMMyyyy =>
      '${start.formatddMMMyyyy} - ${end.formatddMMMyyyy}';

  String get format => isSameDay
      ? start.isCurrentYear
          ? formatddMMM
          : formatddMMMyyyy
      : isSameMonth
          ? start.isCurrentYear
              ? formatddddMMM
              : formatddddMMMyyyy
          : isSameYear
              ? start.isCurrentYear
                  ? formatddMMMddMMM
                  : formatddMMMddMMMyyyy
              : formatddMMMyyyyddMMMyyyy;
}
