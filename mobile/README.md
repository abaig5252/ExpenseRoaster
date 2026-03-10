# Expense Roaster — Mobile App

React Native (Expo SDK 55) app for the Expense Roaster platform, targeting iOS App Store and Google Play Store.

**SDK versions:** Expo 55 · React Native 0.84 · React 19 · New Architecture enabled

---

## Prerequisites

- Node.js 18+
- Xcode 16+ (for iOS builds, required for React Native 0.84 / New Architecture)
- Android Studio Ladybug or later (for Android builds)
- EAS CLI: `npm install -g eas-cli`
- An Apple Developer account (for App Store) or Google Play developer account

---

## Setup

### 1. Install dependencies

```bash
cd mobile
npm install
```

### 2. Configure the API URL

Copy the example env file and set your deployed backend URL:

```bash
cp .env.example .env
```

Edit `.env`:
```
EXPO_PUBLIC_API_URL=https://your-app.replit.app
```

> ⚠️ Always use `https://` not `http://` — using `http://` causes "Save Failed: non-JSON response" errors on mobile.

> During local development you can use your Replit dev URL (e.g. `https://xxx.replit.dev`).

### 3. Install iOS native dependencies (Mac only)

```bash
cd ios
pod install
cd ..
```

---

## Running the app

### iOS Simulator

```bash
npx expo run:ios
```

Or open the `ios/*.xcworkspace` file in Xcode and press Run.

> ⚠️ Always open `ExpenseRoaster.xcworkspace` — never `ExpenseRoaster.xcodeproj`.

### Android Emulator

```bash
npx expo run:android
```

### Expo Go (quick preview, limited native features)

```bash
npx expo start
```

> ⚠️ **Expo Go does NOT work with this project.** SDK 55 with React Native 0.84 and React 19 is too new for Expo Go. Use `npx expo run:ios --device` instead.

---

## Project Details

| Item | Value |
|---|---|
| Bundle ID | `com.santhini.expenseroaster` |
| EAS Project | `@santhi.code/expense-roaster` |
| EAS Dashboard | [expo.dev/accounts/santhi.code/projects/expense-roaster](https://expo.dev/accounts/santhi.code/projects/expense-roaster) |
| Apple Developer Account | `admin@expenseroaster.com` |
| Apple Team | `santhini sasidharan (QDS7A37HUR)` |

---

## Daily Development Workflow

```bash
# First time OR after any native changes (app.json, new packages):
cd mobile
npx expo run:ios --device

# Every day for JS-only changes (fastest):
cd mobile
npx expo start --dev-client
```

**Rule of thumb:**
- Changed `.ts` / `.tsx` files only → `npx expo start --dev-client`
- Changed `app.json`, installed new package, or native code → `npx expo run:ios`

---

## Full Clean Rebuild (when things break)

```bash
cd mobile

# 1. Delete the old generated native folders and node_modules
rm -rf node_modules ios android

# 2. Reinstall dependencies
npm install

# 3. Regenerate the native iOS project
npx expo prebuild --platform ios --clean

# 4. Install pods
cd ios && pod install && cd ..

# 5. Build and run
npx expo run:ios
```

> **Xcode tip:** Use **Cmd + K** to clean the build folder before rebuilding when you see stale errors.

---

## Building for stores

### Build types explained

| Build Type | Command | Use When | Needs Laptop? |
|---|---|---|---|
| **Development** | `npx expo run:ios --device` | Your own daily testing | ✅ Yes |
| **Preview** | `eas build --profile preview` | Sharing with testers | ❌ No |
| **Production** | `eas build --profile production` | App Store release | ❌ No |
| **EAS Update** | `eas update --branch preview` | JS-only changes to testers | ❌ No |

### Configure EAS

```bash
eas login
eas build:configure
```

### iOS build (TestFlight / App Store)

```bash
npm run build:ios
```

Then submit:
```bash
eas submit --platform ios
```

### Android build (Google Play)

```bash
npm run build:android
```

Then submit:
```bash
eas submit --platform android
```

---

## Sharing With Testers (Preview Builds)

### iOS — EAS Preview (shareable link)

```bash
eas build --profile preview --platform ios
```

- Tester's iPhone UDID must be registered first:
  ```bash
  eas device:create
  ```
  Select **Website** → send the registration URL to the tester → they open it on their iPhone → UDID auto-registers.
- Free tier build queue: ~10–80 min wait
- Install link available on EAS dashboard after build completes

### Android (free, no developer account needed)

```bash
eas build --profile preview --platform android
```
Direct `.apk` link — tester opens on Android and installs immediately.

### Direct USB install (free, no account needed)

```bash
npx expo run:ios --device
```
Connect their iPhone via USB → select from device list → installs directly.

### TestFlight (best for many testers, no UDID needed)

```bash
eas build --platform ios --profile production
```
Upload to App Store Connect → add testers via TestFlight → up to 10,000 testers.

---

## Pushing JS Updates to Testers (EAS Update)

Once `expo-updates` is configured, push JS-only changes to already-installed builds without a full rebuild:

### From Replit shell
```bash
cd mobile && npm run update:preview "describe what changed"
# or
cd mobile && EXPO_TOKEN=$EXPO_TOKEN npx eas-cli update --channel preview --message "what changed"
```

### From local Mac
```bash
cd mobile
eas update --branch preview --message "what changed"
```

Testers just **reopen the app** — update downloads automatically. No reinstall needed.

> ⚠️ After making native changes, you still need a full `eas build`. EAS Update only works for JS changes.

> ⚠️ `EXPO_TOKEN` is stored as a Replit secret — EAS commands work directly from Replit shell without login.

---

## Authentication flow

1. The login screen opens an in-app WebView pointing to your Replit app's `/api/login`.
2. The user authenticates through Replit's OAuth (same as the web app).
3. After login, the WebView injects JavaScript that calls `POST /api/mobile/token` with the active session cookie.
4. The backend returns a 30-day JWT.
5. The JWT is stored in the device's secure enclave (via `expo-secure-store`).
6. All subsequent API calls include `Authorization: Bearer <token>`.

No backend changes are needed beyond what's already in this project — the `/api/mobile/token` endpoint and JWT middleware are already added to `server/routes.ts`.

---

## Project structure

```
mobile/
  app/
    _layout.tsx          # Root layout (auth gate, QueryClient, AuthProvider)
    onboarding.tsx       # Onboarding flow (3 steps)
    (auth)/
      _layout.tsx
      login.tsx          # Login screen with WebView auth
    (tabs)/
      _layout.tsx        # Bottom tab bar
      upload.tsx         # Receipt Roaster (main feature)
      bank.tsx           # Manual expenses & bank statement import
      tracker.tsx        # Monthly spending tracker
      annual.tsx         # Annual report
      profile.tsx        # Profile, subscription, settings
  src/
    components/
      AppLogo.tsx        # Animated flame logo (react-native-svg)
    lib/
      api.ts             # Fetch wrapper with Bearer token injection
      auth.ts            # AuthContext & AuthProvider
    theme.ts             # Colors, spacing, typography tokens
  assets/                # Icon and splash screen images (add before building)
  app.json               # Expo config
  eas.json               # EAS Build config
  package.json
```

---

## Assets needed before building

Add these files to `mobile/assets/` before submitting to stores:

| File | Size | Description |
|------|------|-------------|
| `icon.png` | 1024×1024 | App icon |
| `splash.png` | 1242×2436 | Splash screen |
| `adaptive-icon.png` | 1024×1024 | Android adaptive icon foreground |

Use a dark background (`#0D0D0D`) with the neon green flame logo.

---

## Where to Find Things

| Thing | Where |
|---|---|
| EAS builds & logs | [expo.dev/accounts/santhi.code/projects/expense-roaster/builds](https://expo.dev/accounts/santhi.code/projects/expense-roaster/builds) |
| EAS secrets (env vars) | [expo.dev/accounts/santhi.code/projects/expense-roaster/secrets](https://expo.dev/accounts/santhi.code/projects/expense-roaster/secrets) |
| Apple Developer portal | [developer.apple.com](https://developer.apple.com) — sign in as `admin@expenseroaster.com` |
| Certificates & Profiles | developer.apple.com → Account → Certificates, Identifiers & Profiles |
| Registered devices (UDIDs) | developer.apple.com → Certificates, Identifiers & Profiles → Devices |
| Bundle IDs | developer.apple.com → Certificates, Identifiers & Profiles → Identifiers |
| App Store Connect | [appstoreconnect.apple.com](https://appstoreconnect.apple.com) — for TestFlight & production |
| Xcode devices | Xcode → Window → Devices and Simulators |
| Xcode accounts | Xcode → Settings (Cmd+,) → Accounts |
| Xcode signing | Select project → Signing & Capabilities tab |

---

## Common Issues & Fixes

| Error | Fix |
|---|---|
| "Incompatible with Expo Go" | Don't use Expo Go. Run `npx expo run:ios --device` instead |
| "xcodebuild error code 70" | Update iPhone iOS to latest version. Open Xcode first and let it process device |
| "Framework React not found" | `cd mobile/ios && pod deintegrate && pod install` |
| "No script URL provided" | Run `npx expo run:ios` not Xcode directly — Metro bundler wasn't running |
| "No development build installed" | Run `npx expo run:ios --device` first to install, then use `expo start --dev-client` |
| "Failed Registering Bundle ID" | Change bundle ID in `app.json`, run `npx expo prebuild --platform ios --clean` |
| "No team associated" | Need paid Apple Developer account ($99/yr) at developer.apple.com |
| "Runtime version policy not supported" | Change `runtimeVersion` in `app.json` to a plain string e.g. `"1.0.0"` |
| "CoreSimulatorService no longer valid" | Quit Simulator + Xcode, run `killall Simulator` in terminal, relaunch |
| EAS build queue 80+ min | Free tier — either wait, or build locally with `npx expo run:ios` |
| "Save Failed: non-JSON response" | Check `API_BASE_URL` uses `https://` not `http://` |

---

## Key Reminders

- ✅ Always use `https://` in `API_BASE_URL`, never `http://`
- ✅ SDK 55+ — never use Expo Go, always use a dev build
- ✅ Always open `ExpenseRoaster.xcworkspace` — never `ExpenseRoaster.xcodeproj`
- ✅ Run `pod install` after every `npx expo prebuild`
- ✅ Paid Apple Developer account (`admin@expenseroaster.com`) required for iOS distribution
- ✅ `EXPO_TOKEN` stored as Replit secret — EAS commands work from Replit shell
- ✅ Use EAS Update for JS changes, full `eas build` only for native changes
- ✅ Bump `runtimeVersion` in `app.json` manually for breaking changes (e.g. `"1.0.0"` → `"1.0.1"`)
- ✅ Use **Cmd + K** in Xcode to clean build folder when seeing stale errors