import 'package:flutter_test/flutter_test.dart';
import 'package:gomingle_customer_mobile/utils/api_helpers/api_helpers.dart';

void main() {
  test('every flavor points at the Mingler API and ends with a slash', () {
    for (final env in ApiEnvironment.values) {
      expect(env.resolvedBaseUrl, endsWith('/mingler/'));
    }
    expect(
      ApiEnvironment.production.resolvedBaseUrl,
      startsWith('https://gomingle-api.vercel.app/'),
    );
  });

  test('the current environment can be switched', () {
    ApiEnvironment.current = ApiEnvironment.staging;
    expect(ApiEnvironment.current.isStaging, isTrue);
    ApiEnvironment.current = ApiEnvironment.development;
    expect(ApiEnvironment.current.isDevelopment, isTrue);
  });
}
