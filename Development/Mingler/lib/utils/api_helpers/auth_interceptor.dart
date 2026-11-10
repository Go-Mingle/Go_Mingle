import 'package:http_interceptor/http_interceptor.dart';

class AuthInterceptor implements InterceptorContract {
  String? token;

  @override
  Future<BaseRequest> interceptRequest({required BaseRequest request}) async {
    request.headers.addAll({
      if (token != null) 'Authorization': 'Bearer $token',
    });

    return request;
  }

  @override
  Future<BaseResponse> interceptResponse({
    required BaseResponse response,
  }) async {
    return response;
  }

  @override
  Future<bool> shouldInterceptRequest() async => true;

  @override
  Future<bool> shouldInterceptResponse() async => false;
}
