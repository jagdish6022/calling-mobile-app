To generate the **Release APK** for your Android app, run either of the following options in PowerShell:

---

### **Option 1 — Direct Local Release Build (Recommended & Fastest)**

Run these commands in PowerShell:

```powershell
# Navigate to the android directory
cd D:\my-project\calling-mobile-app\android

# Build the Release APK
.\gradlew assembleRelease
```

The compiled Release APK will be created at:
`android\app\build\outputs\apk\release\app-release.apk`

To install it directly on a connected Android device:
```powershell
adb install -r android\app\build\outputs\apk\release\app-release.apk
```

---

### **Option 2 — Using Expo CLI**

Run this from the project root:

```powershell
cd D:\my-project\calling-mobile-app
npx expo run:android --variant release
```

---

### **Option 3 — Cloud EAS Build (For Production / Play Store)**

```powershell
# Install EAS CLI
npm install -g eas-cli

# Login to Expo account
eas login

# Build APK in cloud
eas build -p android --profile preview
```