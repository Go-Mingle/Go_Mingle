---
name: flutter-performance
description: >
  Use this skill when the user is building, refactoring, or reviewing any Flutter
  widget, BLoC/Cubit, repository, data source, or Hive/Isar storage code and
  performance is a concern. Also activate when the user asks to optimise, profile,
  reduce rebuilds, improve list performance, or cache data.
---

# Flutter Performance Skill
## Stack: Clean Architecture · BLoC/Cubit · Freezed · Dio · Hive/Isar · go_router · Injectable/get_it

---

## 1. Widget & Rebuild Optimisation

### 1.1 Narrow BlocBuilder / BlocConsumer scope
- **Never** wrap a large subtree in `BlocBuilder` when only a small part of the UI
  depends on state.
- Extract the reactive part into a dedicated child widget or use `buildWhen` to
  filter unnecessary rebuilds.

```dart
// ❌ Bad — entire screen rebuilds on every state change
BlocBuilder<ProductCubit, ProductState>(
  builder: (context, state) => Scaffold(body: ProductBody(state)),
);

// ✅ Good — only the price text rebuilds
BlocBuilder<ProductCubit, ProductState>(
  buildWhen: (prev, curr) => prev.price != curr.price,
  builder: (context, state) => PriceText(price: state.price),
);
```

### 1.2 Prefer const constructors everywhere
- Mark every widget `const` when all parameters are compile-time constants.
- Prefer `const` for static children inside lists and columns.

```dart
// ✅
const SizedBox(height: 16),
const Divider(),
const _HeaderWidget(),
```

### 1.3 Use RepaintBoundary for heavy, isolated widgets
- Wrap complex cards, charts, or image tiles in `RepaintBoundary` so they do not
  trigger repaints on parent state changes.

```dart
RepaintBoundary(child: HeavyChartWidget(data: data)),
```

### 1.4 ListView / GridView rules
- Always use `ListView.builder` / `GridView.builder` for dynamic lists — never
  `ListView(children: [...])` with more than ~10 items.
- Set `addAutomaticKeepAlives: false` and `addRepaintBoundaries: false` only when
  items are very cheap to rebuild.
- For heterogeneous lists use `CustomScrollView` + `SliverList` / `SliverGrid`.
- For very long lists (1 000+ items) use `flutter_large_list` or paged loading.

### 1.5 Image performance
- Always specify `cacheWidth` / `cacheHeight` when displaying images in lists.
- Use `cached_network_image` for all remote images.
- Never decode large images at full resolution inside a small `Container`.

---

## 2. BLoC / Cubit Performance Rules

### 2.1 Emit states sparingly
- Batch multiple field changes into a single `emit` rather than emitting one
  state per field.
- Use `Freezed` `copyWith` for partial state updates — never rebuild the full
  state object manually.

```dart
// ❌ Bad — two rebuilds
emit(state.copyWith(isLoading: true));
emit(state.copyWith(items: items));

// ✅ Good — one rebuild
emit(state.copyWith(isLoading: false, items: items));
```

### 2.2 Close streams properly
- Every `StreamSubscription` opened inside a Cubit must be cancelled in `close()`.
- Prefer `on<Event>` transformer `droppable()` for search/filter events to avoid
  redundant API calls (requires `bloc_concurrency`).

```dart
on<SearchQueryChanged>(
  _onSearchQueryChanged,
  transformer: droppable(),
);
```

### 2.3 Avoid business logic in UI layer
- Cubits/BLoCs live in `presentation/bloc/` but must **never** import Flutter
  widgets or `BuildContext`.
- All data transformation lives in the domain layer (use cases), not in the Cubit.

---

## 3. Dio & Network Performance

### 3.1 Single Dio instance via Injectable
- Register Dio as `@singleton` in the DI module. Never instantiate Dio inside a
  repository or data source directly.

```dart
@module
abstract class NetworkModule {
  @singleton
  Dio get dio => Dio(BaseOptions(
    connectTimeout: const Duration(seconds: 10),
    receiveTimeout: const Duration(seconds: 15),
  ));
}
```

### 3.2 Response caching
- Use `dio_cache_interceptor` for GET endpoints that change infrequently.
- Set `CachePolicy.forceCache` for static/reference data and `CachePolicy.request`
  for user-specific data.

### 3.3 Request cancellation
- Store `CancelToken` in the Cubit and call `cancelToken.cancel()` in `close()`.
- This prevents dangling requests when the user navigates away.

```dart
final CancelToken _cancelToken = CancelToken();

Future<void> fetchProducts() async {
  final result = await _repo.getProducts(cancelToken: _cancelToken);
  // ...
}

@override
Future<void> close() {
  _cancelToken.cancel();
  return super.close();
}
```

---

## 4. Hive / Isar Local Storage Performance

### 4.1 Hive
- Open boxes only once at app start (inside `AppModule` or `main.dart`) and
  access them via the registered service — never call `Hive.openBox` inside a
  widget or repository method.
- Use `LazyBox` for large collections where you only need a subset of values.
- Compact boxes on startup for write-heavy boxes: `await box.compact()`.

### 4.2 Isar
- Always run write operations inside `isar.writeTxn()` — batch multiple writes
  into a single transaction.
- Use `.where()` indexes for queries instead of `.filter()` on unindexed fields.
- Prefer `watchLazy()` over `watch()` when you only need to know *that* a change
  happened, not what changed.

```dart
// ✅ Batch writes
await isar.writeTxn(() async {
  await isar.products.putAll(products);
});
```

---

## 5. go_router Performance

- Define route configurations as `static const` lists — never build them inside
  a widget's `build` method.
- Use `ShellRoute` for persistent bottom navigation bars to avoid rebuilding the
  shell on every navigation.
- Prefer `router.pushNamed()` over `router.push()` to avoid hardcoding paths.

---

## 6. Dependency Injection (Injectable / get_it)

- Register expensive services (Dio, Hive boxes, Isar instance) as `@singleton`.
- Register repositories as `@lazySingleton` so they are instantiated only when
  first requested.
- Register Cubits/BLoCs as `@injectable` (factory) — never as singletons — so
  state is fresh per screen.
- Run `configureDependencies()` once in `main.dart` before `runApp`.

---

## 7. App Startup Performance

- Minimise work in `main.dart` before `runApp` — defer non-critical initialisation
  using `WidgetsBinding.instance.addPostFrameCallback`.
- Use `flutter_native_splash` to eliminate the white flash on cold start.
- Defer Firebase initialisation if it is not needed on the first screen.

---

## 8. Memory Management

- Never store `BuildContext` inside a Cubit or service.
- Dispose `TextEditingController`, `ScrollController`, `AnimationController` in
  `dispose()` — never rely on GC.
- Avoid creating closures inside `build()` that capture large objects.

---

## 9. Unit Testing — Performance-Critical Code

### 9.1 What to test for performance correctness
- Cubits emit the correct number of states (no redundant emits).
- `CancelToken` is cancelled when the Cubit is closed.
- Repository methods hit the cache on the second call (when using `dio_cache_interceptor`).
- Isar / Hive write methods are called with batched data, not in a loop.

### 9.2 Testing Cubit emit count
Use `bloc_test` to assert that a single action produces exactly one state emission,
not multiple partial ones.

```dart
// pubspec.yaml: bloc_test, mocktail

blocTest<ProductCubit, ProductState>(
  'emits exactly one state with loading=false and items on success',
  build: () {
    when(() => mockRepo.getProducts(cancelToken: any(named: 'cancelToken')))
        .thenAnswer((_) async => Right(fakeProducts));
    return ProductCubit(mockRepo);
  },
  act: (cubit) => cubit.fetchProducts(),
  expect: () => [
    // Only ONE state — not isLoading:true then isLoading:false
    ProductState.success(items: fakeProducts),
  ],
);
```

### 9.3 Testing CancelToken is cancelled on close
```dart
test('cancels token when cubit is closed', () async {
  when(() => mockRepo.getProducts(cancelToken: any(named: 'cancelToken')))
      .thenAnswer((_) async => Right([]));

  final cubit = ProductCubit(mockRepo);
  await cubit.fetchProducts();
  await cubit.close();

  final captured = verify(() => mockRepo.getProducts(
        cancelToken: captureAny(named: 'cancelToken'),
      )).captured;

  final token = captured.first as CancelToken;
  expect(token.isCancelled, isTrue);
});
```

### 9.4 Testing repository cache behaviour
```dart
test('returns cached result on second call without hitting remote', () async {
  when(() => mockRemoteDataSource.getProducts())
      .thenAnswer((_) async => fakeProductDtos);

  // First call — hits remote
  await repository.getProducts();
  // Second call — should hit cache
  await repository.getProducts();

  // Remote data source called only once
  verify(() => mockRemoteDataSource.getProducts()).called(1);
});
```

### 9.5 Testing Isar batch writes
```dart
test('putAll is called once with all products, not in a loop', () async {
  when(() => mockIsarProducts.putAll(any())).thenAnswer((_) async => []);

  await localDataSource.saveProducts(fakeProducts);

  // Verify batch write — single call with full list
  verify(() => mockIsarProducts.putAll(fakeProducts)).called(1);
  // Verify NOT called per item
  verifyNever(() => mockIsarProducts.put(any()));
});
```

### 9.6 File placement
```
test/
└── features/
    └── products/
        ├── presentation/
        │   └── bloc/
        │       └── product_cubit_test.dart      ← emit count, cancel token
        └── data/
            ├── repositories/
            │   └── product_repository_test.dart  ← cache, error handling
            └── datasources/
                └── product_local_datasource_test.dart  ← batch writes
```

---

## 10. Performance Checklist (run before every PR)

- [ ] No `BlocBuilder` wrapping unnecessarily large subtrees
- [ ] All static widgets have `const` constructors
- [ ] All lists use `.builder` constructors
- [ ] Dio is a singleton; `CancelToken` is used for long requests
- [ ] No `Hive.openBox` calls outside of initialisation
- [ ] Isar writes are batched in transactions
- [ ] No business logic / `compute`-worthy work on the main isolate
- [ ] `flutter analyze` passes with zero warnings
- [ ] `flutter build apk --profile` shows no jank in DevTools timeline
- [ ] Cubit tests assert single-emit pattern (no redundant state emissions)
- [ ] Repository tests verify cache is used on repeat calls
