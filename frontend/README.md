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
   npm.cmd start -- --tunnel
   ```

3. Scan the QR code with Expo Go on the phone. The tunnel connects the phone to Metro even when it is not on the same network as the computer. The backend must still be reachable from the phone at `EXPO_PUBLIC_API_URL`; the tunnel does not expose the backend. For an Android emulator, press `a`. An iOS simulator requires macOS and Xcode.

Customers can complete an accepted/in-progress request from its details and leave a 1–5 star rating with an optional comment. Craftsmen can see completed jobs, customer comments, and their average rating in the Profile tab. The backend applies the review-table migration automatically on startup.

Craftsmen can apply to an available job with an optional message and price, or choose to agree on the price in person. Customers can review received offers in request details. In the mobile app, customers can enable push notifications from their Profile tab to be notified when a craftsman applies; this requires an installed FixHome development or production build and notification permission.

## Build an Android APK

Expo Go can be used for normal development, but remote push notifications require a native FixHome development or production build. To create and install an Android development build with push notifications, link an EAS project, add its project ID as `EXPO_PUBLIC_EAS_PROJECT_ID` in the **preview** environment (and `frontend/.env` for local Expo configuration), configure Expo push credentials, then run:

```powershell
npx eas-cli login
npx eas-cli init
npm.cmd run build:development
```

Install the generated development APK on the phone and start Metro in development-client mode with `npx.cmd expo start --dev-client`. Push messages still require notification permission on the device.

The preview build is an installable APK and includes the FixHome home-screen icon. The development and preview build profiles currently use `http://192.168.1.6:8080/api/v1`; the phone must be on the same network as that computer, and inbound connections to port `8080` must be allowed. If the computer's Wi-Fi/LAN IP changes, update `EXPO_PUBLIC_API_URL` in `eas.json` or override it in the EAS **preview** environment. Add `EXPO_PUBLIC_EAS_PROJECT_ID` to that environment as well, then run:

```powershell
npm.cmd run build:android
```

Push notifications also require an EAS project linked with `npx eas-cli init`, `EXPO_PUBLIC_EAS_PROJECT_ID` set to that project's ID (for example, in `frontend/.env`), and notification permissions enabled on the phone. Remote push notifications require an installed Android/iOS build with Expo's push credentials configured in EAS; they are not supported by Expo Go.

When the build finishes, open its EAS link on the phone, download the APK, and allow installation from that source if Android prompts. FixHome will appear in the app list; drag its icon to the home screen to create a shortcut there. The APK does not run the backend; the backend must remain reachable from the phone while the app is in use.

When running through Expo Go on a physical phone, the app uses the Expo development server's LAN address to reach the backend on the development computer. Expo's `--tunnel` option only tunnels Metro; it does not expose the backend. Keep the phone and computer on the same network and allow inbound connections to port `8080` in the computer firewall. Set `EXPO_PUBLIC_API_URL` in `frontend/.env` to the computer's LAN address:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.6:8080/api/v1
```

Replace the example IP with the computer's Wi-Fi/LAN IP (not a WSL or other virtual-adapter IP). Android emulators can use `10.0.2.2`; iOS simulators can use `localhost`. Packaged builds should define `EXPO_PUBLIC_API_URL` to a backend URL reachable from the phone.
Restart Expo after changing `.env` so the new API URL is loaded.
