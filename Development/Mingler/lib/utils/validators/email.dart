import 'package:formz/formz.dart';
import 'package:gomingle_customer_mobile/utils/locale/locale.dart';

enum EmailValidationError {
  empty,
  invalid;

  String get message {
    switch (this) {
      case EmailValidationError.empty:
        return LocaleStrings.emailEmpty;
      case EmailValidationError.invalid:
        return LocaleStrings.emailInvalid;
    }
  }
}

class Email extends FormzInput<String, EmailValidationError> {
  const Email.pure([super.value = '']) : super.pure();
  const Email.dirty([super.value = '']) : super.dirty();

  @override
  EmailValidationError? validator(String value) {
    final emailValid = RegExp(
      r'^\w+([\.-]?\w+)([+]?\w+)@\w+([\.-]?\w+)(\.\w{2,3})+$',
    ).hasMatch(value.trim());
    if (value.trim().isEmpty) {
      return EmailValidationError.empty;
    } else if (!emailValid) {
      return EmailValidationError.invalid;
    } else {
      return null;
    }
  }
}

extension EmailFromString on String {
  Email toEmail() => Email.dirty(this);
  Email toPureEmail() => Email.pure(this);
}
