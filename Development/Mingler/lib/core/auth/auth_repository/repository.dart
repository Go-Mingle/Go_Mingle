import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:gomingle_customer_mobile/core/auth/auth_api/api.dart';
import 'package:gomingle_customer_mobile/core/auth/auth_repository/dtos/dtos.dart';
import 'package:gomingle_customer_mobile/core/auth/auth_repository/models/models.dart';
import 'package:gomingle_customer_mobile/core/cache_client/cache_client.dart';
import 'package:gomingle_customer_mobile/utils/helpers/typedefs.dart';

export 'dtos/dtos.dart';
export 'models/models.dart';

part 'auth_repository.dart';

/// {@template authentication_repository}
/// Repository which manages user authentication.
/// {@endtemplate}
abstract class AuthRepository {
  /// {@macro authentication_repository}
  AuthRepository({
    CacheClient? cache,
    StreamController<User>? userAuth,
  })  : _cache = cache ?? HiveCacheClient(),
        _userAuth = userAuth ?? StreamController<User>.broadcast();

  final CacheClient _cache;
  final StreamController<User> _userAuth;

  /// User cache key.
  /// Should only be used for testing purposes.
  @visibleForTesting
  static const userCacheKey = '__user_cache_key__';

  /// Stream of [User] which will emit the current user when
  /// the authentication state changes.
  ///
  /// Emits [User.empty] if the user is not authenticated.
  Stream<User> get user async* {
    yield currentUser;
    yield* _userAuth.stream.map((user) {
      _cache.write<String>(key: userCacheKey, value: jsonEncode(user.toJson));
      return user;
    });
  }

  /// Returns the current cached user.
  /// Defaults to [User.empty] if there is no cached user.
  User get currentUser {
    final userJson = _cache.read<String>(key: userCacheKey);
    return userJson == null
        ? User.empty
        : User.fromJson(jsonDecode(userJson) as JsonMap);
  }

  /// id of the current user
  String? get userId => currentUser.isEmpty ? null : currentUser.id;

  bool get isAuthenticated => currentUser.isNotEmpty;

  /// Updates the user stream with the new [user].
  void updateUser(User user) => _userAuth.add(user);

  Future<void> signIn(SignInDto dto);

  Future<void> signUp(SignUpDto dto);

  Future<void> signOut();

  /// disposes the _userAuth stream
  Future<void> dispose() async {
    await _cache.close();
    await _userAuth.close();
  }
}
