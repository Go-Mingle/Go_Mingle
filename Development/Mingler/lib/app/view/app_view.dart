part of 'view.dart';

class App extends StatelessWidget {
  const App({required this.themeController, super.key});

  final EthrThemeController themeController;

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

  final EthrThemeController themeController;

  @override
  Widget build(BuildContext context) {
    final appRouter = context.read<AppRouter>();
    return EthrThemeProvider(
      controller: themeController,
      child: MaterialApp.router(
        theme: ThemeData(
          useMaterial3: true,
          extensions: const [GoMingleStatusColors.dark],
        ),
        darkTheme: ThemeData(
          useMaterial3: true,
          brightness: Brightness.dark,
          extensions: const [GoMingleStatusColors.dark],
        ),
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
