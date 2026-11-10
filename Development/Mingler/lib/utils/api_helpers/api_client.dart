import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http_interceptor/http_interceptor.dart';
import 'package:gomingle_customer_mobile/utils/api_helpers/api_helpers.dart';

/// API Client to interact with any REST API
class APIClient {
  APIClient({
    InterceptedClient? client,
    InterceptorContract? authInterceptor,
    InterceptorContract? errorInterceptor,
    InterceptorContract? logInterceptor,
    RetryPolicy? retryPolicy,
  }) : _client = client ??
            InterceptedClient.build(
              interceptors: [
                // Pass AuthInterceptor through getIt and set token on login and
                // signup.
                authInterceptor ?? AuthInterceptor(),
                errorInterceptor ?? ErrorInterceptor(),
                logInterceptor ?? LogInterceptor(),
              ],
              retryPolicy: retryPolicy ?? ExpiredTokenRetryPolicy(),
            );

  final InterceptedClient _client;

  /// Used to initiate a [get] request
  ///
  /// The [endpoint] is end point that will be attached to the [baseUrl]
  /// which either can be provided as a whole using the [APIConfig]
  /// setting or can be overidden as it is given as an option parameter
  /// in the function.
  ///
  /// Same thing applies for the [header] parameter
  Future<dynamic> get({
    required String endpoint,
    String? baseUrl,
    Map<String, String>? header,
    Duration? timeOut,
  }) async =>
      _request(
        call: (uri) async => _client.get(uri, headers: header),
        baseUrl: baseUrl,
        endpoint: endpoint,
        timeOut: timeOut,
      );

  /// Used to initiate a [post] request
  ///
  /// Use the [body] parameter to send the json data to the service
  ///
  /// The [endpoint] is end point that will be attached to the [baseUrl]
  /// which either can be provided as a whole using the [APIConfig]
  /// setting or can be overidden as it is given as an option parameter
  /// in the function.
  ///
  /// Same thing applies for the [header] parameter
  Future<dynamic> post({
    required String endpoint,
    dynamic body,
    String? baseUrl,
    Map<String, String>? header,
    Duration? timeOut,
  }) async =>
      _request(
        call: (uri) async => _client.post(
          uri,
          headers: header,
          body: jsonEncode(body),
        ),
        baseUrl: baseUrl,
        endpoint: endpoint,
        timeOut: timeOut,
      );

  /// Used to initiate a [put] request
  ///
  /// Use the [body] parameter to send the json data to the service
  ///
  /// The [endpoint] is end point that will be attached to the [baseUrl]
  /// which either can be provided as a whole using the [APIConfig]
  /// setting or can be overidden as it is given as an option parameter
  /// in the function.
  ///
  /// Same thing applies for the [header] parameter
  Future<dynamic> put({
    required String endpoint,
    dynamic body,
    String? baseUrl,
    Map<String, String>? header,
    Duration? timeOut,
  }) async =>
      _request(
        call: (uri) async => _client.put(
          uri,
          headers: header,
          body: jsonEncode(body),
        ),
        baseUrl: baseUrl,
        endpoint: endpoint,
        timeOut: timeOut,
      );

  /// Used to initiate a [patch] request
  ///
  /// Use the [body] parameter to send the json data to the service
  ///
  /// The [endpoint] is end point that will be attached to the [baseUrl]
  /// which either can be provided as a whole using the [APIConfig]
  /// setting or can be overidden as it is given as an option parameter
  /// in the function.
  ///
  /// Same thing applies for the [header] parameter
  Future<dynamic> patch({
    required String endpoint,
    dynamic body,
    String? baseUrl,
    Map<String, String>? header,
    Duration? timeOut,
  }) async =>
      _request(
        call: (uri) async => _client.patch(
          uri,
          headers: header,
          body: jsonEncode(body),
        ),
        baseUrl: baseUrl,
        endpoint: endpoint,
        timeOut: timeOut,
      );

  /// Used to initiate a [delete] request
  ///
  /// Use the [body] parameter to send the json data to the service
  ///
  /// The [endpoint] is end point that will be attached to the [baseUrl]
  /// which either can be provided as a whole using the [APIConfig]
  /// setting or can be overidden as it is given as an option parameter
  /// in the function.
  ///
  /// Same thing applies for the [header] parameter
  Future<dynamic> delete({
    required String endpoint,
    dynamic body,
    String? baseUrl,
    Map<String, String>? header,
    Duration? timeOut,
  }) async =>
      _request(
        call: (uri) async => _client.delete(
          uri,
          headers: header,
          body: jsonEncode(body),
        ),
        baseUrl: baseUrl,
        endpoint: endpoint,
        timeOut: timeOut,
      );

  Future<dynamic> _request({
    required Future<Response> Function(Uri uri) call,
    required String endpoint,
    String? baseUrl,
    Duration? timeOut,
  }) async {
    // final url to which call will be made
    final base = baseUrl ?? ApiEnvironment.current.resolvedBaseUrl;
    final url = base + endpoint;

    // uri to be passed to request
    final uri = Uri.parse(url);

    // final timeout to be used with request
    final responseTimeout = timeOut ?? APIConfig.responseTimeout;

    try {
      final response = await call(uri).timeout(responseTimeout);

      // 204 / empty-body responses are valid; decoding '' would throw.
      if (response.body.isEmpty) return null;

      return jsonDecode(response.body);
    } on SocketException {
      throw const NoInternetException();
    } on TimeoutException {
      throw const RequestTimeoutException();
    }
  }
}
