part of 'router.dart';

class AppRoutes {
  AppRoutes._();

  static const String initial = HomeView.route;

  static List<RouteBase> get list => [
        GoRoute(
          path: HomeView.route,
          builder: (_, __) => const HomeView(),
        ),
      ];
}
