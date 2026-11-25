part of 'view.dart';

class App extends StatelessWidget {
  const App({required this.themeController, super.key});

  final ThemeController themeController;

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (context) => AppBloc(authRepository: AuthRepositoryImpl()),
      child: RepositoryProvider(
        create: (context) => AppRouter(appBloc: context.read<AppBloc>()),
        child: EasyLocalization(
          supportedLocales: kSupportedLocale,
          path: kLocaleAssetPath,
          fallbackLocale: kFallBackLocale,
          child: AppView(themeController: themeController),
        ),
      ),
    );
  }
}

class AppView extends StatelessWidget {
  const AppView({required this.themeController, super.key});

  final ThemeController themeController;

  @override
  Widget build(BuildContext context) {
    final appRouter = context.read<AppRouter>();
    return ValueListenableBuilder<ThemeMode>(
      valueListenable: themeController,
      builder: (context, mode, _) => MaterialApp.router(
        title: 'GoMingle',
        theme: GoMingleTheme.light(),
        darkTheme: GoMingleTheme.dark(),
        themeMode: mode,
        localizationsDelegates: context.localizationDelegates,
        supportedLocales: context.supportedLocales,
        locale: context.locale,
        routerConfig: appRouter.router,
        debugShowCheckedModeBanner: false,
      ),
    );
  }
}

class HomeView extends StatelessWidget {
  const HomeView({super.key});

  static const String route = '/home';

  @override
  Widget build(BuildContext context) => const Scaffold();
}
