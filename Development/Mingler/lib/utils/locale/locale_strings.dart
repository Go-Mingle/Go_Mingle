part of 'locale.dart';

class LocaleStrings {
  // This class is not meant to be instantiated or extended;
  // this constructor prevents instantiation and extension.
  LocaleStrings._();

  static String get emailEmpty => 'emailEmpty'.tr();
  static String get emailInvalid => 'emailInvalid'.tr();
  static String get passwordEmpty => 'passwordEmpty'.tr();
  static String get passwordMoreThan50 => 'passwordMoreThan50'.tr();
  static String get passwordLessThan8 => 'passwordLessThan8'.tr();
}
