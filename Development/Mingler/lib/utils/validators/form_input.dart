import 'package:formz/formz.dart';

enum FormInputError { empty }

class FormInput<T> extends FormzInput<T?, FormInputError> {
  const FormInput.pure([super.value]) : super.pure();
  const FormInput.dirty([super.value]) : super.dirty();

  @override
  FormInputError? validator(T? value) {
    return value == null ? FormInputError.empty : null;
  }

  bool get isEmpty => value == null;

  bool get isNotEmpty => value != null;
}

extension FormInputFrom<T> on T {
  FormInput<T> toFormInput() => FormInput<T>.dirty(this);
  FormInput<T> toPureFormInput() => FormInput<T>.pure(this);
}
