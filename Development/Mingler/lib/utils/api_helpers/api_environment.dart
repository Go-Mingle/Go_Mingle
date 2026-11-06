enum ApiEnvironment {
  production(baseUrl: 'https://backend.example.com/'),
  staging(baseUrl: 'https://backend.example.qa/'),
  development(baseUrl: 'https://backend.example.dev/');

  const ApiEnvironment({required this.baseUrl});

  /// Placeholder per-flavor URL. Real values should be injected at build time
  /// with `--dart-define=API_BASE_URL=https://...` (see [resolvedBaseUrl]).
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
