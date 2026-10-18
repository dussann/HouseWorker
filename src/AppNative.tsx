import { useEffect, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type TextInputProps,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system/legacy';
import { NavigationBar } from 'expo-navigation-bar';
import { WebView } from 'react-native-webview';
import { StatusBar } from 'expo-status-bar';
import { apiFetch, clearSession, getSession, resolveApiUrl, saveSession, uploadImage, type SessionUser } from './api';
import { getRequestStatusPresentation } from './requestStatus';
import { isExpoGo, registerForPushNotifications } from './pushNotifications';

type AuthMode = 'login' | 'register';
type Role = 'CUSTOMER' | 'CRAFTSMAN';
type Category = { id: number; name: string };
type ServiceRequest = {
  id: number;
  categoryId: number;
  categoryName: string;
  city: string | null;
  description: string;
  status: string;
  imageUrl: string | null;
};
type CraftsmanRequestDetails = Pick<ServiceRequest, 'id' | 'categoryName' | 'city' | 'description' | 'imageUrl' | 'status'> & {
  latitude: number | null;
  longitude: number | null;
};
type RequestForm = {
  categoryId: string;
  description: string;
};
type AuthForm = { email: string; password: string; phone: string; role: Role; city: string; categoryIds: number[] };

const emptyForm: RequestForm = {
  categoryId: '',
  description: '',
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Request failed';
}

export default function AppNative() {
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [token, setToken] = useState('');
  const [user, setUser] = useState<SessionUser | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState('');
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [citySearch, setCitySearch] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
  const [selectedJob, setSelectedJob] = useState<CraftsmanRequestDetails | null>(null);
  const [detailForm, setDetailForm] = useState<RequestForm>(emptyForm);
  const [detailImage, setDetailImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [isDetailCategoryOpen, setIsDetailCategoryOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'requests' | 'profile'>('requests');
  const [loading, setLoading] = useState(false);
  const [detectingCity, setDetectingCity] = useState(false);
  const [restoringSession, setRestoringSession] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState<RequestForm>(emptyForm);
  const [selectedImage, setSelectedImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState('');
  const [authForm, setAuthForm] = useState<AuthForm>({ email: '', password: '', phone: '', role: 'CUSTOMER', city: '', categoryIds: [] });
  const [notificationCities, setNotificationCities] = useState<string[]>([]);
  const [notificationCityInput, setNotificationCityInput] = useState('');
  const [pushEnabled, setPushEnabled] = useState(false);
  const [savingNotificationSettings, setSavingNotificationSettings] = useState(false);

  const userRole = user?.role || 'CUSTOMER';
  const canSubmitRequest = userRole === 'CUSTOMER' && Boolean(token);
  const registrationCategories = categories
    .filter((category) => !/^vodoinstalater\s*\d+$/i.test(category.name.trim()))
    .sort((first, second) => first.name.localeCompare(second.name, 'sr'));
  const availableCategories = [
    'Električar',
    'Vodoinstalater',
    'Moler',
    'Keramičar',
    'Stolar',
  ].flatMap((name) => {
    const category = categories.find((item) => item.name === name);
    return category ? [category] : [];
  });
  const selectedCategory = categories.find((category) => String(category.id) === form.categoryId);
  const notificationCityOptions = Array.from(new Set([
    'Beograd',
    'Novi Sad',
    user?.city || '',
    ...notificationCities,
  ].map((city) => city.trim()).filter(Boolean)));

  useEffect(() => {
    let isMounted = true;
    void loadCategories();
    void getSession()
      .then((session) => {
        if (isMounted && session) {
          setToken(session.token);
          setUser(session.user);
          setCitySearch(session.user.city || '');
        }
      })
      .catch((sessionError: unknown) => {
        if (isMounted) setError(getErrorMessage(sessionError));
      })
      .finally(() => {
        if (isMounted) setRestoringSession(false);
      });
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (token) {
      void loadRequests();
    }
  }, [token, userRole]);

  useEffect(() => {
    if (token && userRole === 'CRAFTSMAN') {
      void loadNotificationPreferences();
    }
  }, [token, userRole]);

  useEffect(() => {
    if (isExpoGo()) return;
    let isActive = true;
    let removeSubscription: (() => void) | undefined;
    void import('expo-notifications').then((Notifications) => {
      if (!isActive) return;
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
      const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
        const requestId = Number(response.notification.request.content.data?.requestId);
        if (Number.isInteger(requestId) && requestId > 0) {
          setActiveTab('requests');
          void openJobDetails(requestId);
        }
      });
      removeSubscription = () => subscription.remove();
    }).catch((notificationError: unknown) => {
      setError(getErrorMessage(notificationError));
    });
    return () => {
      isActive = false;
      removeSubscription?.();
    };
  }, []);

  async function loadNotificationPreferences() {
    try {
      const preferences = await apiFetch<{ cities: string[]; pushEnabled: boolean }>('/craftsmen/profile/notifications');
      setNotificationCities(preferences.cities);
      setPushEnabled(preferences.pushEnabled);
    } catch (preferencesError) {
      setError(getErrorMessage(preferencesError));
    }
  }

  async function saveNotificationCities() {
    setSavingNotificationSettings(true);
    setError('');
    setSuccess('');
    try {
      const preferences = await apiFetch<{ cities: string[]; pushEnabled: boolean }>('/craftsmen/profile/notifications/cities', {
        method: 'PUT',
        body: JSON.stringify({ cities: notificationCities }),
      });
      setNotificationCities(preferences.cities);
      setPushEnabled(preferences.pushEnabled);
      setSuccess('Gradovi za obaveštenja su sačuvani.');
    } catch (preferencesError) {
      setError(getErrorMessage(preferencesError));
    } finally {
      setSavingNotificationSettings(false);
    }
  }

  async function togglePushNotifications() {
    setSavingNotificationSettings(true);
    setError('');
    setSuccess('');
    try {
      const pushToken = pushEnabled
        ? null
        : await registerForPushNotifications();
      await apiFetch<void>('/craftsmen/profile/notifications/push-token', {
        method: 'PUT',
        body: JSON.stringify({ token: pushToken }),
      });
      setPushEnabled(Boolean(pushToken));
      setSuccess(pushToken ? 'Push obaveštenja su uključena.' : 'Push obaveštenja su isključena.');
    } catch (notificationError) {
      setError(getErrorMessage(notificationError));
    } finally {
      setSavingNotificationSettings(false);
    }
  }

  function toggleNotificationCity(city: string) {
    setNotificationCities((current) => current.some((selected) => selected.toLowerCase() === city.toLowerCase())
      ? current.filter((selected) => selected.toLowerCase() !== city.toLowerCase())
      : [...current, city]);
  }

  function addNotificationCity() {
    const city = notificationCityInput.trim();
    if (!city) {
      setError('Unesite naziv grada.');
      return;
    }
    if (city.length > 120) {
      setError('Naziv grada ne sme imati više od 120 znakova.');
      return;
    }
    if (notificationCityOptions.some((existing) => existing.toLowerCase() === city.toLowerCase())) {
      setError('Taj grad je već na listi.');
      return;
    }
    setError('');
    setNotificationCities((current) => [...current, city]);
    setNotificationCityInput('');
  }

  async function loadCategories() {
    setCategoriesLoading(true);
    setCategoriesError('');
    try {
      setCategories(await apiFetch<Category[]>('/categories'));
    } catch (loadError) {
      setCategoriesError(getErrorMessage(loadError));
    } finally {
      setCategoriesLoading(false);
    }
  }

  async function loadRequests() {
    if (!token) return;
    try {
      const endpoint = userRole === 'CRAFTSMAN'
        ? `/service-requests/available${citySearch.trim() ? `?city=${encodeURIComponent(citySearch.trim())}` : ''}`
        : '/service-requests/my';
      setRequests(await apiFetch<ServiceRequest[]>(endpoint));
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    }
  }

  async function handleAuthSubmit() {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const endpoint = authMode === 'login' ? '/auth/login' : '/auth/register';
      const payload = authMode === 'login'
        ? { email: authForm.email, password: authForm.password, role: selectedRole }
        : {
            email: authForm.email,
            password: authForm.password,
            phone: authForm.phone,
            role: authForm.role,
            city: authForm.city,
            categoryIds: selectedRole === 'CRAFTSMAN' ? authForm.categoryIds : [],
          };
      const data = await apiFetch<{ accessToken?: string; token?: string; email: string; role?: string; city?: string }>(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const authToken = data.accessToken || data.token;
      if (!authToken) throw new Error('Authentication token was not returned');

      const nextUser: SessionUser = { email: data.email, role: data.role || authForm.role, city: data.city || authForm.city };
      await saveSession({ token: authToken, user: nextUser });
      setToken(authToken);
      setUser(nextUser);
      setCitySearch(nextUser.city || '');
      setSuccess(authMode === 'login' ? 'Uspešna prijava' : 'Uspešna registracija');
    } catch (authError) {
      setError(getErrorMessage(authError));
    } finally {
      setLoading(false);
    }
  }

  async function detectRegistrationCity() {
    setDetectingCity(true);
    setError('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        throw new Error('Dozvolite pristup lokaciji da bismo prepoznali grad.');
      }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [address] = await Location.reverseGeocodeAsync(location.coords);
      const city = address?.city || address?.district || address?.subregion || address?.region;
      if (!city) throw new Error('Grad nije pronađen. Unesite ga ručno.');
      setAuthForm((current) => ({ ...current, city }));
    } catch (locationError) {
      setError(getErrorMessage(locationError));
    } finally {
      setDetectingCity(false);
    }
  }

  function toggleRegistrationCategory(categoryId: number) {
    setAuthForm((current) => ({
      ...current,
      categoryIds: current.categoryIds.includes(categoryId)
        ? current.categoryIds.filter((selectedId) => selectedId !== categoryId)
        : [...current.categoryIds, categoryId],
    }));
  }

  async function searchRequestsByCity() {
    setLoading(true);
    setError('');
    try {
      const city = citySearch.trim();
      const endpoint = `/service-requests/available${city ? `?city=${encodeURIComponent(city)}` : ''}`;
      setRequests(await apiFetch<ServiceRequest[]>(endpoint));
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateRequest() {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        throw new Error('Dozvolite pristup lokaciji da biste poslali zahtev.');
      }
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      let imageUrl = uploadedImageUrl;
      if (selectedImage && !imageUrl) {
        const uploadedImage = await uploadImage(
          selectedImage.uri,
          selectedImage.mimeType || 'image/jpeg',
        );
        imageUrl = uploadedImage.imageUrl;
        setUploadedImageUrl(imageUrl);
      }

      await apiFetch('/service-requests', {
        method: 'POST',
        body: JSON.stringify({
          categoryId: Number(form.categoryId),
          description: form.description.trim(),
          imageUrl,
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        }),
      });
      setForm(emptyForm);
      setSelectedImage(null);
      setUploadedImageUrl('');
      setSuccess('Zahtev je kreiran');
      await loadRequests();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  async function chooseImage(source: 'camera' | 'library') {
    setError('');
    setSuccess('');
    try {
      const permission = source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError(source === 'camera'
          ? 'Dozvolite pristup kameri da biste fotografisali problem.'
          : 'Dozvolite pristup fotografijama da biste izabrali sliku.');
        return;
      }

      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.8 });
      const image = result.canceled ? null : result.assets[0];
      if (image) {
        if (selectedRequest) {
          setDetailImage(image);
        } else {
          setSelectedImage(image);
          setUploadedImageUrl('');
        }
      }
    } catch (imageError) {
      setError(getErrorMessage(imageError));
    }
  }

  async function openRequest(requestId: number) {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const request = await apiFetch<ServiceRequest>(`/service-requests/${requestId}`);
      setSelectedRequest(request);
      setDetailForm({ categoryId: String(request.categoryId), description: request.description });
      setDetailImage(null);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  function closeRequestDetails() {
    setSelectedRequest(null);
    setDetailImage(null);
    setIsDetailCategoryOpen(false);
  }

  async function openJobDetails(requestId: number) {
    setLoading(true);
    setError('');
    try {
      setSelectedJob(await apiFetch<CraftsmanRequestDetails>(`/service-requests/available/${requestId}`));
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  async function saveRequestDetails() {
    if (!selectedRequest) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      let imageUrl = selectedRequest.imageUrl;
      if (detailImage) {
        const uploaded = await uploadImage(detailImage.uri, detailImage.mimeType || 'image/jpeg');
        imageUrl = uploaded.imageUrl;
      }

      const updatedRequest = await apiFetch<ServiceRequest>(`/service-requests/${selectedRequest.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          categoryId: Number(detailForm.categoryId),
          description: detailForm.description.trim(),
          imageUrl,
        }),
      });
      setSelectedRequest(updatedRequest);
      setRequests((current) => current.map((request) => request.id === updatedRequest.id ? updatedRequest : request));
      setDetailImage(null);
      setSuccess('Izmene zahteva su sačuvane');
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    if (userRole === 'CRAFTSMAN' && pushEnabled) {
      try {
        await apiFetch<void>('/craftsmen/profile/notifications/push-token', {
          method: 'PUT',
          body: JSON.stringify({ token: null }),
        });
      } catch (unregisterError) {
        setError(`Push token nije uklonjen sa naloga: ${getErrorMessage(unregisterError)}`);
      }
    }
    await clearSession();
    setToken('');
    setUser(null);
    setSelectedRole(null);
    setSelectedRequest(null);
    setSelectedJob(null);
    setRequests([]);
    setCitySearch('');
    setActiveTab('requests');
    setNotificationCities([]);
    setPushEnabled(false);
  }

  async function refreshRequests() {
    setRefreshing(true);
    await Promise.all([loadCategories(), loadRequests()]);
    setRefreshing(false);
  }

  async function deleteRequest(requestId: number) {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await apiFetch<void>(`/service-requests/${requestId}`, { method: 'DELETE' });
      setSuccess('Zahtev je obrisan');
      await loadRequests();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
    } finally {
      setLoading(false);
    }
  }

  function confirmDeleteRequest(requestId: number) {
    Alert.alert('Obrisati zahtev?', 'Zahtev i sve primljene ponude biće obrisani.', [
      { text: 'Otkaži', style: 'cancel' },
      { text: 'Obriši', style: 'destructive', onPress: () => void deleteRequest(requestId) },
    ]);
  }

  function chooseRole(role: Role) {
    setSelectedRole(role);
    setAuthForm((current) => ({ ...current, role }));
    setAuthMode('login');
    setError('');
    setSuccess('');
  }

  function showRolePicker() {
    setSelectedRole(null);
    setAuthMode('login');
    setError('');
    setSuccess('');
  }

  function changeAuthMode(mode: AuthMode) {
    Keyboard.dismiss();
    setAuthMode(mode);
    setError('');
    setSuccess('');
    if (mode === 'register') {
      void loadCategories();
    }
  }

  return (
    <SafeAreaView style={styles.safeScreen}>
      <StatusBar style="dark" />
      {Platform.OS === 'android' && <NavigationBar hidden />}
      {restoringSession ? (
        <View style={styles.centered}><ActivityIndicator color={colors.teal} /></View>
      ) : !token ? selectedRole === null ? (
        <ScrollView contentContainerStyle={styles.landingPage}>
          <View style={styles.landingIntro}>
            <Text style={styles.landingBrand}>KUĆNI MAJSTOR</Text>
            <Text style={styles.landingTitle}>Pronađi majstora za nekoliko koraka</Text>
            <View style={styles.landingAccent} />
          </View>
          <Text style={styles.rolePrompt}>Kako želiš da koristiš FixHome?</Text>
          <View style={styles.roleList}>
            <RoleCard
              role="CUSTOMER"
              title="Korisnik"
              subtitle="Pronađi majstora za svoj dom"
              onPress={() => chooseRole('CUSTOMER')}
            />
            <RoleCard
              role="CRAFTSMAN"
              title="Majstor"
              subtitle="Pronađi nove poslove u blizini"
              onPress={() => chooseRole('CRAFTSMAN')}
            />
          </View>
          <Text style={styles.landingFooter}>Jednostavno. Pouzdano. Lokalno.</Text>
          <Feedback error={error} success={success} />
        </ScrollView>
      ) : (
        <View style={styles.flex}>
        <KeyboardAvoidingView style={styles.authContent} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={[styles.authPage, authMode === 'login' && styles.authLoginPage]}
            keyboardShouldPersistTaps="always"
            scrollEnabled={authMode === 'register'}
          >
            <Pressable
              onPress={showRolePicker}
              style={[
                styles.authBackButton,
                selectedRole === 'CRAFTSMAN' ? styles.authBackButtonCraftsman : styles.authBackButtonCustomer,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Nazad"
            >
              <Text style={[
                styles.authBackButtonText,
                selectedRole === 'CRAFTSMAN' && styles.authBackButtonTextCraftsman,
              ]}>←  Nazad</Text>
            </Pressable>
            <View style={[styles.authIntro, selectedRole === 'CRAFTSMAN' ? styles.authIntroCraftsman : styles.authIntroCustomer]}>
              <Text style={[styles.eyebrow, selectedRole === 'CRAFTSMAN' ? styles.roleEyebrowCraftsman : styles.roleEyebrowCustomer]}>KUĆNI POSLOVI, LAKŠE</Text>
              <Text style={[styles.authTitle, selectedRole === 'CRAFTSMAN' && styles.authTitleCraftsman]}>
                {authMode === 'login' ? 'Dobro došao nazad.' : selectedRole === 'CRAFTSMAN' ? 'Registracija majstora.' : 'Registracija korisnika.'}
              </Text>
              <Text style={[styles.muted, selectedRole === 'CRAFTSMAN' && styles.authDescriptionCraftsman]}>
                {selectedRole === 'CRAFTSMAN' ? 'Prijavi se ili napravi nalog za majstora.' : 'Poveži se sa majstorima u svom kraju.'}
              </Text>
            </View>
            <View style={[styles.panel, selectedRole === 'CRAFTSMAN' ? styles.authPanelCraftsman : styles.authPanelCustomer]}>
              <View style={styles.form}>
                <Field label="Email" value={authForm.email} onChangeText={(email) => setAuthForm((current) => ({ ...current, email }))} placeholder="ime@primer.rs" keyboardType="email-address" autoCapitalize="none" />
                <Field label="Lozinka" value={authForm.password} onChangeText={(password) => setAuthForm((current) => ({ ...current, password }))} placeholder="Unesite lozinku" secureTextEntry />
                {authMode === 'register' && <>
                  <Field label="Telefon" value={authForm.phone} onChangeText={(phone) => setAuthForm((current) => ({ ...current, phone }))} placeholder="+381 60 000 0000" keyboardType="phone-pad" />
                  <View style={styles.field}>
                    <Field label="Grad" value={authForm.city} onChangeText={(city) => setAuthForm((current) => ({ ...current, city }))} placeholder="Unesite grad" autoCapitalize="words" maxLength={120} />
                    <Pressable accessibilityRole="button" disabled={detectingCity} onPress={() => void detectRegistrationCity()} style={styles.imageActionButton}>
                      <Text style={styles.imageActionText}>{detectingCity ? 'Prepoznajem grad...' : 'Prepoznaj grad po lokaciji'}</Text>
                    </Pressable>
                  </View>
                  {selectedRole === 'CRAFTSMAN' && (
                    <View style={styles.registrationCategorySection}>
                      <Text style={styles.fieldLabel}>Koje usluge nudite? (obavezno)</Text>
                      <Text style={styles.muted}>Izaberite jednu ili više kategorija da bi klijenti i poslovi odgovarali vašoj ekspertizi.</Text>
                      {categoriesLoading && categories.length === 0 ? (
                        <View style={styles.categoryLoading}>
                          <ActivityIndicator color={colors.tealDark} />
                          <Text style={styles.muted}>Učitavam kategorije...</Text>
                        </View>
                      ) : categoriesError ? (
                        <View style={styles.categoryLoading}>
                          <Text style={styles.categoryError}>{categoriesError}</Text>
                          <SecondaryButton label="Pokušaj ponovo" onPress={() => void loadCategories()} disabled={categoriesLoading} />
                        </View>
                      ) : registrationCategories.length === 0 ? (
                        <View style={styles.categoryLoading}>
                          <Text style={styles.muted}>Kategorije trenutno nisu dostupne.</Text>
                          <SecondaryButton label="Učitaj kategorije" onPress={() => void loadCategories()} disabled={categoriesLoading} />
                        </View>
                      ) : (
                        <>
                          <Text style={styles.categorySelectionCount}>
                            Izabrano: {authForm.categoryIds.length} od {registrationCategories.length}
                          </Text>
                          {registrationCategories.map((category) => {
                        const checked = authForm.categoryIds.includes(category.id);
                        return (
                          <Pressable
                            key={category.id}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked }}
                            onPress={() => toggleRegistrationCategory(category.id)}
                            style={styles.registrationCategory}
                          >
                            <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                              {checked && <Text style={styles.checkboxCheck}>✓</Text>}
                            </View>
                            <Text style={styles.registrationCategoryText}>{category.name}</Text>
                          </Pressable>
                        );
                          })}
                        </>
                      )}
                    </View>
                  )}
                </>}
                <PrimaryButton
                  disabled={loading || (authMode === 'register' && (
                    !authForm.city.trim()
                    || (selectedRole === 'CRAFTSMAN' && authForm.categoryIds.length === 0)
                  ))}
                  label={loading ? 'Sačekajte...' : authMode === 'login' ? 'Prijavi se' : 'Napravi nalog'}
                  onPress={() => void handleAuthSubmit()}
                  variant={selectedRole}
                />
              </View>
            </View>
            <Feedback error={error} success={success} />
          </ScrollView>
        </KeyboardAvoidingView>
          <View style={[styles.authBottomNav, selectedRole === 'CRAFTSMAN' ? styles.authBottomNavCraftsman : styles.authBottomNavCustomer]} accessibilityRole="tablist" accessibilityLabel="Prijava i registracija">
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: authMode === 'login' }}
              onPress={() => changeAuthMode('login')}
              style={[styles.authNavItem, authMode === 'login' && styles.authNavItemActive, authMode === 'login' && (selectedRole === 'CRAFTSMAN' ? styles.authNavItemActiveCraftsman : styles.authNavItemActiveCustomer)]}
            >
              <Text style={[styles.authNavIcon, authMode === 'login' && styles.authNavIconActive, authMode === 'login' && (selectedRole === 'CRAFTSMAN' ? styles.authNavIconActiveCraftsman : styles.authNavIconActiveCustomer)]}>↪</Text>
              <Text style={[styles.authNavLabel, authMode === 'login' && styles.authNavLabelActive, authMode === 'login' && (selectedRole === 'CRAFTSMAN' ? styles.authNavLabelActiveCraftsman : styles.authNavLabelActiveCustomer)]}>Prijava</Text>
            </Pressable>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: authMode === 'register' }}
              onPress={() => changeAuthMode('register')}
              style={[styles.authNavItem, authMode === 'register' && styles.authNavItemActive, authMode === 'register' && (selectedRole === 'CRAFTSMAN' ? styles.authNavItemActiveCraftsman : styles.authNavItemActiveCustomer)]}
            >
              <Text style={[styles.authNavIcon, authMode === 'register' && styles.authNavIconActive, authMode === 'register' && (selectedRole === 'CRAFTSMAN' ? styles.authNavIconActiveCraftsman : styles.authNavIconActiveCustomer)]}>＋</Text>
              <Text style={[styles.authNavLabel, authMode === 'register' && styles.authNavLabelActive, authMode === 'register' && (selectedRole === 'CRAFTSMAN' ? styles.authNavLabelActiveCraftsman : styles.authNavLabelActiveCustomer)]}>Registracija</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.flex}>
          <ScrollView
            contentContainerStyle={styles.dashboardPage}
            keyboardShouldPersistTaps="handled"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refreshRequests()} tintColor={colors.teal} />}
          >
            <Pressable onPress={() => void logout()} style={styles.switchAccountButton} accessibilityRole="button">
              <Text style={styles.switchAccountText}>Promeni nalog</Text>
            </Pressable>
            <View style={[styles.dashboardIntro, userRole === 'CRAFTSMAN' ? styles.dashboardIntroCraftsman : styles.dashboardIntroCustomer]}>
              <Text style={[styles.eyebrow, userRole === 'CRAFTSMAN' ? styles.roleEyebrowCraftsman : styles.roleEyebrowCustomer]}>KUĆNI MAJSTOR / MOJ NALOG</Text>
              <Text style={[styles.dashboardTitle, userRole === 'CRAFTSMAN' && styles.dashboardTitleCraftsman]}>
                {activeTab === 'profile' ? 'Tvoj profil' : userRole === 'CRAFTSMAN' ? 'Dostupni zahtevi' : 'Šta treba popraviti?'}
              </Text>
            </View>
            <View style={styles.segment}>
              <SegmentButton active={activeTab === 'requests'} label="Zahtevi" onPress={() => setActiveTab('requests')} />
              <SegmentButton active={activeTab === 'profile'} label="Profil" onPress={() => setActiveTab('profile')} />
            </View>
            {activeTab === 'requests' ? selectedRequest ? (
              <View style={styles.panel}>
                <Pressable onPress={closeRequestDetails} style={styles.backButton} accessibilityRole="button">
                  <Text style={styles.backButtonText}>‹  Nazad na zahteve</Text>
                </Pressable>
                <Text style={styles.sectionTitle}>Pregled zahteva</Text>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Status zahteva</Text>
                  <RequestStatusBadge status={selectedRequest.status} />
                </View>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Kategorija usluge</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded: isDetailCategoryOpen }}
                    onPress={() => setIsDetailCategoryOpen((open) => !open)}
                    style={styles.dropdownTrigger}
                  >
                    <Text style={styles.dropdownText}>
                      {categories.find((category) => String(category.id) === detailForm.categoryId)?.name || 'Izaberite kategoriju'}
                    </Text>
                    <Text style={styles.dropdownArrow}>{isDetailCategoryOpen ? '⌃' : '⌄'}</Text>
                  </Pressable>
                  {isDetailCategoryOpen && (
                    <View style={styles.dropdownMenu}>
                      {availableCategories.map((category) => (
                        <Pressable
                          key={category.id}
                          onPress={() => {
                            setDetailForm((current) => ({ ...current, categoryId: String(category.id) }));
                            setIsDetailCategoryOpen(false);
                          }}
                          style={styles.dropdownOption}
                        >
                          <Text style={styles.dropdownText}>{category.name}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Slika zahteva</Text>
                  {detailImage ? (
                    <Image source={{ uri: detailImage.uri }} style={styles.imagePreview} />
                  ) : selectedRequest.imageUrl ? (
                    <AuthenticatedRequestImage imageUrl={selectedRequest.imageUrl} token={token} />
                  ) : (
                    <Text style={styles.muted}>Slika nije dodata.</Text>
                  )}
                  <View style={styles.imageActions}>
                    <Pressable disabled={loading} onPress={() => void chooseImage('camera')} style={styles.imageActionButton}>
                      <Text style={styles.imageActionText}>Fotografiši</Text>
                    </Pressable>
                    <Pressable disabled={loading} onPress={() => void chooseImage('library')} style={styles.imageActionButton}>
                      <Text style={styles.imageActionText}>Izaberi iz telefona</Text>
                    </Pressable>
                  </View>
                </View>
                <Field
                  label="Opis problema"
                  value={detailForm.description}
                  onChangeText={(description) => setDetailForm((current) => ({ ...current, description }))}
                  multiline
                  numberOfLines={4}
                />
                <PrimaryButton
                  disabled={loading || !detailForm.categoryId || !detailForm.description.trim()}
                  label={loading ? 'Čuvam...' : 'Sačuvaj izmene'}
                  onPress={() => void saveRequestDetails()}
                />
                <Feedback error={error} success={success} />
              </View>
            ) : selectedJob ? (
              <View style={styles.panel}>
                <Pressable onPress={() => setSelectedJob(null)} style={styles.backButton} accessibilityRole="button">
                  <Text style={styles.backButtonText}>‹  Nazad na poslove</Text>
                </Pressable>
                <Text style={styles.sectionTitle}>{selectedJob.categoryName}</Text>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Status zahteva</Text>
                  <RequestStatusBadge status={selectedJob.status} />
                </View>
                <Text style={styles.fieldLabel}>Grad</Text>
                <Text style={styles.requestCity}>{selectedJob.city || 'Nije naveden'}</Text>
                <Text style={styles.fieldLabel}>Ulica</Text>
                <RequestAddress latitude={selectedJob.latitude} longitude={selectedJob.longitude} />
                <Text style={styles.fieldLabel}>Slika problema</Text>
                {selectedJob.imageUrl
                  ? <AuthenticatedRequestImage imageUrl={selectedJob.imageUrl} token={token} />
                  : <Text style={styles.muted}>Slika nije dodata.</Text>}
                <Text style={styles.fieldLabel}>Opis problema</Text>
                <Text style={styles.requestDescription}>{selectedJob.description}</Text>
                <Text style={styles.fieldLabel}>Mapa lokacije</Text>
                <RequestMap latitude={selectedJob.latitude} longitude={selectedJob.longitude} />
              </View>
            ) : (
              <>
                {canSubmitRequest ? (
                  <View style={styles.panel}>
                    <Text style={styles.sectionTitle}>Novi zahtev</Text>
                    <Text style={styles.muted}>Opiši problem i majstori iz tvoje okoline mogu da ti pošalju ponudu.</Text>
                    <View style={styles.form}>
                      <View style={styles.field}>
                        <Text style={styles.fieldLabel}>Kategorija usluge</Text>
                        {availableCategories.length > 0 ? (
                          <>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityState={{ expanded: isCategoryDropdownOpen }}
                              onPress={() => setIsCategoryDropdownOpen((isOpen) => !isOpen)}
                              style={styles.dropdownTrigger}
                            >
                              <Text style={[styles.dropdownText, !selectedCategory && styles.dropdownPlaceholder]}>
                                {selectedCategory?.name || 'Izaberite kategoriju'}
                              </Text>
                              <Text style={styles.dropdownArrow}>{isCategoryDropdownOpen ? '⌃' : '⌄'}</Text>
                            </Pressable>
                            {isCategoryDropdownOpen && (
                              <View style={styles.dropdownMenu}>
                                {availableCategories.map((category) => (
                                  <Pressable
                                    key={category.id}
                                    accessibilityRole="button"
                                    onPress={() => {
                                      setForm((current) => ({ ...current, categoryId: String(category.id) }));
                                      setIsCategoryDropdownOpen(false);
                                    }}
                                    style={styles.dropdownOption}
                                  >
                                    <Text style={styles.dropdownText}>{category.name}</Text>
                                  </Pressable>
                                ))}
                              </View>
                            )}
                          </>
                        ) : <Text style={styles.muted}>Kategorije trenutno nisu dostupne.</Text>}
                      </View>
                      <View style={styles.field}>
                        <Text style={styles.fieldLabel}>Slika problema (opciono)</Text>
                        <View style={styles.imageActions}>
                          <Pressable accessibilityRole="button" disabled={loading} onPress={() => void chooseImage('camera')} style={styles.imageActionButton}>
                            <Text style={styles.imageActionText}>Fotografiši</Text>
                          </Pressable>
                          <Pressable accessibilityRole="button" disabled={loading} onPress={() => void chooseImage('library')} style={styles.imageActionButton}>
                            <Text style={styles.imageActionText}>Izaberi iz telefona</Text>
                          </Pressable>
                        </View>
                        {selectedImage && (
                          <View style={styles.imagePreviewContainer}>
                            <Image source={{ uri: selectedImage.uri }} style={styles.imagePreview} />
                            <Pressable
                              accessibilityRole="button"
                              onPress={() => {
                                setSelectedImage(null);
                                setUploadedImageUrl('');
                              }}
                              style={styles.removeImageButton}
                            >
                              <Text style={styles.removeImageText}>Ukloni sliku</Text>
                            </Pressable>
                          </View>
                        )}
                      </View>
                      <Field label="Opis problema" value={form.description} onChangeText={(description) => setForm((current) => ({ ...current, description }))} placeholder="Šta je potrebno popraviti?" multiline numberOfLines={4} />
                      <PrimaryButton disabled={loading || !form.categoryId || !form.description.trim()} label={loading ? 'Šaljem...' : 'Pošalji zahtev'} onPress={() => void handleCreateRequest()} />
                    </View>
                  </View>
                ) : (
                  <View style={styles.panel}>
                    <Text style={styles.sectionTitle}>Zahtevi u tvojoj okolini</Text>
                    <Text style={styles.muted}>Pretraži otvorene poslove po gradu.</Text>
                    <Field label="Grad" value={citySearch} onChangeText={setCitySearch} placeholder="Unesite grad" autoCapitalize="words" maxLength={120} />
                    <PrimaryButton disabled={loading} label={loading ? 'Pretražujem...' : 'Pretraži grad'} onPress={() => void searchRequestsByCity()} />
                  </View>
                )}
                <View style={styles.listHeading}>
                  <Text style={styles.sectionTitle}>{userRole === 'CRAFTSMAN' ? 'Dostupni zahtevi' : 'Moji zahtevi'}</Text>
                  <Text style={styles.count}>{requests.length}</Text>
                </View>
                {requests.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyTitle}>
                      {userRole === 'CRAFTSMAN' ? 'Trenutno nema otvorenih zahteva' : 'Još nema zahteva'}
                    </Text>
                    <Text style={styles.muted}>
                      {userRole === 'CRAFTSMAN' ? 'Novi zahtevi će se pojaviti ovde.' : 'Kada pošalješ zahtev, videćeš ga ovde.'}
                    </Text>
                  </View>
                ) : requests.map((request) => (
                  <RequestCard
                    key={request.id}
                    request={request}
                    token={token}
                    showCity={userRole === 'CRAFTSMAN'}
                    onViewDetails={userRole === 'CRAFTSMAN' ? () => void openJobDetails(request.id) : undefined}
                    onReview={canSubmitRequest ? () => void openRequest(request.id) : undefined}
                    onDelete={canSubmitRequest ? () => confirmDeleteRequest(request.id) : undefined}
                    deleteDisabled={loading}
                  />
                ))}
              </>
            ) : (
              <View style={styles.panel}>
                <Text style={styles.eyebrow}>PODACI NALOGA</Text>
                <Text style={styles.profileEmail}>{user?.email}</Text>
                <Text style={styles.fieldLabel}>Tip naloga</Text>
                <Text style={styles.profileRole}>{userRole === 'CUSTOMER' ? 'Korisnik' : 'Majstor'}</Text>
                <Text style={styles.fieldLabel}>Grad</Text>
                <Text style={styles.profileRole}>{user?.city || 'Nije unet'}</Text>
                {userRole === 'CRAFTSMAN' && <>
                  <View style={styles.divider} />
                  <Text style={styles.sectionTitle}>Obaveštenja za nove poslove</Text>
                  <Text style={styles.muted}>Primaj obaveštenja samo za poslove iz izabranih gradova i tvojih kategorija usluga.</Text>
                  <View style={styles.form}>
                    {notificationCityOptions.map((city) => {
                      const selected = notificationCities.some((value) => value.toLowerCase() === city.toLowerCase());
                      return (
                        <Pressable
                          key={city.toLowerCase()}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: selected }}
                          onPress={() => toggleNotificationCity(city)}
                          style={styles.registrationCategory}
                        >
                          <View style={[styles.checkbox, selected && styles.checkboxChecked]}>
                            {selected && <Text style={styles.checkboxCheck}>✓</Text>}
                          </View>
                          <Text style={styles.registrationCategoryText}>{city}</Text>
                        </Pressable>
                      );
                    })}
                    <View style={styles.field}>
                      <Text style={styles.fieldLabel}>Dodaj drugi grad</Text>
                      <TextInput
                        value={notificationCityInput}
                        onChangeText={setNotificationCityInput}
                        placeholder="Unesite naziv grada"
                        placeholderTextColor={colors.muted}
                        maxLength={120}
                        style={styles.input}
                        returnKeyType="done"
                        onSubmitEditing={addNotificationCity}
                      />
                    </View>
                    <SecondaryButton label="Dodaj grad" onPress={addNotificationCity} />
                    <PrimaryButton
                      disabled={savingNotificationSettings}
                      label={savingNotificationSettings ? 'Čuvam...' : 'Sačuvaj gradove'}
                      onPress={() => void saveNotificationCities()}
                      variant="CRAFTSMAN"
                    />
                  </View>
                  <Text style={styles.fieldLabel}>Push obaveštenja na ovom uređaju</Text>
                  <Text style={styles.muted}>{isExpoGo()
                    ? 'Push obaveštenja nisu podržana u Expo Go. Napravi i instaliraj FixHome development build da bi ih uključio.'
                    : pushEnabled
                      ? 'Push obaveštenja su uključena.'
                      : 'Uključi ih da bi obaveštenja stizala i kada aplikacija nije otvorena.'}</Text>
                  <SecondaryButton
                    disabled={savingNotificationSettings || isExpoGo()}
                    label={isExpoGo()
                      ? 'Potreban je FixHome development build'
                      : pushEnabled
                        ? 'Isključi push obaveštenja'
                        : 'Uključi push obaveštenja'}
                    onPress={() => void togglePushNotifications()}
                  />
                </>}
                <View style={styles.divider} />
                <Pressable onPress={() => void logout()} style={styles.logoutButton}>
                  <Text style={styles.logoutText}>Odjavi se</Text>
                </Pressable>
              </View>
            )}
            <Feedback error={error} success={success} />
          </ScrollView>
        </View>
      )}
    </SafeAreaView>
  );
}

function RoleCard({ role, title, subtitle, onPress }: { role: Role; title: string; subtitle: string; onPress: () => void }) {
  const isCraftsman = role === 'CRAFTSMAN';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.roleCard, isCraftsman && styles.roleCardCraftsman, pressed && styles.roleCardPressed]}
    >
      <View style={[styles.roleLogo, isCraftsman && styles.roleLogoCraftsman]}>
        {isCraftsman ? (
          <CraftsmanToolboxMark />
        ) : (
          <View style={styles.houseIcon}>
            <View style={styles.houseRoof} />
            <View style={styles.houseBase}>
              <View style={styles.houseDoor} />
            </View>
          </View>
        )}
      </View>
      <View style={styles.roleCopy}>
        <Text style={[styles.roleCaption, isCraftsman && styles.roleCaptionCraftsman]}>
          {isCraftsman ? 'ZA MAJSTORE' : 'ZA DOMAĆINSTVA'}
        </Text>
        <Text style={[styles.roleTitle, isCraftsman && styles.roleTitleCraftsman]}>{title}</Text>
        <Text style={[styles.roleSubtitle, isCraftsman && styles.roleSubtitleCraftsman]}>{subtitle}</Text>
      </View>
      <Text style={[styles.roleArrow, isCraftsman && styles.roleArrowCraftsman]}>›</Text>
    </Pressable>
  );
}

function CraftsmanToolboxMark() {
  return (
    <View style={styles.toolboxMark} accessibilityLabel="Znak kutije sa alatom">
      <View style={styles.toolboxHammerHandle} />
      <View style={styles.toolboxHammerHead} />
      <View style={styles.toolboxWrenchHandle} />
      <View style={styles.toolboxWrenchHead}>
        <View style={styles.toolboxWrenchHole} />
      </View>
      <View style={styles.toolboxHandle} />
      <View style={styles.toolboxBody}>
        <View style={styles.toolboxLatch} />
      </View>
    </View>
  );
}

function SegmentButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.segmentButton, active && styles.segmentButtonActive]}>
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </Pressable>
  );
}

function PrimaryButton({ label, onPress, disabled, variant }: { label: string; onPress: () => void; disabled?: boolean; variant?: Role | null }) {
  const showSpinner = disabled && (label.includes('Sačekajte') || label.includes('Šaljem'));
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.primaryButton, variant === 'CUSTOMER' && styles.primaryButtonCustomer, variant === 'CRAFTSMAN' && styles.primaryButtonCraftsman, (disabled || pressed) && styles.primaryButtonDimmed]}>
      {showSpinner ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>{label}</Text>}
    </Pressable>
  );
}

function SecondaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.imageActionButton, (disabled || pressed) && styles.primaryButtonDimmed]}
    >
      <Text style={styles.imageActionText}>{label}</Text>
    </Pressable>
  );
}

function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput {...props} placeholderTextColor={colors.muted} style={[styles.input, props.multiline && styles.multilineInput]} />
    </View>
  );
}

function RequestStatusBadge({ status }: { status: string }) {
  const presentation = getRequestStatusPresentation(status);
  const toneStyle = presentation.tone === 'open'
    ? styles.statusBadgeOpen
    : presentation.tone === 'in-progress'
      ? styles.statusBadgeInProgress
      : presentation.tone === 'completed'
        ? styles.statusBadgeCompleted
        : presentation.tone === 'cancelled'
          ? styles.statusBadgeCancelled
          : styles.statusBadgeUnknown;

  return (
    <Text
      accessibilityLabel={`Status zahteva: ${presentation.label}`}
      style={[styles.statusBadge, toneStyle]}
    >
      {presentation.label}
    </Text>
  );
}

function RequestCard({
  request,
  token,
  showCity,
  onViewDetails,
  onReview,
  onDelete,
  deleteDisabled,
}: {
  request: ServiceRequest;
  token: string;
  showCity: boolean;
  onViewDetails?: () => void;
  onReview?: () => void;
  onDelete?: () => void;
  deleteDisabled: boolean;
}) {
  return (
    <View style={styles.requestCard}>
      <View style={styles.requestHeader}>
        <Text style={styles.requestCategory}>{request.categoryName}</Text>
        <RequestStatusBadge status={request.status} />
      </View>
      {showCity && request.city && <Text style={styles.requestCity}>Grad: {request.city}</Text>}
      <Text style={styles.requestDescription}>{request.description}</Text>
      {onReview && (
        <Pressable
          accessibilityRole="button"
          disabled={deleteDisabled}
          onPress={onReview}
          style={[styles.reviewRequestButton, deleteDisabled && styles.primaryButtonDimmed]}
        >
          <Text style={styles.reviewRequestText}>Pregledaj zahtev</Text>
        </Pressable>
      )}
      {onDelete && (
        <Pressable
          accessibilityRole="button"
          disabled={deleteDisabled}
          onPress={onDelete}
          style={[styles.deleteRequestButton, deleteDisabled && styles.primaryButtonDimmed]}
        >
          <Text style={styles.deleteRequestText}>Obriši zahtev</Text>
        </Pressable>
      )}
      {request.imageUrl && (
        <AuthenticatedRequestImage imageUrl={request.imageUrl} token={token} />
      )}
      {onViewDetails && (
        <Pressable
          accessibilityRole="button"
          disabled={deleteDisabled}
          onPress={onViewDetails}
          style={[styles.reviewRequestButton, deleteDisabled && styles.primaryButtonDimmed]}
        >
          <Text style={styles.reviewRequestText}>Pregledaj detalje</Text>
        </Pressable>
      )}
    </View>
  );
}

function RequestAddress({ latitude, longitude }: { latitude: number | null; longitude: number | null }) {
  const [address, setAddress] = useState('');
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [addressError, setAddressError] = useState('');

  useEffect(() => {
    let isMounted = true;
    setAddress('');
    setAddressError('');
    if (latitude === null || longitude === null) {
      setAddressError('Lokacija zahteva nije dostupna.');
      setLoadingAddress(false);
      return () => { isMounted = false; };
    }

    setLoadingAddress(true);
    setAddressError('');
    void Location.reverseGeocodeAsync({ latitude, longitude })
      .then((results) => {
        const result = results[0];
        const street = [result?.street, result?.streetNumber].filter(Boolean).join(' ');
        if (!street) throw new Error('Ulica nije pronađena za ovu lokaciju.');
        if (isMounted) setAddress(street);
      })
      .catch((error: unknown) => {
        if (isMounted) setAddressError(getErrorMessage(error));
      })
      .finally(() => {
        if (isMounted) setLoadingAddress(false);
      });

    return () => { isMounted = false; };
  }, [latitude, longitude]);

  if (loadingAddress) return <Text style={styles.muted}>Pronalazim ulicu...</Text>;
  if (addressError) return <Text style={styles.imageError}>{addressError}</Text>;
  return <Text style={styles.requestDescription}>{address}</Text>;
}

function RequestMap({ latitude, longitude }: { latitude: number | null; longitude: number | null }) {
  const { width: screenWidth } = useWindowDimensions();
  const mapWidth = Math.max(220, Math.min(screenWidth - 88, 640));
  const mapHeight = 240;
  const [mapLoadError, setMapLoadError] = useState(false);

  useEffect(() => {
    setMapLoadError(false);
  }, [latitude, longitude]);

  if (latitude === null || longitude === null) {
    return <Text style={styles.imageError}>Lokacija zahteva nije dostupna, pa mapa ne može da se prikaže.</Text>;
  }

  const longitudeOffset = 0.004 / Math.max(Math.cos(latitude * Math.PI / 180), 0.2);
  const latitudeOffset = 0.0025;
  const bounds = [
    longitude - longitudeOffset,
    latitude - latitudeOffset,
    longitude + longitudeOffset,
    latitude + latitudeOffset,
  ].map((value) => value.toFixed(6)).join(',');
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bounds)}&layer=mapnik&marker=${encodeURIComponent(`${latitude},${longitude}`)}`;

  return (
    <View style={styles.mapContainer}>
      <WebView
        source={{ uri: mapUrl }}
        style={{ width: mapWidth, height: mapHeight, backgroundColor: colors.line }}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['https://*']}
        setSupportMultipleWindows={false}
        onError={() => setMapLoadError(true)}
      />
      {mapLoadError && <Text style={styles.imageError}>Mapa nije dostupna. Proverite internet vezu.</Text>}
      <Text style={styles.mapAttribution}>© OpenStreetMap contributors</Text>
    </View>
  );
}

function AuthenticatedRequestImage({ imageUrl, token }: { imageUrl: string; token: string }) {
  const [localUri, setLocalUri] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const cacheDirectory = FileSystem.cacheDirectory;
    if (!cacheDirectory) {
      setFailed(true);
      return () => { isMounted = false; };
    }

    setLocalUri('');
    setFailed(false);
    const fileName = imageUrl.split('/').pop()?.replace(/[^a-zA-Z0-9.-]/g, '') || 'request-image';
    void FileSystem.downloadAsync(resolveApiUrl(imageUrl), `${cacheDirectory}${fileName}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((result) => {
        if (result.status < 200 || result.status >= 300) {
          throw new Error(`Image request failed (${result.status})`);
        }
        if (isMounted) setLocalUri(result.uri);
      })
      .catch(() => {
        if (isMounted) setFailed(true);
      });

    return () => { isMounted = false; };
  }, [imageUrl, token]);

  if (failed) return <Text style={styles.imageError}>Slika trenutno nije dostupna.</Text>;
  if (!localUri) return <Text style={styles.muted}>Učitavanje slike...</Text>;
  return <Image source={{ uri: localUri }} style={styles.requestImage} />;
}

function Feedback({ error, success }: { error: string; success: string }) {
  const message = error || success;
  if (!message) return null;
  return <Text accessibilityRole="alert" style={[styles.feedback, error ? styles.feedbackError : styles.feedbackSuccess]}>{message}</Text>;
}

const colors = {
  background: '#F1F5F0',
  white: '#FFFFFF',
  ink: '#18302C',
  muted: '#6F7E78',
  line: '#D8E2DC',
  teal: '#24766A',
  tealDark: '#155248',
  tealLight: '#E3F1EC',
  coral: '#D75E43',
  redLight: '#FCE9E4',
  greenLight: '#E3F2E7',
  gold: '#F3BD58',
  goldDark: '#A96724',
};

const styles = StyleSheet.create({
  safeScreen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  authContent: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  landingPage: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 24, paddingBottom: 38, justifyContent: 'center' },
  landingIntro: { marginTop: 28, marginBottom: 22, gap: 10, padding: 23, overflow: 'hidden', borderRadius: 24, backgroundColor: colors.tealDark },
  landingBrand: { color: colors.gold, fontSize: 12, fontWeight: '800', letterSpacing: 2.2 },
  landingTitle: { color: colors.white, fontSize: 27, lineHeight: 34, fontWeight: '800', maxWidth: 350 },
  landingAccent: { width: 42, height: 4, marginTop: 5, borderRadius: 2, backgroundColor: colors.gold },
  rolePrompt: { marginBottom: 12, color: colors.ink, fontSize: 16, fontWeight: '800' },
  roleList: { gap: 13 },
  roleCard: { minHeight: 116, flexDirection: 'row', alignItems: 'center', gap: 15, padding: 16, backgroundColor: '#FFF9EC', borderRadius: 20, borderWidth: 1, borderColor: '#EEDBAF', shadowColor: '#18302C', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 14, elevation: 3 },
  roleCardCraftsman: { backgroundColor: '#1D5C51', borderColor: '#1D5C51' },
  roleCardPressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  roleLogo: { width: 60, height: 60, borderRadius: 19, backgroundColor: '#F4C96F', alignItems: 'center', justifyContent: 'center' },
  roleLogoCraftsman: { backgroundColor: '#E3F1EC' },
  roleCopy: { flex: 1, gap: 5 },
  roleCaption: { color: colors.goldDark, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  roleCaptionCraftsman: { color: '#F4C96F' },
  roleTitle: { color: colors.ink, fontSize: 21, fontWeight: '800' },
  roleTitleCraftsman: { color: colors.white },
  roleSubtitle: { color: '#65736C', fontSize: 13, lineHeight: 18 },
  roleSubtitleCraftsman: { color: '#D2E4DD' },
  roleArrow: { color: colors.goldDark, fontSize: 30, fontWeight: '500', paddingLeft: 2 },
  roleArrowCraftsman: { color: colors.white },
  houseIcon: { alignItems: 'center', justifyContent: 'flex-end', width: 38, height: 38 },
  houseRoof: { width: 0, height: 0, borderLeftWidth: 20, borderRightWidth: 20, borderBottomWidth: 17, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#FFF8E9' },
  houseBase: { width: 28, height: 20, backgroundColor: '#FFF8E9', alignItems: 'center', justifyContent: 'flex-end' },
  houseDoor: { width: 8, height: 12, backgroundColor: colors.coral, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  toolboxMark: { position: 'relative', width: 48, height: 48, alignItems: 'center', justifyContent: 'flex-end' },
  toolboxBody: { position: 'absolute', bottom: 3, left: 4, width: 40, height: 27, alignItems: 'center', justifyContent: 'center', borderRadius: 7, backgroundColor: colors.tealDark },
  toolboxHandle: { position: 'absolute', bottom: 27, left: 15, width: 18, height: 12, borderTopWidth: 4, borderLeftWidth: 4, borderRightWidth: 4, borderTopLeftRadius: 5, borderTopRightRadius: 5, borderColor: colors.tealDark },
  toolboxLatch: { width: 8, height: 9, borderRadius: 2, backgroundColor: colors.coral },
  toolboxHammerHandle: { position: 'absolute', top: 2, left: 17, width: 4, height: 24, borderRadius: 2, backgroundColor: colors.coral, transform: [{ rotate: '28deg' }] },
  toolboxHammerHead: { position: 'absolute', top: 2, left: 9, width: 17, height: 5, borderRadius: 2, backgroundColor: colors.gold, transform: [{ rotate: '28deg' }] },
  toolboxWrenchHandle: { position: 'absolute', top: 2, right: 12, width: 4, height: 23, borderRadius: 2, backgroundColor: '#8C989C', transform: [{ rotate: '-28deg' }] },
  toolboxWrenchHead: { position: 'absolute', top: 0, right: 7, width: 13, height: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: '#8C989C', borderRadius: 7 },
  toolboxWrenchHole: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#E3F1EC' },
  landingFooter: { marginTop: 24, textAlign: 'center', color: colors.muted, fontSize: 12, fontWeight: '600' },
  authPage: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 26, paddingBottom: 100, justifyContent: 'center' },
  authLoginPage: { paddingTop: 12, paddingBottom: 12 },
  authBottomNav: { flexDirection: 'row', gap: 8, marginHorizontal: 18, marginTop: 8, marginBottom: 10, padding: 7, borderWidth: 1, borderColor: '#B8D3C9', borderRadius: 18, backgroundColor: '#DCEBE5' },
  authBottomNavCustomer: { borderColor: '#E8D39A', backgroundColor: '#FFF4DC' },
  authBottomNavCraftsman: { borderColor: '#155248', backgroundColor: '#DCEBE5' },
  authNavItem: { flex: 1, minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: 'transparent', borderRadius: 13 },
  authNavItemActive: {},
  authNavItemActiveCustomer: { backgroundColor: '#C88724', borderColor: '#C88724' },
  authNavItemActiveCraftsman: { backgroundColor: colors.tealDark, borderColor: colors.tealDark },
  authNavIcon: { color: colors.muted, fontSize: 18, fontWeight: '700' },
  authNavIconActive: { color: colors.white },
  authNavIconActiveCustomer: { color: colors.white },
  authNavIconActiveCraftsman: { color: colors.white },
  authNavLabel: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  authNavLabelActive: { color: colors.white },
  authNavLabelActiveCustomer: { color: colors.white },
  authNavLabelActiveCraftsman: { color: colors.white },
  backButton: { alignSelf: 'flex-start', marginTop: 22, paddingVertical: 8, paddingRight: 12 },
  backButtonText: { color: colors.tealDark, fontSize: 14, fontWeight: '700' },
  authBackButton: { alignSelf: 'flex-start', minHeight: 42, justifyContent: 'center', marginTop: 4, marginBottom: 14, paddingHorizontal: 14, borderWidth: 1, borderRadius: 10, transform: [{ translateY: 16 }] },
  authBackButtonCustomer: { borderColor: '#EEDBAF', backgroundColor: '#FFF8E9' },
  authBackButtonCraftsman: { borderColor: colors.tealDark, backgroundColor: colors.tealDark },
  authBackButtonText: { color: colors.goldDark, fontSize: 15, fontWeight: '800' },
  authBackButtonTextCraftsman: { color: colors.white },
  registrationCategory: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 10, borderWidth: 1, borderColor: colors.line, borderRadius: 6 },
  registrationCategoryText: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  checkbox: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.muted, borderRadius: 4 },
  checkboxChecked: { backgroundColor: colors.teal, borderColor: colors.teal },
  checkboxCheck: { color: colors.white, fontSize: 14, lineHeight: 18, fontWeight: '800' },
  dashboardPage: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 48, gap: 18 },
  switchAccountButton: { alignSelf: 'flex-end', paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: colors.line, borderRadius: 6 },
  switchAccountText: { color: colors.tealDark, fontSize: 12, fontWeight: '700' },
  authIntro: { marginTop: 24, marginBottom: 24, gap: 10, padding: 18, borderRadius: 18, borderWidth: 1 },
  authIntroCustomer: { backgroundColor: '#FFF8E9', borderColor: '#EEDBAF' },
  authIntroCraftsman: { backgroundColor: colors.tealDark, borderColor: colors.tealDark },
  roleEyebrowCustomer: { color: colors.goldDark },
  roleEyebrowCraftsman: { color: colors.gold },
  eyebrow: { color: colors.coral, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  authTitle: { color: colors.ink, fontSize: 34, lineHeight: 39, fontWeight: '800', maxWidth: 340 },
  authTitleCraftsman: { color: colors.white },
  authDescriptionCraftsman: { color: '#D2E4DD' },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  panel: { backgroundColor: colors.white, borderRadius: 8, borderWidth: 1, borderColor: colors.line, padding: 18, gap: 16 },
  authPanelCustomer: { borderColor: '#EEDBAF', backgroundColor: '#FFFEFA' },
  authPanelCraftsman: { borderColor: '#9DBDB2' },
  registrationCategorySection: { gap: 9, padding: 14, borderWidth: 1, borderColor: '#9DBDB2', borderRadius: 10, backgroundColor: '#F1F7F4' },
  categoryLoading: { alignItems: 'flex-start', gap: 10, paddingVertical: 8 },
  categoryError: { color: colors.coral, fontSize: 13, lineHeight: 19 },
  categorySelectionCount: { color: colors.tealDark, fontSize: 12, fontWeight: '800' },
  segment: { flexDirection: 'row', backgroundColor: colors.background, borderRadius: 7, padding: 4, gap: 4 },
  segmentButton: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 5, paddingHorizontal: 8 },
  segmentButtonActive: { backgroundColor: colors.tealDark },
  segmentText: { color: colors.muted, fontSize: 14, fontWeight: '700' },
  segmentTextActive: { color: colors.white },
  form: { gap: 15 },
  field: { gap: 7, flex: 1 },
  fieldLabel: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  input: { minHeight: 48, borderColor: colors.line, borderWidth: 1, borderRadius: 6, paddingHorizontal: 13, paddingVertical: 11, color: colors.ink, backgroundColor: colors.white, fontSize: 15 },
  multilineInput: { minHeight: 100, textAlignVertical: 'top' },
  primaryButton: { minHeight: 50, backgroundColor: colors.teal, borderRadius: 6, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, marginTop: 3 },
  primaryButtonCustomer: { backgroundColor: '#C88724' },
  primaryButtonCraftsman: { backgroundColor: colors.tealDark },
  primaryButtonDimmed: { opacity: 0.58 },
  primaryButtonText: { color: colors.white, fontSize: 15, fontWeight: '800' },
  feedback: { overflow: 'hidden', borderRadius: 6, paddingHorizontal: 13, paddingVertical: 11, fontSize: 13, fontWeight: '600' },
  feedbackError: { backgroundColor: colors.redLight, color: '#8E3524' },
  feedbackSuccess: { backgroundColor: colors.greenLight, color: '#286344' },
  dashboardIntro: { gap: 7, marginTop: 14, padding: 16, borderWidth: 1, borderRadius: 18 },
  dashboardIntroCustomer: { backgroundColor: '#FFF8E9', borderColor: '#EEDBAF' },
  dashboardIntroCraftsman: { backgroundColor: colors.tealDark, borderColor: colors.tealDark },
  dashboardTitle: { color: colors.ink, fontSize: 28, lineHeight: 34, fontWeight: '800' },
  dashboardTitleCraftsman: { color: colors.white },
  sectionTitle: { color: colors.ink, fontSize: 19, fontWeight: '800' },
  dropdownTrigger: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.line, borderRadius: 6, paddingHorizontal: 13, backgroundColor: colors.white },
  dropdownText: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  dropdownPlaceholder: { color: colors.muted, fontWeight: '400' },
  dropdownArrow: { color: colors.tealDark, fontSize: 20, fontWeight: '700' },
  dropdownMenu: { borderWidth: 1, borderColor: colors.line, borderRadius: 6, backgroundColor: colors.white, overflow: 'hidden' },
  dropdownOption: { minHeight: 46, justifyContent: 'center', paddingHorizontal: 13, borderBottomWidth: 1, borderBottomColor: colors.line },
  imageActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  imageActionButton: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 13, borderRadius: 6, borderWidth: 1, borderColor: colors.teal, backgroundColor: colors.tealLight },
  imageActionText: { color: colors.tealDark, fontSize: 13, fontWeight: '700' },
  imagePreviewContainer: { gap: 8, alignItems: 'flex-start' },
  imagePreview: { width: '100%', height: 190, borderRadius: 6, backgroundColor: colors.background },
  removeImageButton: { paddingVertical: 6, paddingHorizontal: 10 },
  removeImageText: { color: colors.coral, fontSize: 13, fontWeight: '700' },
  listHeading: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 2 },
  count: { color: colors.tealDark, backgroundColor: colors.tealLight, overflow: 'hidden', borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3, fontSize: 12, fontWeight: '800' },
  emptyState: { paddingVertical: 26, paddingHorizontal: 18, alignItems: 'center', gap: 7, borderWidth: 1, borderColor: colors.line, borderStyle: 'dashed', borderRadius: 8 },
  emptyTitle: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  requestCard: { backgroundColor: colors.white, padding: 16, borderRadius: 8, borderColor: colors.line, borderWidth: 1, gap: 10 },
  requestHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  requestCategory: { flex: 1, color: colors.ink, fontSize: 16, fontWeight: '800' },
  statusBadge: { overflow: 'hidden', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, fontSize: 12, fontWeight: '800' },
  statusBadgeOpen: { color: '#166534', backgroundColor: '#DCFCE7' },
  statusBadgeInProgress: { color: '#92400E', backgroundColor: '#FEF3C7' },
  statusBadgeCompleted: { color: '#334155', backgroundColor: '#E2E8F0' },
  statusBadgeCancelled: { color: '#991B1B', backgroundColor: '#FEE2E2' },
  statusBadgeUnknown: { color: '#334155', backgroundColor: '#E2E8F0' },
  requestCity: { color: colors.muted, fontSize: 12, marginBottom: 6 },
  requestDescription: { color: colors.ink, fontSize: 14, lineHeight: 20 },
  requestImage: { width: '100%', height: 200, borderRadius: 6, backgroundColor: colors.background },
  mapContainer: { width: '100%', alignItems: 'center', gap: 6 },
  mapAttribution: { color: colors.muted, fontSize: 10, alignSelf: 'flex-end' },
  imageError: { color: colors.coral, fontSize: 13 },
  reviewRequestButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 6, borderWidth: 1, borderColor: colors.teal, paddingHorizontal: 12 },
  reviewRequestText: { color: colors.tealDark, fontSize: 13, fontWeight: '800' },
  deleteRequestButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 6, borderWidth: 1, borderColor: colors.coral, paddingHorizontal: 12 },
  deleteRequestText: { color: colors.coral, fontSize: 13, fontWeight: '800' },
  requestLocation: { color: colors.muted, fontSize: 12 },
  profileEmail: { color: colors.ink, fontSize: 19, lineHeight: 26, fontWeight: '800', marginTop: 2 },
  profileRole: { color: colors.tealDark, fontSize: 15, fontWeight: '700' },
  divider: { height: 1, backgroundColor: colors.line },
  logoutButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 6 },
  logoutText: { color: colors.coral, fontSize: 14, fontWeight: '800' },
});