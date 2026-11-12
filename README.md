# Home Upper-Body Workout App (React Native + Firebase)

Apartment-friendly Hebrew RTL upper-body workout guide and progress tracker built with **Expo (React Native + React Native for Web)**, `react-native-svg`, and **Firebase (Hosting, Cloud Firestore, Authentication)**.

## Features
- **Hebrew RTL UI (`Rubik` font)** written in plain, beginner-friendly Hebrew with zero fitness abbreviations.
- **Live 60fps SVG Exercise Animations** (`react-native-svg`) + verified YouTube video demonstrations for all 10 exercises.
- **Spinlock Plate Calculator** tailored to `4×5kg`, `4×2.5kg`, `6×1.25kg`, and `6×0.5kg` plates (dumbbells & two-piece 152cm barbell).
- **Workout & Progress Tracking**:
  - Per-set weight (`0.5 kg` steps) and reps logging with automatic pre-fill from your previous workout.
  - Built-in countdown rest timer.
  - Weight progression chart per exercise + chronological workout log + JSON backup export/import.
  - Automatic cloud sync via **Cloud Firestore** + **Firebase Auth** (Anonymous + optional Google Sign-In) with offline `AsyncStorage` caching.

## Local Development

```bash
npm install
npm run web     # Run in web browser
npm run ios     # Run in iOS Simulator
npm run android # Run in Android Emulator
```

## Deploy to Firebase (Spark Free Tier)

1. Sign in and select/create your Firebase project:
   ```bash
   npx -y firebase-tools@latest login
   npx -y firebase-tools@latest use <YOUR_PROJECT_ID>
   ```
2. Register a web app and populate `.env` (or `src/firebaseConfig.js`) with `EXPO_PUBLIC_FIREBASE_*` keys:
   ```bash
   npx -y firebase-tools@latest apps:create web home-workout-web
   npx -y firebase-tools@latest apps:sdkconfig web <APP_ID>
   ```
3. Build and deploy Hosting, Firestore rules, and Auth:
   ```bash
   npm run deploy
   ```
