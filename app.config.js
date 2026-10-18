module.exports = {
  owner: 'dussann89',
  name: 'FixHome',
  slug: 'fixhome',
  version: '1.0.0',
  icon: './assets/icon.png',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.fixhome.mobile',
  },
  android: {
    package: 'com.fixhome.mobile',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#126D68',
    },
  },
  plugins: [
    'expo-secure-store',
    'expo-status-bar',
    'expo-notifications',
    [
      'expo-image-picker',
      {
        cameraPermission: 'FixHome koristi kameru za fotografisanje problema.',
        photosPermission: 'FixHome koristi fotografije za dodavanje slike uz zahtev.',
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission: 'FixHome koristi lokaciju telefona da bi je sačuvao uz zahtev za uslugu.',
      },
    ],
  ],
  extra: {
    eas: {
      projectId: 'b00c0fa9-c10c-4c0d-9aaf-a6e2a24cdadb',
    },
  },
};
