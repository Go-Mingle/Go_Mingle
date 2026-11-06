/// Configure REST API properties to be used later on
/// throughout API calls
///
/// Though for a specific use case these can also be
/// overridden in API call functions it [getRequest()]
/// and [postRequest()]
class APIConfig {
  /// header for the project
  static Map<String, String> header = {'content-type': 'application/json'};

  /// duration for timeout request
  static Duration responseTimeout = const Duration(seconds: 10);
}
