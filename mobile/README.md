# Expense Roaster — Mobile App

React Native (Expo SDK 55) app for the Expense Roaster platform, targeting iOS App Store and Google Play Store.

**SDK versions:** Expo 55 · React Native 0.84 · React 19 · New Architecture enabled

## Prerequisites

- Node.js 18+
- Xcode 16+ (for iOS builds, required for React Native 0.84 / New Architecture)
- Android Studio Ladybug or later (for Android builds)
- EAS CLI: `npm install -g eas-cli`
- An Apple Developer account (for App Store) or Google Play developer account

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

> During local development you can use your Replit dev URL (e.g. `https://xxx.replit.dev`).

### 3. Install iOS native dependencies (Mac only)

```bash
cd ios
pod install
cd ..
```

## Running the app

### iOS Simulator

```bash
npx expo run:ios
```

Or open the `ios/*.xcworkspace` file in Xcode and press Run.

### Android Emulator

```bash
npx expo run:android
```

### Expo Go (quick preview, limited native features)

```bash
npx expo start
```

Scan the QR code with Expo Go on your phone.

## Building for stores

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

## Authentication flow

1. The login screen opens an in-app WebView pointing to your Replit app's `/api/login`.
2. The user authenticates through Replit's OAuth (same as the web app).
3. After login, the WebView injects JavaScript that calls `POST /api/mobile/token` with the active session cookie.
4. The backend returns a 30-day JWT.
5. The JWT is stored in the device's secure enclave (via `expo-secure-store`).
6. All subsequent API calls include `Authorization: Bearer <token>`.

No backend changes are needed beyond what's already in this project — the `/api/mobile/token` endpoint and JWT middleware are already added to `server/routes.ts`.

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

## Assets needed before building

Add these files to `mobile/assets/` before submitting to stores:

| File | Size | Description |
|------|------|-------------|
| `icon.png` | 1024×1024 | App icon |
| `splash.png` | 1242×2436 | Splash screen |
| `adaptive-icon.png` | 1024×1024 | Android adaptive icon foreground |

Use a dark background (`#0D0D0D`) with the neon green flame logo.
