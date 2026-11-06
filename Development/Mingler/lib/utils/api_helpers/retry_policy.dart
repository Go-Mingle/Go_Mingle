import 'dart:developer';

import 'package:flutter/foundation.dart';
import 'package:http_interceptor/http_interceptor.dart';
import 'package:gomingle_customer_mobile/utils/api_helpers/api_helpers.dart';

/// Retries a request once after an [UnauthorizedException], but only when a
/// [refreshToken] callback is supplied and reports that it obtained a new
/// token. Retrying with the same expired token can never succeed, so without a
/// refresh hook the 401 is surfaced to the caller immediately.
class ExpiredTokenRetryPolicy implements RetryPolicy {
  ExpiredTokenRetryPolicy({this.refreshToken});

  /// Exchanges the refresh token for a new access token and stores it (for
  /// example by setting `AuthInterceptor.token`). Returns `true` on success.
  final Future<bool> Function()? refreshToken;

  @override
  int get maxRetryAttempts => 1;

  @override
  Future<bool> shouldAttemptRetryOnException(
    Exception reason,
    BaseRequest request,
  ) async {
    final refresh = refreshToken;
    if (reason is UnauthorizedException && refresh != null) {
      if (kDebugMode) log('Refreshing token and retrying', name: 'API');
      return refresh();
    }

    return false;
  }

  @override
  Future<bool> shouldAttemptRetryOnResponse(BaseResponse response) async =>
      false;

  @override
  Duration delayRetryAttemptOnException({required int retryAttempt}) =>
      Duration(milliseconds: 250 * retryAttempt);

  @override
  Duration delayRetryAttemptOnResponse({required int retryAttempt}) =>
      Duration(milliseconds: 250 * retryAttempt);
}
