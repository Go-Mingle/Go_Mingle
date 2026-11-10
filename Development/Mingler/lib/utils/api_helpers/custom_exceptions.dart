class CustomException implements Exception {
  const CustomException([
    this.message = 'Something went wrong, please try again later.',
    this.prefix = '',
  ]);

  final String? message;
  final String? prefix;

  @override
  String toString() => (prefix ?? '') + (message ?? '');
}

class NoInternetException extends CustomException {
  const NoInternetException([
    super.message = 'Please check your internet and try again later.',
  ]);
}

class RequestTimeoutException extends CustomException {
  const RequestTimeoutException([
    super.prefix = 'Request Timeout: ',
    super.message = 'Please check your internet and try again later.',
  ]);
}

class UnauthorizedException extends CustomException {
  const UnauthorizedException([String? message])
      : super(message, 'Unauthorized: ');
}

class NotFoundException extends CustomException {
  const NotFoundException([String? message]) : super(message, 'Not Found: ');
}

class DefaultException extends CustomException {
  const DefaultException([
    super.message = 'Something went wrong, please try again later.',
  ]);
}
