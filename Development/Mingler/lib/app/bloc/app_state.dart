part of 'app_bloc.dart';

enum AuthStatus { unknown, authenticated, unauthenticated }

class AppState extends Equatable {
  const AppState({
    this.authStatus = AuthStatus.unknown,
    this.user = User.empty,
  });

  final AuthStatus authStatus;
  final User user;

  AppState copyWith({AuthStatus? authStatus, User? user}) {
    return AppState(
      authStatus: authStatus ?? this.authStatus,
      user: user ?? this.user,
    );
  }

  bool get isAuthenticated => authStatus == AuthStatus.authenticated;

  bool get isUnauthenticated => !isAuthenticated;

  @override
  List<Object?> get props => [authStatus, user];
}
