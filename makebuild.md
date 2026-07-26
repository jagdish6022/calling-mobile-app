For your Expo project, there are two ways:

---

**Option 1 — Local APK (fastest, no account needed)**

Run this in your project folder:
```powershell
cd D:\my-project\calling-mobile-app
npx expo run:android --variant release
```
The APK will be at:
`android\app\build\outputs\apk\release\app-release.apk`

> If you get a signing error, use `--variant debug` instead for a debug APK (works for testing, not Play Store).

---

**Option 2 — EAS Build (recommended for production)**

This builds in the cloud using Expo's servers:

```powershell
# Install EAS CLI
npm install -g eas-cli

# Login to Expo account
eas login

# Configure (first time only)
eas build:configure

# Build APK
eas build -p android --profile preview
```

You'll get a download link when it's done. No Android Studio or Java setup needed.

---

**Which to use?**

- **Testing on your phone** → Option 1 with `--variant debug`
- **Share with others / Play Store** → Option 2 with EAS
- **Release APK locally** → Option 1 with `--variant release` (needs a keystore for signing)

Since you already have the project building with `npx expo run:android`, Option 1 is the quickest path. Try:

```powershell
npx expo run:android --variant debug
```

The debug APK will be at `android\app\build\outputs\apk\debug\app-debug.apk` — you can install it directly on any Android device.