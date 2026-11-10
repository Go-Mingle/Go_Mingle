import 'package:formz/formz.dart';
import 'package:gomingle_customer_mobile/utils/locale/locale.dart';

/// Validation errors for the [Password] [FormzInput].
enum PasswordValidationError {
  /// Generic invalid error.
  empty,
  lessThan8,
  moreThan50;

  String get message {
    switch (this) {
      case PasswordValidationError.empty:
        return LocaleStrings.passwordEmpty;
      case PasswordValidationError.lessThan8:
        return LocaleStrings.passwordLessThan8;
      case PasswordValidationError.moreThan50:
        return LocaleStrings.passwordMoreThan50;
    }
  }
}

/// {@template password}
/// Form input for an password input.
/// {@endtemplate}
class Password extends FormzInput<String, PasswordValidationError> {
  /// {@macro password}
  const Password.pure([super.value = '']) : super.pure();

  /// {@macro password}
  const Password.dirty([super.value = '']) : super.dirty();

  @override
  PasswordValidationError? validator(String? value) {
    final string = value?.trim() ?? '';
    if (string.isEmpty) {
      return PasswordValidationError.empty;
    } else if (string.length > 50) {
      return PasswordValidationError.moreThan50;
    } else if (string.length < 8) {
      return PasswordValidationError.lessThan8;
    } else {
      return null;
    }
  }
}

extension PasswordFromString on String {
  Password toPassword() => Password.dirty(this);
  Password toPurePassword() => Password.pure(this);
}
