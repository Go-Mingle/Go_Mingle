# GoMingle app (Mingler)

The Android app for Minglers: find interest tables at restaurants, join one, pay the hold and turn up for dinner. Built with Flutter; delivered as an APK.

| | |
|---|---|
| Stack | Flutter (stable channel), Dart 3, flutter_bloc, go_router, easy_localization, Hive, http |
| Flavors | `production` (com.gomingle.customer), `staging` (.stg), `development` (.dev); they install side by side |
| API | `https://gomingle-api.vercel.app/mingler/` (production and staging); `http://10.0.2.2:4000/mingler/` (development, the emulator reaching a local API). Override with `--dart-define=API_BASE_URL=...` |
| Tests | `flutter test` (unit and widget); app flows against the API with `integration_test` on an Android emulator |
| Builds | GitHub Actions (`.github/workflows/mingler.yml`) |

## Run it

Needs Flutter (stable) and the Android SDK.

```bash
flutter pub get
flutter run --flavor development -t lib/main_development.dart   # against a local API
flutter run --flavor production  -t lib/main_production.dart    # against the live API
```

| Command | |
|---|---|
| `flutter analyze` | Static analysis (`very_good_analysis`) |
| `flutter test` | Unit and widget tests |
| `flutter build apk --release --flavor production -t lib/main_production.dart` | Release APK in `build/app/outputs/flutter-apk/` |

## Getting the APK

Every pull request that touches this folder runs the **Mingler app** workflow: analysis, tests, then the production and staging APKs as a downloadable artifact. Each merge to `main` also publishes them on the repository's **Releases** page as `mingler-v<version>`.

Release builds are signed with the debug key until a release keystore is added to the repository secrets (`ANDROID_KEYSTORE_*`). They install fine for testing; the Play Store needs the real key.

## Layout

```
lib/
  main_<flavor>.dart   entry point per flavor
  bootstrap.dart       start-up: localisation, cache, theme, bloc observer
  app/                 the app widget, app-level bloc, router host
  core/                auth (API, repository), cache, theme
  utils/               API client, router, validators, locale strings, helpers
assets/                fonts (Poppins, Bricolage Grotesque), images, translations
test/                  unit and widget tests, mirroring lib/
android/               Gradle (Kotlin DSL), flavors and signing
```

## Conventions

- Screens read colours and type from `Theme.of(context)`; tokens live in `core/theme/`.
- Strings go through `easy_localization` (`assets/translations/`).
- Each change is logged in the version history in the root `README.md` and on Jira.
