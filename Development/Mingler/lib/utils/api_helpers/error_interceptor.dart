import 'dart:convert';

import 'package:http_interceptor/http_interceptor.dart';
import 'package:gomingle_customer_mobile/utils/api_helpers/api_helpers.dart';
import 'package:gomingle_customer_mobile/utils/helpers/typedefs.dart';

class ErrorInterceptor extends InterceptorContract {
  @override
  Future<BaseRequest> interceptRequest({required BaseRequest request}) async {
    return request;
  }

  @override
  Future<BaseResponse> interceptResponse({
    required BaseResponse response,
  }) async {
    final status = response.statusCode;

    // Any 2xx is success (including 202/204, which may have an empty body).
    if (status >= 200 && status < 300) return response;

    final message = _messageFrom(response);

    switch (status) {
      case 401:
      case 403:
        throw UnauthorizedException(message);
      case 404:
        throw NotFoundException(message);
      case 408:
        throw const RequestTimeoutException();
      case 400:
      case 409:
      case 422:
        // Client errors carry actionable validation text from the API.
        if (message == null) throw const DefaultException();
        throw DefaultException(message);
      default:
        // 5xx and anything unexpected: never surface server internals.
        throw const DefaultException();
    }
  }

  /// Extracts `message` from a JSON error body. Returns `null` when the body
  /// is empty, is not JSON (e.g. an HTML 502 page from a load balancer) or has
  /// no string `message` - instead of throwing a [FormatException] that would
  /// mask the real HTTP failure.
  String? _messageFrom(BaseResponse response) {
    if (response is! Response || response.body.isEmpty) return null;
    try {
      final decoded = jsonDecode(response.body);
      if (decoded is JsonMap) {
        final message = decoded['message'];
        return message is String ? message : null;
      }
    } on FormatException {
      return null;
    }
    return null;
  }

  @override
  Future<bool> shouldInterceptRequest() async => false;

  @override
  Future<bool> shouldInterceptResponse() async => true;
}
