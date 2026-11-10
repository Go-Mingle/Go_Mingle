import 'dart:developer';

import 'package:flutter/foundation.dart';
import 'package:http_interceptor/http_interceptor.dart';

/// Debug-only request/response logger.
///
/// Deliberately logs only the method, URL and status code. Headers (which carry
/// the `Authorization` bearer token) and bodies (which carry passwords, OTPs
/// and PII) are never written to the log, and nothing is logged in profile or
/// release builds.
class LogInterceptor extends InterceptorContract {
  @override
  Future<BaseRequest> interceptRequest({required BaseRequest request}) async {
    if (kDebugMode) {
      log('${request.method} ${request.url}', name: 'API');
    }
    return request;
  }

  @override
  Future<BaseResponse> interceptResponse({
    required BaseResponse response,
  }) async {
    if (kDebugMode) {
      log('${response.statusCode} ${response.request?.url}', name: 'API');
    }
    return response;
  }

  @override
  Future<bool> shouldInterceptRequest() async => kDebugMode;

  @override
  Future<bool> shouldInterceptResponse() async => kDebugMode;
}
