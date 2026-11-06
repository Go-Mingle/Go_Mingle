---
name: flutter-security
description: >
  Use this skill when the user is working with authentication tokens, secure
  storage, API clients, certificates, Dio interceptors, Hive/Isar encryption,
  obfuscation config, environment variables, or any feature that touches user
  credentials, sensitive data, or network security. Also activate when the user
  asks about securing the app, preventing reverse engineering, or hardening the
  release build.
---

# Flutter Security Skill
## Stack: Clean Architecture · BLoC/Cubit · Freezed · Dio · flutter_secure_storage · Hive/Isar · Injectable/get_it

---

## 1. Secure Storage of Tokens & Credentials

### 1.1 Always use flutter_secure_storage for sensitive data
- Tokens (access, refresh), API keys, and user credentials must **only** be
  stored in `flutter_secure_storage`.
- **Never** store sensitive values in `SharedPreferences`, `Hive` plain boxes,
  or hardcoded strings.

```dart
// ✅ Correct — token stored securely
const _storage = FlutterSecureStorage(
  aOptions: AndroidOptions(encryptedSharedPreferences: true),
  iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
);

Future<void> saveAccessToken(String token) =>
    _storage.write(key: 'access_token', value: token);

Future<String?> readAccessToken() =>
    _storage.read(key: 'access_token');

Future<void> deleteAccessToken() =>
    _storage.delete(key: 'access_token');
```

### 1.2 Register the storage service as a singleton via Injectable
```dart
@module
abstract class StorageModule {
  @singleton
  FlutterSecureStorage get secureStorage => const FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
    iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
  );
}
```

### 1.3 Token storage lives exclusively in the data layer
- `SecureStorageDataSource` lives in `features/auth/data/datasources/`.
- Domain and presentation layers must never import `flutter_secure_storage`
  directly — always go through the repository interface.

### 1.4 Clear all credentials on logout
- Provide a `clearAllSecureData()` method that deletes every key, not just the
  token, on logout or on authentication failure.

```dart
Future<void> clearAllSecureData() => _storage.deleteAll();
```

### 1.5 Never log tokens
- Never pass tokens, passwords, or private keys to `debugPrint`, `print`, `log`,
  or `FirebaseCrashlytics.recordError`.
- Redact sensitive fields in Dio log interceptors (see Section 2.3).

---

## 2. API Security — Dio Configuration

### 2.1 Certificate Pinning
- Pin the server's certificate or public key for all production API calls using
  a custom `HttpClient` passed to Dio.
- Store the pinned certificate as a PEM/DER asset under `assets/certs/` and load
  it at runtime.

```dart
Future<Dio> buildSecureDio(String certAssetPath) async {
  final certBytes = await rootBundle.load(certAssetPath);
  final secCtx = SecurityContext()
    ..setTrustedCertificatesBytes(certBytes.buffer.asUint8List());

  final httpClient = HttpClient(context: secCtx);
  final adapter = IOHttpClientAdapter()
    ..createHttpClient = () => httpClient;

  return Dio()..httpClientAdapter = adapter;
}
```

> ⚠️ Update the pinned certificate **before** the server certificate expires.
> Use a two-pin strategy (primary + backup) to avoid a forced update outage.

### 2.2 Required security headers on every request
- Add these headers in a Dio interceptor registered via Injectable:

```dart
@injectable
class SecurityHeadersInterceptor extends Interceptor {
  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    options.headers.addAll({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Cache-Control': 'no-store',
    });
    super.onRequest(options, handler);
  }
}
```

### 2.3 Redact sensitive fields in logging interceptors
- Never log `Authorization`, `password`, `token`, `secret`, or `refresh_token`
  fields. Replace them with `[REDACTED]` in debug/log interceptors.

```dart
@override
void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
  final safeHeaders = Map<String, dynamic>.from(options.headers)
    ..updateAll((key, value) =>
        key.toLowerCase().contains('authorization') ? '[REDACTED]' : value);
  debugPrint('REQUEST [${options.method}] => ${options.uri}');
  debugPrint('Headers: $safeHeaders');
  super.onRequest(options, handler);
}
```

### 2.4 Token refresh interceptor with lock
- Use a `Lock` (from `dio` package) or `Completer` to prevent multiple
  simultaneous token refresh calls when 401 is received.
- Retry the original request automatically after a successful refresh.
- Call `clearAllSecureData()` and redirect to login on refresh failure.

```dart
bool _isRefreshing = false;
final List<RequestOptions> _pendingRequests = [];

@override
Future<void> onError(DioException err, ErrorInterceptorHandler handler) async {
  if (err.response?.statusCode == 401 && !_isRefreshing) {
    _isRefreshing = true;
    try {
      await _authRepo.refreshToken();
      _isRefreshing = false;
      // Retry original request
      final retryResponse = await _dio.fetch(err.requestOptions);
      handler.resolve(retryResponse);
    } catch (_) {
      _isRefreshing = false;
      await _secureStorage.deleteAll();
      // Navigate to login via go_router
    }
  } else {
    handler.next(err);
  }
}
```

### 2.5 Environment-specific base URLs and keys
- Never hardcode base URLs or API keys in Dart source files.
- Use `--dart-define` at build time and read them via `String.fromEnvironment`.

```dart
// In build command:
// flutter build apk --dart-define=BASE_URL=https://api.example.com

const baseUrl = String.fromEnvironment('BASE_URL');
const apiKey = String.fromEnvironment('API_KEY');
```

---

## 3. Hive / Isar — Encryption at Rest

### 3.1 Hive encrypted boxes for sensitive local data
- Any Hive box that stores user data, tokens, or cached API responses must use
  `HiveAesCipher`.
- Generate and store the encryption key in `flutter_secure_storage`.

```dart
Future<Box<T>> openEncryptedBox<T>(String boxName) async {
  const secureStorage = FlutterSecureStorage();
  var keyString = await secureStorage.read(key: '${boxName}_key');

  if (keyString == null) {
    final key = Hive.generateSecureKey();
    keyString = base64UrlEncode(key);
    await secureStorage.write(key: '${boxName}_key', value: keyString);
  }

  final encKey = base64Url.decode(keyString);
  return Hive.openBox<T>(boxName, encryptionCipher: HiveAesCipher(encKey));
}
```

### 3.2 Isar encryption
- Enable Isar encryption by passing a key to `Isar.open`:

```dart
final encKey = await _deriveIsarKey(); // stored in flutter_secure_storage
final isar = await Isar.open(
  [ProductSchema],
  encryptionKey: encKey,
);
```

### 3.3 Never store sensitive data in plain Hive boxes
- Plain Hive boxes (without `HiveAesCipher`) are acceptable only for
  non-sensitive UI preferences (theme, locale).

---

## 4. Code Obfuscation & Reverse Engineering Prevention

### 4.1 Enable obfuscation on every release build
- Always build release APK/IPA with obfuscation and split debug info:

```bash
# Android
flutter build apk --release \
  --obfuscate \
  --split-debug-info=./debug-info/android

# iOS
flutter build ipa --release \
  --obfuscate \
  --split-debug-info=./debug-info/ios
```

- Commit `debug-info/` to a **private, secure** location (not the main repo) for
  symbolication of crash reports.

### 4.2 R8 / ProGuard rules (Android)
- Ensure `minifyEnabled true` and `shrinkResources true` in
  `android/app/build.gradle` for release builds.
- Add rules to keep Flutter engine and platform channel classes:

```proguard
# android/app/proguard-rules.pro
-keep class io.flutter.** { *; }
-keep class io.flutter.plugins.** { *; }
-dontwarn io.flutter.embedding.**
```

### 4.3 Disable debug flags in release
- Never ship with `debugShowCheckedModeBanner: true` or any `kDebugMode`-gated
  logging that prints sensitive data.
- Use `kReleaseMode` guards around all developer tooling:

```dart
if (kDebugMode) {
  // Only active during development
  dio.interceptors.add(PrettyDioLogger());
}
```

### 4.4 Prevent screenshot / screen recording (sensitive screens)
- On screens showing PII, payment info, or credentials, enable the secure flag:

```dart
// In initState of sensitive screens
SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersive);

// Android — add to AndroidManifest or via platform channel:
// getWindow().setFlags(FLAG_SECURE, FLAG_SECURE)
```

---

## 5. Firebase Crashlytics — Secure Error Reporting

- Never pass raw exceptions that contain tokens, PII, or stack traces with
  sensitive values directly to Crashlytics.
- Sanitise error messages before recording:

```dart
void recordError(Object error, StackTrace stack) {
  final sanitised = error.toString().replaceAll(_tokenRegex, '[REDACTED]');
  FirebaseCrashlytics.instance.recordError(sanitised, stack);
}
```

- Set `FirebaseCrashlytics.instance.setCrashlyticsCollectionEnabled(!kDebugMode)`
  so crash data is only sent in release builds.

---

## 6. Clean Architecture Security Boundaries

| Layer | Allowed | Forbidden |
|---|---|---|
| `presentation/` | Read from Cubit state | Import `flutter_secure_storage`, Dio, or raw crypto |
| `domain/` | Define repository interfaces | Any platform/package import |
| `data/` | Implement storage, network, crypto | Emit BLoC states, access `BuildContext` |

- All security-sensitive implementation (token read/write, certificate loading,
  encrypted box opening) lives exclusively in `data/datasources/`.
- Domain layer exposes only abstract interfaces: `AuthRepository`, `TokenStorage`.

---

## 7. Unit Testing — Security Layer

### 7.1 What to test
- Every `SecureStorageDataSource` method: write, read, delete, deleteAll.
- Token refresh interceptor: 401 triggers refresh, retry succeeds, refresh failure
  clears storage and signals logout.
- Redaction interceptor: `Authorization` header never appears in log output.
- Encrypted box key derivation: a new key is generated when none exists, the same
  key is returned on subsequent calls.

### 7.2 Mocking secure storage
- Use `mocktail` to mock `FlutterSecureStorage` — never use the real implementation
  in unit tests (it calls platform channels).

```dart
class MockSecureStorage extends Mock implements FlutterSecureStorage {}

void main() {
  late MockSecureStorage mockStorage;
  late SecureStorageDataSource dataSource;

  setUp(() {
    mockStorage = MockSecureStorage();
    dataSource = SecureStorageDataSource(mockStorage);
  });

  group('saveAccessToken', () {
    test('writes token to secure storage under correct key', () async {
      when(() => mockStorage.write(
            key: 'access_token',
            value: 'abc123',
            aOptions: any(named: 'aOptions'),
            iOptions: any(named: 'iOptions'),
          )).thenAnswer((_) async {});

      await dataSource.saveAccessToken('abc123');

      verify(() => mockStorage.write(
            key: 'access_token',
            value: 'abc123',
            aOptions: any(named: 'aOptions'),
            iOptions: any(named: 'iOptions'),
          )).called(1);
    });
  });

  group('clearAllSecureData', () {
    test('calls deleteAll on storage', () async {
      when(() => mockStorage.deleteAll(
            aOptions: any(named: 'aOptions'),
            iOptions: any(named: 'iOptions'),
          )).thenAnswer((_) async {});

      await dataSource.clearAllSecureData();

      verify(() => mockStorage.deleteAll(
            aOptions: any(named: 'aOptions'),
            iOptions: any(named: 'iOptions'),
          )).called(1);
    });
  });
}
```

### 7.3 Testing the token refresh interceptor
- Use a `MockDio` and a `MockAuthRepository`.
- Assert that on 401: refresh is called once, original request is retried.
- Assert that on refresh failure: `deleteAll` is called and no retry occurs.

```dart
group('TokenRefreshInterceptor', () {
  test('retries original request after successful token refresh', () async {
    when(() => mockAuthRepo.refreshToken()).thenAnswer((_) async {});
    when(() => mockDio.fetch(any())).thenAnswer((_) async => Response(
          requestOptions: RequestOptions(path: '/test'),
          statusCode: 200,
        ));

    final error = DioException(
      requestOptions: RequestOptions(path: '/test'),
      response: Response(
        requestOptions: RequestOptions(path: '/test'),
        statusCode: 401,
      ),
    );

    await interceptor.onError(error, mockHandler);

    verify(() => mockAuthRepo.refreshToken()).called(1);
    verify(() => mockDio.fetch(any())).called(1);
  });

  test('clears storage when token refresh fails', () async {
    when(() => mockAuthRepo.refreshToken()).thenThrow(Exception('expired'));
    when(() => mockStorage.deleteAll(
          aOptions: any(named: 'aOptions'),
          iOptions: any(named: 'iOptions'),
        )).thenAnswer((_) async {});

    final error = DioException(
      requestOptions: RequestOptions(path: '/test'),
      response: Response(
        requestOptions: RequestOptions(path: '/test'),
        statusCode: 401,
      ),
    );

    await interceptor.onError(error, mockHandler);

    verify(() => mockStorage.deleteAll(
          aOptions: any(named: 'aOptions'),
          iOptions: any(named: 'iOptions'),
        )).called(1);
  });
});
```

### 7.4 Testing the redaction interceptor
```dart
test('redacts Authorization header in logs', () async {
  final options = RequestOptions(
    path: '/api/products',
    headers: {'Authorization': 'Bearer super_secret_token'},
  );

  // Capture log output
  final logs = <String>[];
  await runZoned(
    () async => interceptor.onRequest(options, mockHandler),
    zoneSpecification: ZoneSpecification(
      print: (_, __, ___, line) => logs.add(line),
    ),
  );

  expect(logs.any((l) => l.contains('super_secret_token')), isFalse);
  expect(logs.any((l) => l.contains('[REDACTED]')), isTrue);
});
```

### 7.5 File placement
```
features/auth/
└── data/
    └── datasources/
        ├── secure_storage_data_source.dart
        └── secure_storage_data_source_test.dart   ← co-locate or use test/

test/
└── features/
    └── auth/
        └── data/
            ├── interceptors/
            │   ├── token_refresh_interceptor_test.dart
            │   └── security_headers_interceptor_test.dart
            └── datasources/
                └── secure_storage_data_source_test.dart
```

---

## 8. Security Checklist (run before every release build)

- [ ] No tokens, passwords, or keys in source code or `pubspec.yaml`
- [ ] All sensitive values stored via `flutter_secure_storage`
- [ ] `deleteAll()` called on logout and on 401-refresh failure
- [ ] Release build uses `--obfuscate --split-debug-info`
- [ ] `minifyEnabled true` confirmed in `build.gradle`
- [ ] Certificate pinning active for all production endpoints
- [ ] `Authorization` headers redacted in all log interceptors
- [ ] `kDebugMode` guards on all developer tooling (PrettyDioLogger etc.)
- [ ] Hive boxes with user data use `HiveAesCipher`
- [ ] `FirebaseCrashlytics` collection disabled in debug mode
- [ ] No `print` / `debugPrint` statements with sensitive data in release code
- [ ] Unit tests cover `SecureStorageDataSource`, refresh interceptor, and redaction interceptor

