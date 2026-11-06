import 'dart:async';
import 'dart:developer';

import 'package:bloc/bloc.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_ether_2/flutter_ether_2.dart';
import 'package:gomingle_customer_mobile/core/cache_client/cache_client.dart';
import 'package:gomingle_customer_mobile/core/theme/theme.dart';

class AppBlocObserver extends BlocObserver {
  const AppBlocObserver();

  @override
  void onChange(BlocBase<dynamic> bloc, Change<dynamic> change) {
    super.onChange(bloc, change);
    // Bloc states can contain user data; log only in debug builds.
    if (kDebugMode) log('onChange(${bloc.runtimeType}, $change)');
  }

  @override
  void onError(BlocBase<dynamic> bloc, Object error, StackTrace stackTrace) {
    if (kDebugMode) log('onError(${bloc.runtimeType}, $error, $stackTrace)');
    super.onError(bloc, error, stackTrace);
  }
}

Future<void> bootstrap(
  FutureOr<Widget> Function(EthrThemeController) builder,
) async {
  WidgetsFlutterBinding.ensureInitialized();

  await EasyLocalization.ensureInitialized();

  await HiveCacheClient.initializeCache();

  final themeController = await buildGoMingleThemeController();

  FlutterError.onError = (details) {
    log(details.exceptionAsString(), stackTrace: details.stack);
  };

  Bloc.observer = const AppBlocObserver();

  runApp(await builder(themeController));
}
