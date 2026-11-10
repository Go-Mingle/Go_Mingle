---
description: >
  Always-active rule for the entire Flutter project and all feature development.
  Enforces Clean Architecture boundaries, BLoC/Cubit conventions, naming
  standards, error handling, logging, and test structure.
  Architecture violations are HARD BLOCKS — the agent must never proceed.
  Style violations are SOFT WARNINGS — the agent flags the issue and continues.

alwaysApply: true
---

# Flutter Team — Cursor Rule
## Stack: Clean Architecture · BLoC/Cubit · Freezed · Dio · Hive/Isar · go_router · Injectable/get_it

---

## ENFORCEMENT LEVELS

| Level | Meaning |
|---|---|
| 🚫 HARD BLOCK | Agent must STOP, refuse to generate the violating code, and explain why |
| ⚠️ SOFT WARNING | Agent generates code but adds an inline `// ⚠️ STYLE:` comment flagging the issue |

---

## 1. Clean Architecture Layer Boundaries — 🚫 HARD BLOCK

These rules are non-negotiable. Violating them breaks the architecture permanently.

### 1.1 Folder structure
Every feature must follow this exact structure — no exceptions:

```
lib/
└── features/
    └── <feature_name>/
        ├── data/
        │   ├── datasources/       # Remote & local data sources
        │   ├── models/            # DTOs — Freezed, json_serializable
        │   └── repositories/      # Concrete repository implementations
        ├── domain/
        │   ├── entities/          # Pure Dart classes, no package imports
        │   ├── repositories/      # Abstract repository interfaces
        │   └── usecases/          # One public method per use case
        └── presentation/
            ├── bloc/              # Cubits and BLoCs only
            ├── pages/             # Full screens registered in go_router
            └── widgets/           # Reusable feature-scoped widgets
```

### 1.2 Import direction — strictly top-down only

```
presentation → domain ✅
data         → domain ✅
domain       → (nothing inside the project) ✅

presentation → data   🚫 HARD BLOCK
data         → presentation 🚫 HARD BLOCK
domain       → data   🚫 HARD BLOCK
domain       → presentation 🚫 HARD BLOCK
```

- 🚫 HARD BLOCK: `presentation/` files must never import from `data/`.
- 🚫 HARD BLOCK: `domain/` files must never import Flutter packages, Dio, Hive,
  Isar, `flutter_secure_storage`, or any third-party package
  and pure Dart packages.
- 🚫 HARD BLOCK: Never pass `BuildContext` into a Cubit, use case, repository,
  or data source.

### 1.3 Use cases
- 🚫 HARD BLOCK: Every use case must have exactly one public method (`call` or
  a named equivalent). No use case may contain more than one business operation.
- 🚫 HARD BLOCK: Use cases must only call repository interfaces — never data
  sources directly.

### 1.4 Repositories
- 🚫 HARD BLOCK: Repository interfaces live in `domain/repositories/`.
- 🚫 HARD BLOCK: Concrete implementations live in `data/repositories/`.
- Never put business logic inside a repository — it belongs in a use case.

---

## 2. BLoC / Cubit Conventions

### 2.1 Hard blocks
- 🚫 HARD BLOCK: Never use `StatefulWidget` + `setState` for business/feature
  state. Use a Cubit or BLoC.
- 🚫 HARD BLOCK: Never emit state directly from a widget — always via a Cubit
  method.
- 🚫 HARD BLOCK: Cubits must never import Flutter widgets or `BuildContext`.
- ⚠️ SOFT WARNING: Prefer `@injectable` (factory) registration for Cubits/BLoCs.
  Exception: app-scoped state (auth, theme, connectivity, locale) may use
  `@singleton` or `@lazySingleton` with team approval.

### 2.2 State design with Freezed
- 🚫 HARD BLOCK: All Cubit/BLoC state classes must be defined with `@freezed`.
- States must cover these statuses at minimum: `initial`, `loading`, `success`,
  `failure`.

```dart
// ✅ Required pattern
@freezed
class ProductState with _$ProductState {
  const factory ProductState.initial() = _Initial;
  const factory ProductState.loading() = _Loading;
  const factory ProductState.success({required List<Product> items}) = _Success;
  const factory ProductState.failure({required String message}) = _Failure;
}
```

### 2.3 Soft warnings
- ⚠️ SOFT WARNING: `BlocBuilder` wrapping more than one top-level widget —
  consider narrowing scope or using `buildWhen`.
- ⚠️ SOFT WARNING: Emitting more than one state per method call — consider
  batching with a single `copyWith`.
- ⚠️ SOFT WARNING: Missing `buildWhen` or `listenWhen` on a `BlocBuilder` /
  `BlocListener` that rebuilds frequently.

---

## 3. Naming Conventions

### 3.1 Files — 🚫 HARD BLOCK
All filenames must use `snake_case`. No exceptions.

| Artifact | Pattern | Example |
|---|---|---|
| Screen / Page | `<name>_page.dart` | `product_detail_page.dart` |
| Widget | `<name>_widget.dart` | `product_card_widget.dart` |
| Cubit | `<name>_cubit.dart` | `product_cubit.dart` |
| Cubit State | `<name>_state.dart` | `product_state.dart` |
| BLoC | `<name>_bloc.dart` | `auth_bloc.dart` |
| BLoC Event | `<name>_event.dart` | `auth_event.dart` |
| Use Case | `<name>_use_case.dart` | `get_products_use_case.dart` |
| Entity | `<name>.dart` | `product.dart` |
| DTO / Model | `<name>_model.dart` | `product_model.dart` |
| Repository interface | `<name>_repository.dart` | `product_repository.dart` |
| Repository impl | `<name>_repository_impl.dart` | `product_repository_impl.dart` |
| Data source | `<name>_data_source.dart` | `product_remote_data_source.dart` |
| Test file | `<source_file>_test.dart` | `product_cubit_test.dart` |

### 3.2 Classes — ⚠️ SOFT WARNING
- Classes must use `PascalCase`.
- Cubit classes: `ProductCubit`, not `ProductBloc` or `ProductController`.
- Use case classes: `GetProductsUseCase`, not `GetProducts` or `ProductsUseCase`.
- DTO/model classes: `ProductModel`, entity classes: `Product` (no suffix).

### 3.3 Methods & variables — ⚠️ SOFT WARNING
- All methods and variables use `camelCase`.
- Boolean variables/getters must be prefixed: `isLoading`, `hasError`,
  `canSubmit` — never `loading`, `error`, `submit`.
- Private members prefixed with `_`: `_productRepo`, `_cancelToken`.

---

## 4. Error Handling & Either / Failure Pattern — 🚫 HARD BLOCK

### 4.1 Return types
- 🚫 HARD BLOCK: Repository methods and use cases must return
  `Future<Either<Failure, T>>` — never throw exceptions across layer boundaries.
- 🚫 HARD BLOCK: Never use raw `try/catch` in presentation layer — handle
  `Left<Failure>` from the use case result instead.

```dart
// ✅ Domain layer — use case return type
Future<Either<Failure, List<Product>>> call() async {
  return _repository.getProducts();
}

// ✅ Presentation layer — Cubit handles Either
final result = await _getProductsUseCase();
result.fold(
  (failure) => emit(ProductState.failure(message: failure.message)),
  (products) => emit(ProductState.success(items: products)),
);
```

### 4.2 Failure classes
- All failure classes must extend the base `Failure` class in
  `core/error/failures.dart`.
- Use specific subtypes: `ServerFailure`, `CacheFailure`, `NetworkFailure`,
  `AuthFailure` — never use a generic `Failure` directly.

```dart
// ✅
abstract class Failure {
  final String message;
  const Failure({required this.message});
}

class ServerFailure extends Failure {
  const ServerFailure({required super.message});
}

class NetworkFailure extends Failure {
  const NetworkFailure({required super.message});
}
```

### 4.3 Dio exceptions
- 🚫 HARD BLOCK: Never let `DioException` propagate beyond the data layer.
  Catch it in the data source or repository impl and map to a `Failure`.

```dart
// ✅ In data/repositories/product_repository_impl.dart
try {
  final result = await _remoteDataSource.getProducts();
  return Right(result.map((m) => m.toEntity()).toList());
} on DioException catch (e) {
  return Left(ServerFailure(message: e.message ?? 'Server error'));
} on CacheException catch (e) {
  return Left(CacheFailure(message: e.message));
}
```

---

## 5. Logging & Debugging Standards

### 5.1 Hard blocks
- 🚫 HARD BLOCK: Never use `print()` anywhere in the codebase.
- 🚫 HARD BLOCK: Never log tokens, passwords, API keys, or any PII.
- 🚫 HARD BLOCK: Never leave `debugPrint` statements in code that is merged
  to `main` / `develop` branches.

### 5.2 Approved logging pattern
- Use `dart:developer` `log()` with a named logger in debug mode only.
- Wrap all logging in `kDebugMode` guards.

```dart
import 'dart:developer' as dev;
import 'package:flutter/foundation.dart';

// ✅ Correct logging
if (kDebugMode) {
  dev.log('Fetching products', name: 'ProductRepository');
  dev.log('Error: ${failure.message}', name: 'ProductCubit', error: failure);
}
```

### 5.3 Firebase Crashlytics
- Use Crashlytics only for unexpected runtime errors — never for expected
  business failures (`Left<Failure>`).
- Sanitise all messages before recording (see Security Skill §5).

```dart
// ✅ Only for truly unexpected errors
FlutterError.onError = (details) {
  if (kReleaseMode) {
    FirebaseCrashlytics.instance.recordFlutterFatalError(details);
  }
};
```

### 5.4 Soft warnings
- ⚠️ SOFT WARNING: Dio `PrettyDioLogger` or equivalent must be wrapped in
  `if (kDebugMode)` — flag if found outside a debug guard.
- ⚠️ SOFT WARNING: Any `TODO` or `FIXME` comment older than the current
  feature branch should be flagged for resolution.

---

## 6. Test File Structure

### 6.1 Hard blocks
- 🚫 HARD BLOCK: Test files must mirror the `lib/` folder structure under
  `test/`. A file at `lib/features/auth/data/repositories/auth_repository_impl.dart`
  must have its test at
  `test/features/auth/data/repositories/auth_repository_impl_test.dart`.
- 🚫 HARD BLOCK: Never use the real `FlutterSecureStorage`, `Dio`, `Hive`, or
  `Isar` in unit tests — always mock via `mocktail`.
- 🚫 HARD BLOCK: Cubit tests must use `bloc_test` — never manually call
  `cubit.method()` and then check `cubit.state` without `bloc_test`.

### 6.2 Required test groups per file type

| File type | Required test groups |
|---|---|
| Cubit | `'initial state'`, `'<methodName> — success'`, `'<methodName> — failure'` |
| Repository impl | `'returns Right on success'`, `'returns Left<Failure> on exception'` |
| Use case | `'calls repository with correct params'`, `'returns failure from repository'` |
| Data source | `'parses response correctly'`, `'throws exception on error status'` |

### 6.3 Cubit test template
```dart
void main() {
  late ProductCubit cubit;
  late MockGetProductsUseCase mockUseCase;

  setUp(() {
    mockUseCase = MockGetProductsUseCase();
    cubit = ProductCubit(mockUseCase);
  });

  tearDown(() => cubit.close());

  test('initial state is ProductState.initial()', () {
    expect(cubit.state, const ProductState.initial());
  });

  group('fetchProducts', () {
    blocTest<ProductCubit, ProductState>(
      'emits [loading, success] when use case returns Right',
      build: () {
        when(() => mockUseCase()).thenAnswer((_) async => Right(fakeProducts));
        return ProductCubit(mockUseCase);
      },
      act: (cubit) => cubit.fetchProducts(),
      expect: () => [
        const ProductState.loading(),
        ProductState.success(items: fakeProducts),
      ],
    );

    blocTest<ProductCubit, ProductState>(
      'emits [loading, failure] when use case returns Left',
      build: () {
        when(() => mockUseCase()).thenAnswer(
          (_) async => Left(ServerFailure(message: 'error')),
        );
        return ProductCubit(mockUseCase);
      },
      act: (cubit) => cubit.fetchProducts(),
      expect: () => [
        const ProductState.loading(),
        const ProductState.failure(message: 'error'),
      ],
    );
  });
}
```

### 6.4 Soft warnings
- ⚠️ SOFT WARNING: Test coverage below 80% for any Cubit or repository —
  flag and suggest missing cases.
- ⚠️ SOFT WARNING: Missing `tearDown(() => cubit.close())` in Cubit tests.
- ⚠️ SOFT WARNING: Using `any()` matcher without a named parameter when
  `mocktail` supports named matching — reduces test precision.

---

## 7. General Agent Behaviour

- When generating a new feature, always scaffold all three layers
  (`data/`, `domain/`, `presentation/`) — never generate just one layer in
  isolation unless the user explicitly asks for it.
- When modifying an existing file, check its layer and apply only the rules
  that belong to that layer.
- When a HARD BLOCK violation is detected in existing code that the user asks
  to extend, stop and report the violation before writing any new code.
- Always run mentally through the PR checklist from the Performance and
  Security skills before declaring a task complete.
- Prefer `Either` + `Failure` over `Exception` for all cross-layer error
  propagation — suggest refactoring if an existing method throws instead.