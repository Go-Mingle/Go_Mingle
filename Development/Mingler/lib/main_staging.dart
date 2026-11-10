import 'package:gomingle_customer_mobile/app/app.dart';
import 'package:gomingle_customer_mobile/bootstrap.dart';
import 'package:gomingle_customer_mobile/utils/api_helpers/api_helpers.dart';

void main() {
  ApiEnvironment.current = ApiEnvironment.staging;
  bootstrap((tc) => App(themeController: tc));
}
