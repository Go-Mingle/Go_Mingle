import 'package:flutter_test/flutter_test.dart';
import 'package:gomingle_customer_mobile/utils/validators/validators.dart';

void main() {
  group('Email', () {
    test('accepts a normal address', () {
      expect(const Email.dirty('sara.khan@gomingle.pk').isValid, isTrue);
    });

    test('rejects empty and malformed input', () {
      expect(const Email.dirty('  ').error, EmailValidationError.empty);
      expect(const Email.dirty('sara@').error, EmailValidationError.invalid);
      expect(const Email.dirty('not an email').error, EmailValidationError.invalid);
    });
  });

  group('Password', () {
    test('needs 8 to 50 characters', () {
      expect(const Password.dirty('').error, PasswordValidationError.empty);
      expect(const Password.dirty('short1').error, PasswordValidationError.lessThan8);
      expect(
        Password.dirty('a' * 51).error,
        PasswordValidationError.moreThan50,
      );
      expect(const Password.dirty('Dinner!2026').isValid, isTrue);
    });
  });
}
