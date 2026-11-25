enum ApiEnvironment {
  production(baseUrl: 'https://gomingle-api.vercel.app/mingler/'),
  // Staging uses the live API until a separate staging API exists.
  staging(baseUrl: 'https://gomingle-api.vercel.app/mingler/'),
  // The Android emulator reaches the computer's localhost at 10.0.2.2.
  development(baseUrl: 'http://10.0.2.2:4000/mingler/');

  const ApiEnvironment({required this.baseUrl});

  /// Default API address for this flavor. Override it at build time with
  /// `--dart-define=API_BASE_URL=https://...` (see [resolvedBaseUrl]).
  final String baseUrl;

  /// Build-time override: `flutter run --dart-define=API_BASE_URL=https://...`.
  static const String _baseUrlOverride = String.fromEnvironment('API_BASE_URL');

  /// The URL requests are actually sent to: the `API_BASE_URL` dart-define when
  /// provided, otherwise this flavor's [baseUrl]. Always ends with a slash so
  /// endpoint paths concatenate safely.
  String get resolvedBaseUrl {
    final url = _baseUrlOverride.isNotEmpty ? _baseUrlOverride : baseUrl;
    return url.endsWith('/') ? url : '$url/';
  }

  bool get isProduction => this == ApiEnvironment.production;
  bool get isStaging => this == ApiEnvironment.staging;
  bool get isDevelopment => this == ApiEnvironment.development;

  static ApiEnvironment _current = ApiEnvironment.development;

  static ApiEnvironment get current => _current;

  static set current(ApiEnvironment env) => _current = env;
}
