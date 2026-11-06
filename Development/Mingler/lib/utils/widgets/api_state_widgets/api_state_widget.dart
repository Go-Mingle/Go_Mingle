import 'package:flutter/material.dart';
import 'package:gomingle_customer_mobile/utils/helpers/api_state.dart';
import 'package:gomingle_customer_mobile/utils/widgets/primary_button.dart';

part 'app_error.dart';
part 'app_progress_indicator.dart';

class APIStateWidget<T> extends StatelessWidget {
  const APIStateWidget({
    required this.apiState,
    required this.emptyErrorMessage,
    required this.successWidget,
    this.initialWidget,
    this.loadingWidget,
    this.failureWidget,
    this.onInitialState,
    this.onSuccessState,
    this.onRetry,
    super.key,
  });

  final APIState<T> apiState;
  final String emptyErrorMessage;
  final Widget successWidget;
  final Widget? failureWidget;
  final Widget? loadingWidget;
  final Widget? initialWidget;
  final void Function()? onInitialState;
  final void Function()? onSuccessState;
  final void Function()? onRetry;

  @override
  Widget build(BuildContext context) {
    switch (apiState.state) {
      case APICallState.initial:
        return _buildInitialWidget();
      case APICallState.loading:
        return _buildLoadingWidget();
      case APICallState.loaded:
        onSuccessState?.call();
        if (apiState.isEmpty) {
          return _buildFailureWidget(emptyErrorMessage);
        }
        return successWidget;
      case APICallState.failure:
        return _buildFailureWidget();
    }
  }

  Widget _buildFailureWidget([String? errorMessage]) {
    return failureWidget ??
        AppError(
          message: apiState.error ?? errorMessage ?? 'Something went wrong!',
          retry: onRetry,
        );
  }

  Widget _buildLoadingWidget() => loadingWidget ?? const AppProgress();

  Widget _buildInitialWidget() {
    onInitialState?.call();
    return initialWidget ?? const SizedBox();
  }
}
