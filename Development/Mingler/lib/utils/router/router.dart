import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:gomingle_customer_mobile/app/app.dart';

part 'routes.dart';

class AppRouter {
  AppRouter({required this.appBloc}) {
    router = GoRouter(
      initialLocation: AppRoutes.initial,
      routes: AppRoutes.list,
      refreshListenable: AppRouterRefreshStream(appBloc.stream),
      redirect: (context, state) => null,
    );
  }

  final AppBloc appBloc;

  late GoRouter router;
}

class AppRouterRefreshStream extends ChangeNotifier {
  AppRouterRefreshStream(Stream<dynamic> stream) {
    notifyListeners();
    _subscription = stream.listen((event) => notifyListeners());
  }

  late final StreamSubscription<dynamic> _subscription;

  @override
  void dispose() {
    _subscription.cancel();
    super.dispose();
  }
}
