# FixHome Mobile

React Native app built with Expo for Android and iOS.

## Run locally

1. Start PostgreSQL and the backend from the project root:

   ```powershell
   docker compose up -d postgres
   Set-Location backend
   mvn spring-boot:run
   ```

2. In another terminal, install and start Expo:

   ```powershell
   Set-Location frontend
   npm.cmd install
   npm.cmd start
   ```

3. Open the project with Expo Go on a phone, or press `a` for an Android emulator. An iOS simulator requires macOS and Xcode.

## Build an Android APK

Expo Go can be used for normal development, but remote push notifications require a native FixHome development or production build. To create and install an Android development build with push notifications, link an EAS project, add its project ID as `EXPO_PUBLIC_EAS_PROJECT_ID` in the **preview** environment (and `frontend/.env` for local Expo configuration), configure Expo push credentials, then run:

```powershell
npx eas-cli login
npx eas-cli init
npm.cmd run build:development
```

Install the generated development APK on the phone and start Metro in development-client mode with `npx.cmd expo start --dev-client`. Push messages still require notification permission on the device.

The preview build is an installable APK and includes the FixHome home-screen icon. In the EAS project, open **Environment variables** and add `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_EAS_PROJECT_ID` to the **preview** environment. Use a backend URL the phone can reach, ending in `/api/v1` (a publicly reachable HTTPS backend is recommended), then run:

```powershell
npm.cmd run build:android
```

Push notifications also require an EAS project linked with `npx eas-cli init`, `EXPO_PUBLIC_EAS_PROJECT_ID` set to that project's ID (for example, in `frontend/.env`), and notification permissions enabled on the phone. Remote push notifications require an installed Android/iOS build with Expo's push credentials configured in EAS; they are not supported by Expo Go.

When the build finishes, open its EAS link on the phone, download the APK, and allow installation from that source if Android prompts. FixHome will appear in the app list; drag its icon to the home screen to create a shortcut there. The APK does not run the backend; the backend must remain reachable from the phone while the app is in use.

When running through Expo Go on a physical phone, the app uses the Expo development server's LAN address to reach the backend on the development computer. Keep the phone and computer on the same network and allow inbound connections to port `8080` in the computer firewall. If automatic address detection is unavailable, set `EXPO_PUBLIC_API_URL` in `frontend/.env` to the computer's LAN address:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.20:8080/api/v1
```

Replace the example IP with the computer's local network IP. Android emulators can use `10.0.2.2`; iOS simulators can use `localhost`. Packaged builds should define `EXPO_PUBLIC_API_URL` to a backend URL reachable from the phone.
