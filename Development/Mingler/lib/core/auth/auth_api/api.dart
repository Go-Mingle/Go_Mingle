import 'package:gomingle_customer_mobile/core/auth/auth_api/config/config.dart';
import 'package:gomingle_customer_mobile/core/auth/auth_api/entities/entities.dart';
import 'package:gomingle_customer_mobile/core/auth/auth_repository/repository.dart';
import 'package:gomingle_customer_mobile/utils/api_helpers/api_helpers.dart';
import 'package:gomingle_customer_mobile/utils/helpers/typedefs.dart';

export 'entities/entities.dart';

part 'auth_api.dart';

abstract class AuthApi {
  Future<UserEntity> signIn(SignInDto dto);

  Future<UserEntity> signUp(SignUpDto dto);
}
