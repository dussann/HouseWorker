import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type ImageStyle,
  type ScrollViewInstance,
  type TextInputInstance,
  type TextInputProps,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system/legacy';
import { NavigationBar } from 'expo-navigation-bar';
import { WebView } from 'react-native-webview';
import { StatusBar } from 'expo-status-bar';
import { apiFetch, clearSession, getSession, registerWithImage, resolveApiUrl, saveSession, uploadImage, type AuthResponse, type RegistrationPayload, type SessionUser } from './api';
import { createEmptyAuthForm, type AuthForm, type Role } from './authForm';
import { designTokens } from './designTokens';
import { averageRating, type PublicReview, type CustomerReview } from './reviews';
import { getRatingCountLabel, getRequestStatusPresentation } from './requestStatus';
import { isExpoGo, registerForPushNotifications } from './pushNotifications';

type AuthMode = 'login' | 'register';
type Category = { id: number; name: string };
type ServiceRequest = {
  id: number;
  categoryId: number;
  categoryName: string;
  city: string | null;
  description: string;
  status: string;
  imageUrl: string | null;
  hasOffered?: boolean;
};
type ServiceReview = { requestId: number; rating: number; comment: string | null; createdAt: string };
type Offer = {
  id: number;
  requestId: number;
  craftsmanId: number;
  craftsmanCompanyName: string | null;
  price: number | null;
  message: string | null;
  agreeOnSite: boolean;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  craftsmanEmail: string | null;
  craftsmanPhone: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
};
type CompletedJob = {
  requestId: number;
  categoryName: string;
  description: string;
  completedAt: string;
  rating: number;
  comment: string | null;
  customerReview: CustomerReview | null;
};
type CraftsmanRequestDetails = Pick<ServiceRequest, 'id' | 'categoryName' | 'city' | 'description' | 'imageUrl' | 'status' | 'hasOffered'> & {
  customerId: number;
  latitude: number | null;
  longitude: number | null;
};
type RequestForm = {
  categoryId: string;
  description: string;
};

const emptyForm: RequestForm = {
  categoryId: '',
  description: '',
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Request failed';
}

export default function AppNative() {
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const authFormVersion = useRef(0);
  const authScrollRef = useRef<ScrollViewInstance | null>(null);
  const authInputRef = useRef<TextInputInstance | null>(null);
  const authScrollOffset = useRef(0);
  const authScrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const [selectedReview, setSelectedReview] = useState<ServiceReview | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [completedJobs, setCompletedJobs] = useState<CompletedJob[]>([]);
  const [loadingCompletedJobs, setLoadingCompletedJobs] = useState(false);
  const [completedJobsError, setCompletedJobsError] = useState('');
  const [selectedJob, setSelectedJob] = useState<CraftsmanRequestDetails | null>(null);
  const [receivedOffers, setReceivedOffers] = useState<Offer[]>([]);
  const [offersDialogVisible, setOffersDialogVisible] = useState(false);
  const [focusedOffer, setFocusedOffer] = useState<Offer | null>(null);
  const [offerModalVisible, setOfferModalVisible] = useState(false);
  const [offerMessage, setOfferMessage] = useState('');
  const [offerPrice, setOfferPrice] = useState('');
  const [offerAgreeOnSite, setOfferAgreeOnSite] = useState(false);
  const [detailForm, setDetailForm] = useState<RequestForm>(emptyForm);
  const [detailImage, setDetailImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [isDetailCategoryOpen, setIsDetailCategoryOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'requests' | 'profile' | 'ratings'>('requests');
  const [loading, setLoading] = useState(false);
  const [detectingCity, setDetectingCity] = useState(false);
  const [restoringSession, setRestoringSession] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState<RequestForm>(emptyForm);
  const [selectedImage, setSelectedImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState('');
  const [registrationImage, setRegistrationImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [authForm, setAuthForm] = useState<AuthForm>(() => createEmptyAuthForm('CUSTOMER'));
  const [notificationCities, setNotificationCities] = useState<string[]>([]);
  const [craftsmanCategories, setCraftsmanCategories] = useState<string[]>([]);
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
    if (token && userRole === 'CUSTOMER') {
      void apiFetch<{ enabled: boolean }>('/users/profile/push-token')
        .then((status) => setPushEnabled(status.enabled))
        .catch((notificationError: unknown) => setError(getErrorMessage(notificationError)));
    }
  }, [token, userRole]);

  useEffect(() => {
    if (!token || userRole !== 'CRAFTSMAN' || activeTab !== 'ratings') return;
    const controller = new AbortController();
    setCompletedJobs([]);
    setCompletedJobsError('');
    setLoadingCompletedJobs(true);
    void apiFetch<CompletedJob[]>('/craftsmen/profile/completed-jobs', { signal: controller.signal })
      .then((jobs) => {
        if (!controller.signal.aborted) setCompletedJobs(jobs);
      })
      .catch((loadError: unknown) => {
        if (!controller.signal.aborted) setCompletedJobsError(getErrorMessage(loadError));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingCompletedJobs(false);
      });
    return () => controller.abort();
  }, [token, userRole, activeTab]);

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
          const notificationType = response.notification.request.content.data?.type;
          if (notificationType === 'OFFER_RECEIVED') {
            void openRequest(requestId);
          } else if (notificationType === 'OFFER_ACCEPTED') {
            const offerId = Number(response.notification.request.content.data?.offerId);
            if (Number.isInteger(offerId) && offerId > 0) void openAcceptedOffer(offerId);
          } else {
            void openJobDetails(requestId);
          }
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
      const preferences = await apiFetch<{ cities: string[]; pushEnabled: boolean; categories: string[] }>('/craftsmen/profile/notifications');
      setNotificationCities(preferences.cities);
      setCraftsmanCategories(preferences.categories ?? []);
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
      const pushTokenPath = userRole === 'CRAFTSMAN'
        ? '/craftsmen/profile/notifications/push-token'
        : '/users/profile/push-token';
      await apiFetch<void | { enabled: boolean }>(pushTokenPath, {
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
      const registrationDisplayName = `${authForm.firstName.trim()} ${authForm.lastName.trim()}`.trim();
      const registrationPayload: RegistrationPayload = {
        displayName: registrationDisplayName,
        email: authForm.email,
        password: authForm.password,
        phone: authForm.phone,
        role: authForm.role,
        city: authForm.city.trim(),
        categoryIds: selectedRole === 'CRAFTSMAN' ? authForm.categoryIds : [],
      };
      const payload = authMode === 'login'
        ? { email: authForm.email, password: authForm.password, role: selectedRole }
        : registrationPayload;
      let data: AuthResponse;
      if (authMode === 'register' && registrationImage) {
        data = await registerWithImage(
          registrationImage.uri,
          registrationImage.mimeType || 'image/jpeg',
          registrationPayload,
        );
      } else {
        data = await apiFetch<AuthResponse>(endpoint, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      const authToken = data.accessToken || data.token;
      if (!authToken) throw new Error('Authentication token was not returned');

      const nextUser: SessionUser = {
        email: data.email,
        displayName: data.displayName || (authMode === 'register' ? registrationDisplayName : undefined),
        profileImageUrl: data.profileImageUrl,
        role: data.role || authForm.role,
        city: data.city || authForm.city,
      };
      await saveSession({ token: authToken, user: nextUser });
      setToken(authToken);
      setUser(nextUser);
      setCitySearch(nextUser.city || '');
      setRegistrationImage(null);
      setSuccess(authMode === 'login' ? 'Uspešna prijava' : 'Uspešna registracija');
    } catch (authError) {
      setError(getErrorMessage(authError));
    } finally {
      setLoading(false);
    }
  }

  async function chooseRegistrationImage() {
    const formVersion = authFormVersion.current;
    setError('');
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        throw new Error('Dozvolite pristup fotografijama da biste izabrali profilnu sliku.');
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && formVersion === authFormVersion.current) setRegistrationImage(result.assets[0]);
    } catch (imageError) {
      if (formVersion === authFormVersion.current) setError(getErrorMessage(imageError));
    }
  }

  async function detectRegistrationCity() {
    const formVersion = authFormVersion.current;
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
      if (formVersion === authFormVersion.current) setAuthForm((current) => ({ ...current, city }));
    } catch (locationError) {
      if (formVersion === authFormVersion.current) setError(getErrorMessage(locationError));
    } finally {
      if (formVersion === authFormVersion.current) setDetectingCity(false);
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
      const [review, offers] = await Promise.all([
        request.status === 'COMPLETED'
          ? apiFetch<ServiceReview | null>(`/service-requests/${requestId}/review`)
          : Promise.resolve(null),
        userRole === 'CUSTOMER'
          ? apiFetch<Offer[]>(`/service-requests/${requestId}/offers`)
          : Promise.resolve([]),
      ]);
      setSelectedReview(review);
      setReceivedOffers(offers);
      setReviewRating(5);
      setReviewComment('');
      setDetailForm({ categoryId: String(request.categoryId), description: request.description });
      setDetailImage(null);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  async function submitOffer() {
    if (!selectedJob) return;
    const normalizedPrice = offerPrice.trim().replace(',', '.');
    if (!offerAgreeOnSite && (!normalizedPrice || !Number.isFinite(Number(normalizedPrice)) || Number(normalizedPrice) <= 0)) {
      setError('Unesite iznos ili izaberite dogovor na licu mesta.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await apiFetch<Offer>('/offers', {
        method: 'POST',
        body: JSON.stringify({
          requestId: selectedJob.id,
          price: offerAgreeOnSite ? null : Number(normalizedPrice),
          message: offerMessage.trim() || null,
          agreeOnSite: offerAgreeOnSite,
        }),
      });
      setOfferModalVisible(false);
      setOfferMessage('');
      setOfferPrice('');
      setOfferAgreeOnSite(false);
      setSelectedJob((current) => current ? { ...current, hasOffered: true } : current);
      setRequests((current) => current.map((request) => request.id === selectedJob.id ? { ...request, hasOffered: true } : request));
      setSuccess('Ponuda je poslata korisniku.');
    } catch (offerError) {
      setError(getErrorMessage(offerError));
    } finally {
      setLoading(false);
    }
  }

  async function acceptOffer() {
    if (!focusedOffer || focusedOffer.status !== 'PENDING') return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const acceptedOffer = await apiFetch<Offer>(`/offers/${focusedOffer.id}/accept`, { method: 'PATCH' });
      setFocusedOffer(acceptedOffer);
      setReceivedOffers((current) => current.map((offer) => offer.id === acceptedOffer.id
        ? acceptedOffer
        : offer.status === 'PENDING' ? { ...offer, status: 'REJECTED' } : offer));
      setSelectedRequest((current) => current ? { ...current, status: 'ACCEPTED' } : current);
      setRequests((current) => current.map((request) => request.id === acceptedOffer.requestId
        ? { ...request, status: 'ACCEPTED' }
        : request));
      setSuccess('Ponuda je prihvaćena. Kontakt podaci majstora su dostupni.');
    } catch (acceptError) {
      setError(getErrorMessage(acceptError));
    } finally {
      setLoading(false);
    }
  }

  async function openAcceptedOffer(offerId: number) {
    setLoading(true);
    setError('');
    try {
      const offer = await apiFetch<Offer>(`/offers/${offerId}`);
      setFocusedOffer(offer);
      setOffersDialogVisible(true);
    } catch (offerError) {
      setError(getErrorMessage(offerError));
    } finally {
      setLoading(false);
    }
  }

  async function completeAndReview() {
    if (!selectedRequest) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const review = await apiFetch<ServiceReview>(`/service-requests/${selectedRequest.id}/completion-review`, {
        method: 'POST',
        body: JSON.stringify({ rating: reviewRating, comment: reviewComment.trim() || null }),
      });
      const completedRequest = { ...selectedRequest, status: 'COMPLETED' };
      setSelectedRequest(completedRequest);
      setSelectedReview(review);
      setRequests((current) => current.map((request) => request.id === completedRequest.id ? completedRequest : request));
      setSuccess('Posao je označen kao završen. Hvala na oceni!');
    } catch (reviewError) {
      setError(getErrorMessage(reviewError));
    } finally {
      setLoading(false);
    }
  }

  function closeRequestDetails() {
    setSelectedRequest(null);
    setSelectedReview(null);
    setReceivedOffers([]);
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

  async function openOfferForm(requestId: number) {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      setSelectedJob(await apiFetch<CraftsmanRequestDetails>(`/service-requests/available/${requestId}`));
      setOfferMessage('');
      setOfferPrice('');
      setOfferAgreeOnSite(false);
      setOfferModalVisible(true);
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
    if (pushEnabled) {
      try {
        const pushTokenPath = userRole === 'CRAFTSMAN'
          ? '/craftsmen/profile/notifications/push-token'
          : '/users/profile/push-token';
        await apiFetch<void | { enabled: boolean }>(pushTokenPath, {
          method: 'PUT',
          body: JSON.stringify({ token: null }),
        });
      } catch (unregisterError) {
        setError(`Push token nije uklonjen sa naloga: ${getErrorMessage(unregisterError)}`);
      }
    }
    await clearSession();
    resetAuthForm('CUSTOMER');
    setToken('');
    setUser(null);
    setSelectedRole(null);
    setSelectedRequest(null);
    setSelectedReview(null);
    setSelectedJob(null);
    setRequests([]);
    setCitySearch('');
    setActiveTab('requests');
    setCompletedJobs([]);
    setCompletedJobsError('');
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

  function resetAuthForm(role: Role) {
    authFormVersion.current += 1;
    setAuthForm(createEmptyAuthForm(role));
    setRegistrationImage(null);
    setDetectingCity(false);
  }

  function chooseRole(role: Role) {
    setSelectedRole(role);
    resetAuthForm(role);
    setAuthMode('login');
    setError('');
    setSuccess('');
  }

  function showRolePicker() {
    resetAuthForm('CUSTOMER');
    setSelectedRole(null);
    setAuthMode('login');
    setError('');
    setSuccess('');
  }

  function changeAuthMode(mode: AuthMode) {
    Keyboard.dismiss();
    resetAuthForm(selectedRole || 'CUSTOMER');
    setAuthMode(mode);
    setError('');
    setSuccess('');
    if (mode === 'register') {
      void loadCategories();
    }
  }

  function scrollAuthFieldIntoUpperHalf() {
    const scrollView = authScrollRef.current;
    const input = authInputRef.current;
    if (!scrollView || !input || Platform.OS === 'web') return;

    input.measureInWindow((_inputX, inputY) => {
      scrollView.measureInWindow((_scrollX, scrollTop, _scrollWidth, scrollHeight) => {
        const targetTop = scrollTop + scrollHeight * 0.3;
        const scrollDistance = inputY - targetTop;
        if (scrollDistance > 0) {
          scrollView.scrollTo({
            y: Math.max(0, authScrollOffset.current + scrollDistance),
            animated: true,
          });
        }
      });
    });
  }

  function scheduleAuthFieldScroll(delay: number) {
    if (authScrollTimer.current) clearTimeout(authScrollTimer.current);
    authScrollTimer.current = setTimeout(scrollAuthFieldIntoUpperHalf, delay);
  }

  function focusAuthField(input: TextInputInstance) {
    authInputRef.current = input;
    scheduleAuthFieldScroll(350);
  }

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const keyboardShown = Keyboard.addListener('keyboardDidShow', () => {
      scheduleAuthFieldScroll(100);
    });
    const keyboardHidden = Keyboard.addListener('keyboardDidHide', () => {
      if (authScrollTimer.current) clearTimeout(authScrollTimer.current);
    });

    return () => {
      keyboardShown.remove();
      keyboardHidden.remove();
      if (authScrollTimer.current) clearTimeout(authScrollTimer.current);
    };
  }, []);

  return (
    <SafeAreaProvider style={styles.safeScreen}>
      <SafeAreaView style={styles.safeScreen}>
        <StatusBar style="dark" />
        {Platform.OS === 'android' && <NavigationBar hidden />}
        {restoringSession ? (
        <View style={styles.centered}><ActivityIndicator color={colors.teal} /></View>
      ) : !token ? selectedRole === null ? (
        <ScrollView contentContainerStyle={styles.landingPage}>
          <View style={styles.landingIntro}>
            <View pointerEvents="none" style={styles.landingGradient}>
              {Array.from({ length: 80 }, (_, i) => (
                <View key={i} style={{ position: 'absolute', top: 0, bottom: 0, left: i * 8, right: 0, backgroundColor: blendBlue(i / 79) }} />
              ))}
            </View>
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
        <KeyboardAvoidingView
          style={styles.authContent}
          behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
        >
          <ScrollView
            ref={authScrollRef}
            contentContainerStyle={[
              styles.authPage,
              authMode === 'login' ? styles.authLoginPage : styles.authRegistrationPage,
            ]}
            onScroll={(event) => {
              authScrollOffset.current = event.nativeEvent.contentOffset.y;
            }}
            scrollEventThrottle={16}
            keyboardShouldPersistTaps="always"
            scrollEnabled
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
                {authMode === 'register' && <>
                  <Field label="Ime" required value={authForm.firstName} onChangeText={(firstName) => setAuthForm((current) => ({ ...current, firstName }))} onFieldFocus={focusAuthField} autoComplete="off" textContentType="none" autoCapitalize="words" maxLength={120} />
                  <Field label="Prezime" required value={authForm.lastName} onChangeText={(lastName) => setAuthForm((current) => ({ ...current, lastName }))} onFieldFocus={focusAuthField} autoComplete="off" textContentType="none" autoCapitalize="words" maxLength={120} />
                  {authForm.firstName.trim().length + authForm.lastName.trim().length + 1 > 120 && <Text style={styles.categoryError}>Ime i prezime zajedno mogu imati najviše 120 znakova.</Text>}
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Profilna slika (opciono)</Text>
                    <View style={styles.imageActions}>
                      <Pressable accessibilityRole="button" disabled={loading} onPress={() => void chooseRegistrationImage()} style={styles.imageActionButton}>
                        <Text style={styles.imageActionText}>{registrationImage ? 'Promeni sliku' : 'Izaberi sliku'}</Text>
                      </Pressable>
                      {registrationImage && <Image source={{ uri: registrationImage.uri }} style={styles.profileImagePreview} />}
                    </View>
                  </View>
                </>}
                <Field label="Email" required value={authForm.email} onChangeText={(email) => setAuthForm((current) => ({ ...current, email }))} onFieldFocus={focusAuthField} autoComplete="off" textContentType="none" keyboardType="email-address" autoCapitalize="none" />
                <Field label="Lozinka" required value={authForm.password} onChangeText={(password) => setAuthForm((current) => ({ ...current, password }))} onFieldFocus={focusAuthField} autoComplete="off" textContentType="none" secureTextEntry />
                {authMode === 'register' && <>
                  <Field label="Telefon" value={authForm.phone} onChangeText={(phone) => setAuthForm((current) => ({ ...current, phone }))} onFieldFocus={focusAuthField} autoComplete="off" textContentType="none" keyboardType="phone-pad" />
                  <View style={styles.field}>
                    <Field label="Grad" required value={authForm.city} onChangeText={(city) => setAuthForm((current) => ({ ...current, city }))} onFieldFocus={focusAuthField} autoComplete="off" textContentType="none" autoCapitalize="words" maxLength={120} />
                    <Pressable accessibilityRole="button" disabled={detectingCity} onPress={() => void detectRegistrationCity()} style={styles.imageActionButton}>
                      <Text style={styles.imageActionText}>{detectingCity ? 'Prepoznajem grad...' : 'Prepoznaj grad po lokaciji'}</Text>
                    </Pressable>
                  </View>
                  {selectedRole === 'CRAFTSMAN' && (
                    <View style={styles.registrationCategorySection}>
                      <Text style={styles.fieldLabel}>Koje usluge nudite? <Text style={styles.requiredMarker}>*</Text></Text>
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
                    !authForm.firstName.trim()
                    || !authForm.lastName.trim()
                    || authForm.firstName.trim().length + authForm.lastName.trim().length + 1 > 120
                    || !authForm.city.trim()
                    || (selectedRole === 'CRAFTSMAN' && authForm.categoryIds.length === 0)
                  ))}
                  label={loading ? 'Sačekajte...' : authMode === 'login' ? 'Prijavi se' : 'Napravi nalog'}
                  onPress={() => void handleAuthSubmit()}
                  variant={selectedRole}
                />
                <Feedback error={error} success={success} />
              </View>
            </View>
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
            refreshControl={activeTab === 'requests' ? <RefreshControl refreshing={refreshing} onRefresh={() => void refreshRequests()} tintColor={colors.teal} /> : undefined}
          >
            <Pressable onPress={() => void logout()} style={styles.switchAccountButton} accessibilityRole="button">
              <Text style={styles.switchAccountText}>Promeni nalog</Text>
            </Pressable>
            <View style={[styles.dashboardIntro, userRole === 'CRAFTSMAN' ? styles.dashboardIntroCraftsman : styles.dashboardIntroCustomer]}>
              <Text style={[styles.eyebrow, userRole === 'CRAFTSMAN' ? styles.roleEyebrowCraftsman : styles.roleEyebrowCustomer]}>KUĆNI MAJSTOR / MOJ NALOG</Text>
              <Text style={[styles.dashboardTitle, userRole === 'CRAFTSMAN' && styles.dashboardTitleCraftsman]}>
                {activeTab === 'profile' ? 'Tvoj profil' : activeTab === 'ratings' ? 'Tvoje ocene' : userRole === 'CRAFTSMAN' ? 'Dostupni zahtevi' : 'Šta treba popraviti?'}
              </Text>
            </View>
            <View style={styles.segment} accessibilityRole="tablist" accessibilityLabel="Navigacija naloga">
              <SegmentButton active={activeTab === 'requests'} label="Zahtevi" onPress={() => setActiveTab('requests')} />
              <SegmentButton active={activeTab === 'profile'} label="Profil" onPress={() => setActiveTab('profile')} />
              <SegmentButton active={activeTab === 'ratings'} label="Ocene" onPress={() => setActiveTab('ratings')} />
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
                {userRole === 'CUSTOMER' && receivedOffers.length > 0 && (
                  <PrimaryButton
                    label={`Ponude majstora (${receivedOffers.length})`}
                    onPress={() => { setFocusedOffer(null); setOffersDialogVisible(true); }}
                    variant="CUSTOMER"
                  />
                )}
                {userRole === 'CUSTOMER' && <View style={styles.reviewPanel}>
                  <Text style={styles.sectionTitle}>Ponude majstora</Text>
                  {receivedOffers.length === 0 ? (
                    <Text style={styles.muted}>Još nema ponuda za ovaj posao.</Text>
                  ) : receivedOffers.map((offer) => (
                    <View key={offer.id} style={styles.completedJobCard}>
                      <Text style={styles.fieldLabel}>{offer.craftsmanCompanyName || 'Majstor'}</Text>
                      <Text style={styles.offerPriceText}>{offer.agreeOnSite ? 'Dogovor na licu mesta' : `${offer.price?.toLocaleString('sr-RS')} RSD`}</Text>
                      {offer.message && <Text style={styles.requestDescription}>{offer.message}</Text>}
                    </View>
                  ))}
                </View>}
                {(selectedRequest.status === 'ACCEPTED' || selectedRequest.status === 'IN_PROGRESS') && (
                  <View style={styles.reviewPanel}>
                    <Text style={styles.sectionTitle}>Završi posao i oceni majstora</Text>
                    <Text style={styles.muted}>Tvoju ocenu i komentar mogu da vide svi prijavljeni korisnici i majstori.</Text>
                    <View style={styles.ratingStars} accessibilityRole="radiogroup" accessibilityLabel="Ocena majstora">
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <Pressable
                          key={rating}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: reviewRating === rating }}
                          accessibilityLabel={`${rating} od 5 zvezdica`}
                          onPress={() => setReviewRating(rating)}
                          style={styles.ratingStarButton}
                        >
                          <Text style={[styles.ratingStar, rating <= reviewRating && styles.ratingStarSelected]}>★</Text>
                        </Pressable>
                      ))}
                    </View>
                    <TextInput
                      value={reviewComment}
                      onChangeText={setReviewComment}
                      placeholder="Komentar (opciono)"
                      placeholderTextColor={colors.muted}
                      multiline
                      maxLength={1000}
                      style={[styles.input, styles.reviewCommentInput]}
                    />
                    <PrimaryButton
                      disabled={loading}
                      label={loading ? 'Čuvam ocenu...' : 'Završi posao'}
                      onPress={() => void completeAndReview()}
                    />
                  </View>
                )}
                {selectedRequest.status === 'COMPLETED' && (
                  <View style={styles.reviewPanel}>
                    <Text style={styles.sectionTitle}>Ocena za majstora</Text>
                    {selectedReview ? (
                      <>
                        <Text style={styles.reviewStars}>{'★'.repeat(selectedReview.rating)}{'☆'.repeat(5 - selectedReview.rating)}</Text>
                        <Text style={styles.muted}>{selectedReview.comment || 'Komentar nije ostavljen.'}</Text>
                      </>
                    ) : <Text style={styles.muted}>Posao je završen.</Text>}
                  </View>
                )}
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Kategorija usluge</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded: isDetailCategoryOpen }}
                    disabled={selectedRequest.status === 'COMPLETED'}
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
                    <AuthenticatedImage imageUrl={selectedRequest.imageUrl} token={token} />
                  ) : (
                    <Text style={styles.muted}>Slika nije dodata.</Text>
                  )}
                  <View style={styles.imageActions}>
                    <Pressable disabled={loading || selectedRequest.status === 'COMPLETED'} onPress={() => void chooseImage('camera')} style={styles.imageActionButton}>
                      <Text style={styles.imageActionText}>Fotografiši</Text>
                    </Pressable>
                    <Pressable disabled={loading || selectedRequest.status === 'COMPLETED'} onPress={() => void chooseImage('library')} style={styles.imageActionButton}>
                      <Text style={styles.imageActionText}>Izaberi iz telefona</Text>
                    </Pressable>
                  </View>
                </View>
                <Field
                  label="Opis problema"
                  value={detailForm.description}
                  onChangeText={(description) => setDetailForm((current) => ({ ...current, description }))}
                  editable={selectedRequest.status !== 'COMPLETED'}
                  multiline
                  numberOfLines={4}
                />
                <PrimaryButton
                  disabled={loading || selectedRequest.status === 'COMPLETED' || !detailForm.categoryId || !detailForm.description.trim()}
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
                <Text style={styles.sectionTitle}>Ocene korisnika</Text>
                <PublicReviews endpoint={`/customers/${selectedJob.customerId}/reviews`} />
                <Text style={styles.fieldLabel}>Ulica</Text>
                <RequestAddress latitude={selectedJob.latitude} longitude={selectedJob.longitude} />
                <Text style={styles.fieldLabel}>Slika problema</Text>
                {selectedJob.imageUrl
                  ? <AuthenticatedImage imageUrl={selectedJob.imageUrl} token={token} />
                  : <Text style={styles.muted}>Slika nije dodata.</Text>}
                <Text style={styles.fieldLabel}>Opis problema</Text>
                <Text style={styles.requestDescription}>{selectedJob.description}</Text>
                <Text style={styles.fieldLabel}>Mapa lokacije</Text>
                <RequestMap latitude={selectedJob.latitude} longitude={selectedJob.longitude} />
                {(selectedJob.status === 'NEW' || selectedJob.status === 'WAITING_FOR_OFFERS') && (
                  selectedJob.hasOffered ? <OfferSentNotice /> : (
                    <PrimaryButton label="Konkuriši" onPress={() => void openOfferForm(selectedJob.id)} variant="CRAFTSMAN" />
                  )
                )}
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
                    onOffer={userRole === 'CRAFTSMAN' && !request.hasOffered && (request.status === 'NEW' || request.status === 'WAITING_FOR_OFFERS')
                      ? () => void openOfferForm(request.id)
                      : undefined}
                    offerSent={userRole === 'CRAFTSMAN' && Boolean(request.hasOffered) && (request.status === 'NEW' || request.status === 'WAITING_FOR_OFFERS')}
                    onReview={canSubmitRequest ? () => void openRequest(request.id) : undefined}
                    onDelete={canSubmitRequest && request.status !== 'COMPLETED' ? () => confirmDeleteRequest(request.id) : undefined}
                    deleteDisabled={loading}
                  />
                ))}
              </>
            ) : activeTab === 'ratings' && userRole === 'CUSTOMER' ? (
              <View style={styles.panel}>
                <Text style={styles.sectionTitle}>Moje ocene</Text>
                <PublicReviews endpoint="/customers/profile/reviews" />
              </View>
            ) : activeTab === 'ratings' && userRole === 'CRAFTSMAN' ? (
              <View style={styles.panel}>
                <Text style={styles.sectionTitle}>Završeni poslovi i ocene</Text>
                {loadingCompletedJobs ? (
                  <ActivityIndicator color={colors.teal} />
                ) : completedJobsError ? (
                  <Text accessibilityRole="alert" style={styles.categoryError}>{completedJobsError}</Text>
                ) : completedJobs.length === 0 ? (
                  <Text style={styles.muted}>Još nema završenih i ocenjenih poslova.</Text>
                ) : (
                  <>
                    <Text style={styles.reviewStars}>
                      ★ {(
                        completedJobs.reduce((sum, job) => sum + job.rating, 0) / completedJobs.length
                      ).toFixed(1)} · {completedJobs.length} {getRatingCountLabel(completedJobs.length)}
                    </Text>
                    {completedJobs.map((job) => (
                      <View key={job.requestId} style={styles.completedJobCard}>
                        <Text style={styles.fieldLabel}>{job.categoryName}</Text>
                        <Text style={styles.muted}>{new Date(job.completedAt).toLocaleDateString('sr-RS')}</Text>
                        <Text style={styles.requestDescription}>{job.description}</Text>
                        <Text style={styles.reviewStars}>{'★'.repeat(job.rating)}{'☆'.repeat(5 - job.rating)}</Text>
                        <Text style={styles.muted}>{job.comment || 'Korisnik nije ostavio komentar.'}</Text>
                        <CustomerReviewForm job={job} onSaved={(review) => setCompletedJobs((current) => current.map((item) => item.requestId === job.requestId ? { ...item, customerReview: review } : item))} />
                      </View>
                    ))}
                  </>
                )}
              </View>
            ) : (
              <View style={styles.panel}>
                <Text style={styles.eyebrow}>PODACI NALOGA</Text>
                <View style={styles.profileHeader}>
                  <View style={styles.profileAvatar}>
                    {user?.profileImageUrl ? (
                      <AuthenticatedImage imageUrl={user.profileImageUrl} token={token} style={styles.profileAvatarImage} avatar />
                    ) : (
                      <Ionicons name="person-circle-outline" size={58} color={colors.teal} />
                    )}
                  </View>
                  <View style={styles.profileIdentity}>
                    <Text style={styles.profileName}>{user?.displayName || 'Korisnik'}</Text>
                    <Text style={styles.profileEmail}>{user?.email}</Text>
                  </View>
                </View>
                <Text style={styles.fieldLabel}>Tip naloga</Text>
                <Text style={styles.profileRole}>{userRole === 'CUSTOMER' ? 'Korisnik' : 'Majstor'}</Text>
                <Text style={styles.fieldLabel}>Grad</Text>
                <Text style={styles.profileRole}>{user?.city || 'Nije unet'}</Text>
                {userRole === 'CRAFTSMAN' && <>
                  <Text style={styles.fieldLabel}>Kategorije usluga</Text>
                  <Text style={styles.profileRole}>{craftsmanCategories.length > 0 ? craftsmanCategories.join(', ') : 'Nije izabrana'}</Text>
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
                {userRole === 'CUSTOMER' && <>
                  <View style={styles.divider} />
                  <Text style={styles.sectionTitle}>Obaveštenja o ponudama</Text>
                  <Text style={styles.muted}>{isExpoGo()
                    ? 'Push obaveštenja zahtevaju instaliranu FixHome aplikaciju, ne Expo Go.'
                    : pushEnabled
                      ? 'Obaveštenja će stići kada majstor konkuriše za vaš posao.'
                      : 'Uključite obaveštenja da biste saznali kada majstor konkuriše za vaš posao.'}</Text>
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
        <Modal
          visible={offerModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setOfferModalVisible(false)}
          statusBarTranslucent
        >
          <KeyboardAvoidingView
            style={styles.offerModalBackdrop}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView contentContainerStyle={styles.offerModalScroll} keyboardShouldPersistTaps="handled">
              <View style={styles.offerModal}>
                <Text style={styles.sectionTitle}>Konkuriši za posao</Text>
                <Text style={styles.muted}>{selectedJob?.categoryName}</Text>
                <Field
                  label="Poruka (opciono)"
                  value={offerMessage}
                  onChangeText={setOfferMessage}
                  placeholder="Predstavi se i opiši kako možeš da pomogneš"
                  multiline
                  maxLength={1000}
                />
                <Field
                  label="Iznos u RSD (opciono)"
                  value={offerPrice}
                  onChangeText={setOfferPrice}
                  placeholder="Unesite cenu"
                  keyboardType="decimal-pad"
                  editable={!offerAgreeOnSite}
                />
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: offerAgreeOnSite }}
                  onPress={() => {
                    setOfferAgreeOnSite((checked) => !checked);
                    if (!offerAgreeOnSite) setOfferPrice('');
                  }}
                  style={styles.registrationCategory}
                >
                  <View style={[styles.checkbox, offerAgreeOnSite && styles.checkboxChecked]}>
                    {offerAgreeOnSite && <Text style={styles.checkboxCheck}>✓</Text>}
                  </View>
                  <Text style={styles.registrationCategoryText}>Ako ne unesem iznos, dogovorićemo cenu na licu mesta.</Text>
                </Pressable>
                <Feedback error={error} success="" />
                <View style={styles.offerModalActions}>
                  <SecondaryButton disabled={loading} label="Otkaži" onPress={() => setOfferModalVisible(false)} />
                  <PrimaryButton disabled={loading} label={loading ? 'Šaljem...' : 'Pošalji ponudu'} onPress={() => void submitOffer()} variant="CRAFTSMAN" />
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </Modal>
        <Modal
          visible={offersDialogVisible}
          transparent
          animationType="fade"
          onRequestClose={() => { if (!loading) { setOffersDialogVisible(false); setFocusedOffer(null); } }}
          statusBarTranslucent
        >
          <View style={styles.offerModalBackdrop}>
            <ScrollView contentContainerStyle={styles.offerModalScroll} keyboardShouldPersistTaps="handled">
              <View style={styles.offerModal}>
                <Pressable
                  accessibilityRole="button"
                  disabled={loading}
                  onPress={() => focusedOffer ? setFocusedOffer(null) : setOffersDialogVisible(false)}
                  style={styles.backButton}
                >
                  <Text style={styles.backButtonText}>‹ {focusedOffer ? 'Nazad na ponude' : 'Zatvori'}</Text>
                </Pressable>
                {focusedOffer ? <>
                  <Text style={styles.sectionTitle}>{focusedOffer.craftsmanCompanyName || 'Ponuda majstora'}</Text>
                  {userRole === 'CUSTOMER' && <>
                    <Text style={styles.fieldLabel}>Ocene majstora</Text>
                    <PublicReviews endpoint={`/craftsmen/${focusedOffer.craftsmanId}/reviews`} />
                  </>}
                  <OfferStatusLabel status={focusedOffer.status} />
                  <Text style={styles.offerPriceText}>{focusedOffer.agreeOnSite ? 'Dogovor na licu mesta' : `${focusedOffer.price?.toLocaleString('sr-RS')} RSD`}</Text>
                  {focusedOffer.message && <Text style={styles.requestDescription}>{focusedOffer.message}</Text>}
                  {focusedOffer.status === 'ACCEPTED' ? (
                    <View style={styles.completedJobCard}>
                      <Text style={styles.fieldLabel}>{userRole === 'CUSTOMER' ? 'Kontakt majstora' : 'Kontakt korisnika'}</Text>
                      <Text style={styles.requestDescription}>{userRole === 'CUSTOMER'
                        ? focusedOffer.craftsmanEmail || 'Email nije dostupan'
                        : focusedOffer.customerEmail || 'Email nije dostupan'}</Text>
                      <Text style={styles.requestDescription}>{userRole === 'CUSTOMER'
                        ? focusedOffer.craftsmanPhone || 'Telefon nije dostupan'
                        : focusedOffer.customerPhone || 'Telefon nije dostupan'}</Text>
                    </View>
                  ) : focusedOffer.status === 'PENDING' && userRole === 'CUSTOMER' ? (
                    <PrimaryButton disabled={loading} label={loading ? 'Prihvatam...' : 'Prihvati ponudu'} onPress={() => void acceptOffer()} variant="CUSTOMER" />
                  ) : <Text style={styles.muted}>Ova ponuda više nije aktivna.</Text>}
                </> : <>
                  <Text style={styles.sectionTitle}>Ponude majstora</Text>
                  {receivedOffers.map((offer) => (
                    <Pressable key={offer.id} onPress={() => setFocusedOffer(offer)} style={styles.receivedOfferButton}>
                      <Text style={styles.fieldLabel}>{offer.craftsmanCompanyName || 'Majstor'}</Text>
                      <Text style={styles.offerPriceText}>{offer.agreeOnSite ? 'Dogovor na licu mesta' : `${offer.price?.toLocaleString('sr-RS')} RSD`}</Text>
                      <OfferStatusLabel status={offer.status} />
                    </Pressable>
                  ))}
                </>}
                <Feedback error={error} success="" />
              </View>
            </ScrollView>
          </View>
        </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
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
          <CraftsmanToolsMark />
        ) : (
          <CustomerHouseMark />
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

function CraftsmanToolsMark() {
  return <Ionicons name="construct-outline" size={36} color={colors.tealDark} accessibilityLabel="Alati za majstora" />;
}

function CustomerHouseMark() {
  return (
    <View style={styles.houseDamageMark} accessibilityLabel="Kuća sa oštećenjem">
      <FontAwesome5 name="house-damage" size={34} color={colors.tealDark} />
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

function Field({
  label,
  required = false,
  onFieldFocus,
  ...props
}: TextInputProps & { label: string; required?: boolean; onFieldFocus?: (input: TextInputInstance) => void }) {
  const inputRef = useRef<TextInputInstance>(null);

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}{required && <Text style={styles.requiredMarker}> *</Text>}</Text>
      <TextInput
        {...props}
        ref={inputRef}
        onFocus={() => {
          if (inputRef.current) onFieldFocus?.(inputRef.current);
        }}
        placeholderTextColor={colors.muted}
        style={[styles.input, props.multiline && styles.multilineInput]}
      />
    </View>
  );
}

function PublicReviews({ endpoint }: { endpoint: string }) {
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    void apiFetch<PublicReview[]>(endpoint, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setReviews(result); })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setError(getErrorMessage(cause)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [endpoint]);
  if (loading) return <ActivityIndicator color={colors.teal} />;
  if (error) return <Text accessibilityRole="alert" style={styles.categoryError}>{error}</Text>;
  if (reviews.length === 0) return <Text style={styles.muted}>Još nema ocena.</Text>;
  return <View style={styles.form}>
    <Text style={styles.reviewStars}>★ {averageRating(reviews)} · {reviews.length} {getRatingCountLabel(reviews.length)}</Text>
    {reviews.map((review, index) => <View style={styles.completedJobCard} key={`${review.createdAt}-${index}`}>
      <Text style={styles.reviewStars}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</Text>
      <Text style={styles.muted}>{new Date(review.createdAt).toLocaleDateString('sr-RS')}</Text>
      <Text style={styles.muted}>{review.comment || 'Komentar nije ostavljen.'}</Text>
    </View>)}
  </View>;
}

function CustomerReviewForm({ job, onSaved }: { job: CompletedJob; onSaved: (review: CustomerReview) => void }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function submit() {
    setLoading(true);
    setError('');
    try {
      onSaved(await apiFetch<CustomerReview>(`/service-requests/${job.requestId}/customer-review`, {
        method: 'POST', body: JSON.stringify({ rating, comment: comment.trim() || null }),
      }));
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }
  if (job.customerReview) return <Text style={styles.muted}>Vaša ocena korisnika: {'★'.repeat(job.customerReview.rating)}{'☆'.repeat(5 - job.customerReview.rating)} {job.customerReview.comment}</Text>;
  return <View style={styles.form}>
    <Text style={styles.fieldLabel}>Ocenite korisnika</Text>
    <View style={styles.ratingStars} accessibilityRole="radiogroup" accessibilityLabel="Ocena korisnika">
      {[1, 2, 3, 4, 5].map((value) => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ selected: rating === value }} accessibilityLabel={`${value} od 5 zvezdica`} onPress={() => setRating(value)} style={styles.ratingStarButton}>
        <Text style={[styles.ratingStar, value <= rating && styles.ratingStarSelected]}>★</Text>
      </Pressable>)}
    </View>
    <Field label="Komentar (vidljiv svim prijavljenim korisnicima)" value={comment} onChangeText={setComment} maxLength={1000} multiline />
    <Feedback error={error} success="" />
    <PrimaryButton label={loading ? 'Sačekajte...' : 'Oceni korisnika'} disabled={loading} onPress={() => void submit()} />
  </View>;
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

function OfferStatusLabel({ status }: { status: string }) {
  const labels: Record<string, string> = {
    PENDING: 'Čeka prihvatanje',
    ACCEPTED: 'Prihvaćena',
    REJECTED: 'Nije prihvaćena',
  };
  const toneStyle = status === 'ACCEPTED'
    ? styles.statusBadgeOpen
    : status === 'PENDING'
      ? styles.statusBadgeInProgress
      : status === 'REJECTED'
        ? styles.statusBadgeCancelled
        : styles.statusBadgeUnknown;

  return <Text style={[styles.statusBadge, toneStyle]}>{labels[status] ?? status}</Text>;
}

function RequestCard({
  request,
  token,
  showCity,
  onViewDetails,
  onOffer,
  offerSent,
  onReview,
  onDelete,
  deleteDisabled,
}: {
  request: ServiceRequest;
  token: string;
  showCity: boolean;
  onViewDetails?: () => void;
  onOffer?: () => void;
  offerSent?: boolean;
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
        <AuthenticatedImage imageUrl={request.imageUrl} token={token} />
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
      {onOffer && (
        <PrimaryButton label="Konkuriši" onPress={onOffer} disabled={deleteDisabled} variant="CRAFTSMAN" />
      )}
      {offerSent && <OfferSentNotice />}
    </View>
  );
}

function OfferSentNotice() {
  return (
    <View style={styles.offerSentNotice}>
      <Text style={styles.offerSentTitle}>Već si konkurisao za ovaj posao</Text>
      <Text style={styles.muted}>Ponuda je na čekanju dok klijent ne odgovori.</Text>
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

function AuthenticatedImage({ imageUrl, token, style = styles.requestImage, avatar = false }: { imageUrl: string; token: string; style?: ImageStyle; avatar?: boolean }) {
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

  if (avatar && (failed || !localUri)) {
    return <Ionicons name="person-circle-outline" size={58} color={colors.teal} />;
  }
  if (failed) return <Text style={styles.imageError}>Slika trenutno nije dostupna.</Text>;
  if (!localUri) return <Text style={styles.muted}>Učitavanje slike...</Text>;
  return <Image source={{ uri: localUri }} style={style} accessibilityLabel={avatar ? 'Slika profila' : undefined} />;
}

function Feedback({ error, success }: { error: string; success: string }) {
  const message = error || success;
  if (!message) return null;
  return <Text accessibilityRole="alert" style={[styles.feedback, error ? styles.feedbackError : styles.feedbackSuccess]}>{message}</Text>;
}

const blueStops: [number, number, number][] = [[59, 130, 246], [11, 42, 91], [37, 99, 235]];

function blendBlue(t: number) {
  const scaled = t * (blueStops.length - 1);
  const index = Math.min(Math.floor(scaled), blueStops.length - 2);
  const local = scaled - index;
  const [a, b] = [blueStops[index], blueStops[index + 1]];
  const mix = a.map((value, i) => Math.round(value + (b[i] - value) * local));
  return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`;
}

const colors = {
  background: designTokens.colors.background,
  white: designTokens.colors.surface,
  ink: designTokens.colors.ink,
  muted: designTokens.colors.muted,
  line: designTokens.colors.border,
  teal: designTokens.colors.primary,
  tealDark: designTokens.colors.primary,
  tealLight: designTokens.colors.primarySoft,
  coral: designTokens.colors.danger,
  redLight: designTokens.colors.dangerSoft,
  greenLight: designTokens.colors.successSoft,
  gold: designTokens.colors.accent,
  goldDark: '#1E4FB5',
};

const styles = StyleSheet.create({
  safeScreen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  authContent: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  landingPage: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 24, paddingBottom: 38, justifyContent: 'center' },
  landingIntro: { marginTop: 28, marginBottom: 22, gap: 10, padding: 26, overflow: 'hidden', borderRadius: 32, backgroundColor: '#0B2A5B' },
  landingGradient: { position: 'absolute', top: -300, left: -150, width: 640, height: 800, transform: [{ rotate: '35deg' }] },
  landingBrand: { color: colors.gold, fontSize: 12, fontWeight: '800', letterSpacing: 2.2 },
  landingTitle: { color: colors.white, fontSize: 27, lineHeight: 34, fontWeight: '800', maxWidth: 350 },
  landingAccent: { width: 42, height: 4, marginTop: 5, borderRadius: 2, backgroundColor: colors.gold },
  rolePrompt: { marginBottom: 12, color: colors.ink, fontSize: 16, fontWeight: '800' },
  roleList: { gap: 13 },
  roleCard: { minHeight: 112, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, backgroundColor: colors.white, borderRadius: designTokens.radius.card, borderWidth: 1, borderColor: colors.line, shadowColor: '#0B2A5B', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.06, shadowRadius: 20, elevation: 2 },
  roleCardCraftsman: { backgroundColor: colors.ink, borderColor: colors.ink },
  roleCardPressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  roleLogo: { width: 52, height: 52, borderRadius: 16, backgroundColor: designTokens.colors.customerSoft, alignItems: 'center', justifyContent: 'center' },
  roleLogoCraftsman: { backgroundColor: '#CFE1FB' },
  roleCopy: { flex: 1, gap: 5 },
  roleCaption: { color: colors.goldDark, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  roleCaptionCraftsman: { color: '#8FB8F5' },
  roleTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  roleTitleCraftsman: { color: colors.white },
  roleSubtitle: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  roleSubtitleCraftsman: { color: '#C5DBF8' },
  roleArrow: { color: colors.goldDark, fontSize: 30, fontWeight: '500', paddingLeft: 2 },
  roleArrowCraftsman: { color: colors.white },
  houseDamageMark: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  landingFooter: { marginTop: 24, textAlign: 'center', color: colors.muted, fontSize: 12, fontWeight: '600' },
  authPage: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 26, paddingBottom: 140, justifyContent: 'center' },
  authLoginPage: { paddingTop: 12, paddingBottom: 140 },
  authRegistrationPage: { paddingBottom: 320 },
  authBottomNav: { flexDirection: 'row', gap: 8, marginHorizontal: 18, marginTop: 8, marginBottom: 10, padding: 7,   borderWidth: 1, borderColor: '#C5DBF8', borderRadius: 26, backgroundColor: '#E6F0FD' },
    authBottomNavCustomer: { borderColor: '#C5DBF8', backgroundColor: '#EFF5FE' },
    authBottomNavCraftsman: { borderColor: '#C5DBF8', backgroundColor: '#E6F0FD' },
  authNavItem: { flex: 1, minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',   gap: 8, borderWidth: 1, borderColor: 'transparent', borderRadius: 20 },
  authNavItemActive: {},
    authNavItemActiveCustomer: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
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
  authBackButtonCustomer: { borderColor: '#C5DBF8', backgroundColor: '#EFF5FE' },
  authBackButtonCraftsman: { borderColor: colors.tealDark, backgroundColor: colors.tealDark },
  authBackButtonText: { color: colors.goldDark, fontSize: 15, fontWeight: '800' },
  authBackButtonTextCraftsman: { color: colors.white },
  registrationCategory: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 10,   borderWidth: 1, borderColor: colors.line, borderRadius: 14 },
  registrationCategoryText: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  checkbox: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.muted, borderRadius: 7 },
  checkboxChecked: { backgroundColor: colors.teal, borderColor: colors.teal },
  checkboxCheck: { color: colors.white, fontSize: 14, lineHeight: 18, fontWeight: '800' },
  dashboardPage: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 48, gap: 18 },
  switchAccountButton: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: colors.line, borderRadius: 18 },
  switchAccountText: { color: colors.tealDark, fontSize: 12, fontWeight: '700' },
  authIntro: { marginTop: 24, marginBottom: 24, gap: 10, padding: 18, borderRadius: 18, borderWidth: 1 },
  authIntroCustomer: { backgroundColor: '#EFF5FE', borderColor: '#C5DBF8' },
  authIntroCraftsman: { backgroundColor: colors.tealDark, borderColor: colors.tealDark },
  roleEyebrowCustomer: { color: colors.goldDark },
  roleEyebrowCraftsman: { color: colors.gold },
  eyebrow: { color: colors.coral, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  authTitle: { color: colors.ink, fontSize: 34, lineHeight: 39, fontWeight: '800', maxWidth: 340 },
  authTitleCraftsman: { color: colors.white },
  authDescriptionCraftsman: { color: '#C5DBF8' },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  offerSentNotice: { gap: 4, borderRadius: 12, padding: 12, backgroundColor: '#FEF3C7' },
  offerSentTitle: { color: '#92400E', fontSize: 14, fontWeight: '800' },
  panel: { backgroundColor: colors.white, borderRadius: designTokens.radius.card, borderWidth: 1, borderColor: colors.line, padding: 22, gap: 16, shadowColor: '#0B2A5B', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.06, shadowRadius: 20, elevation: 2 },
  authPanelCustomer: { borderColor: colors.line, backgroundColor: colors.white },
  authPanelCraftsman: { borderColor: colors.line },
  reviewPanel: { gap: 12, padding: 16, borderWidth: 1, borderColor: colors.line, borderRadius: 14, backgroundColor: colors.white },
  offerPriceText: { color: colors.tealDark, fontSize: 14, fontWeight: '800' },
  offerModalBackdrop: { flex: 1, justifyContent: 'center', paddingHorizontal: 18, backgroundColor: 'rgba(12, 28, 24, 0.62)' },
  offerModalScroll: { flexGrow: 1, justifyContent: 'center', paddingVertical: 20 },
  offerModal: { gap: 15, padding: 20, borderWidth: 1, borderColor: colors.line, borderRadius: 16, backgroundColor: colors.white },
  offerModalActions: { flexDirection: 'row', gap: 10 },
  receivedOfferButton: { gap: 8, padding: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.background },
  ratingStars: { flexDirection: 'row', gap: 8 },
  ratingStarButton: { paddingVertical: 2, paddingHorizontal: 3 },
  ratingStar: { color: '#C6D2E4', fontSize: 30 },
  ratingStarSelected: { color: '#F59E0B' },
  reviewStars: { color: '#D97706', fontSize: 18, fontWeight: '800' },
  reviewCommentInput: { minHeight: 82, textAlignVertical: 'top' },
  completedJobCard: { gap: 8, padding: 13, borderWidth: 1, borderColor: colors.line,   borderRadius: 16, backgroundColor: '#F6F8FC' },
    registrationCategorySection: { gap: 9, padding: 14, borderWidth: 1, borderColor: '#C5DBF8', borderRadius: 16, backgroundColor: '#EFF5FE' },
  categoryLoading: { alignItems: 'flex-start', gap: 10, paddingVertical: 8 },
  categoryError: { color: colors.coral, fontSize: 13, lineHeight: 19 },
  categorySelectionCount: { color: colors.tealDark, fontSize: 12, fontWeight: '800' },
  segment: { flexDirection: 'row', backgroundColor: '#EEF2F8', borderRadius: 16, padding: 4, gap: 4 },
  segmentButton: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingHorizontal: 8 },
  segmentButtonActive: { backgroundColor: colors.tealDark },
  segmentText: { color: colors.muted, fontSize: 14, fontWeight: '700' },
  segmentTextActive: { color: colors.white },
  form: { gap: 15 },
  field: { gap: 7, flex: 1 },
  fieldLabel: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  requiredMarker: { color: colors.coral },
  input: { minHeight: designTokens.controlHeight, borderColor: colors.line, borderWidth: 1, borderRadius: designTokens.radius.control, paddingHorizontal: 14, paddingVertical: 12, color: colors.ink, backgroundColor: colors.white, fontSize: 15 },
  multilineInput: { minHeight: 100, textAlignVertical: 'top' },
  primaryButton: { minHeight: designTokens.controlHeight, backgroundColor: colors.teal, borderRadius: designTokens.radius.control, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, marginTop: 3, shadowColor: '#1A5FD8', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.24, shadowRadius: 12, elevation: 3 },
  primaryButtonCustomer: { backgroundColor: colors.teal, shadowColor: colors.teal },
  primaryButtonCraftsman: { backgroundColor: colors.tealDark },
  primaryButtonDimmed: { opacity: 0.58 },
  primaryButtonText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  feedback: { alignSelf: 'stretch', flexShrink: 1,   borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 13, lineHeight: 19, fontWeight: '600' },
    feedbackError: { backgroundColor: colors.redLight, color: '#9F1239' },
    feedbackSuccess: { backgroundColor: colors.greenLight, color: '#166534' },
    dashboardIntro: { gap: 7, marginTop: 14, padding: 20, borderWidth: 1, borderRadius: 28 },
    dashboardIntroCustomer: { backgroundColor: '#EFF5FE', borderColor: '#C5DBF8' },
  dashboardIntroCraftsman: { backgroundColor: colors.tealDark, borderColor: colors.tealDark },
  dashboardTitle: { color: colors.ink, fontSize: 28, lineHeight: 34, fontWeight: '800' },
  dashboardTitleCraftsman: { color: colors.white },
  sectionTitle: { color: colors.ink, fontSize: 19, fontWeight: '800' },
  dropdownTrigger: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.line, borderRadius: 16, paddingHorizontal: 16, backgroundColor: '#F6F8FC' },
  dropdownText: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  dropdownPlaceholder: { color: colors.muted, fontWeight: '400' },
  dropdownArrow: { color: colors.tealDark, fontSize: 20, fontWeight: '700' },
  dropdownMenu: { borderWidth: 1, borderColor: colors.line, borderRadius: 16, backgroundColor: colors.white, overflow: 'hidden' },
  dropdownOption: { minHeight: 46, justifyContent: 'center', paddingHorizontal: 13, borderBottomWidth: 1, borderBottomColor: colors.line },
  imageActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  imageActionButton: { minHeight: designTokens.controlHeight, justifyContent: 'center', paddingHorizontal: 18, borderRadius: designTokens.radius.control, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  imageActionText: { color: colors.tealDark, fontSize: 14, fontWeight: '700' },
  profileImagePreview: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.background },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  profileAvatar: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: colors.tealLight },
  profileAvatarImage: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.background },
  profileIdentity: { flex: 1, gap: 3 },
  profileName: { color: colors.ink, fontSize: 19, lineHeight: 25, fontWeight: '800' },
  imagePreviewContainer: { gap: 8, alignItems: 'flex-start' },
  imagePreview: { width: '100%', height: 190, borderRadius: 18, backgroundColor: colors.background },
  removeImageButton: { paddingVertical: 6, paddingHorizontal: 10 },
  removeImageText: { color: colors.coral, fontSize: 13, fontWeight: '700' },
  listHeading: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 2 },
  count: { color: colors.tealDark, backgroundColor: colors.tealLight, overflow: 'hidden', borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3, fontSize: 12, fontWeight: '800' },
  emptyState: { paddingVertical: 26, paddingHorizontal: 18, alignItems: 'center', gap: 7, borderWidth: 1, borderColor: colors.line, borderStyle: 'dashed', borderRadius: 20 },
  emptyTitle: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  requestCard: { backgroundColor: colors.white, padding: 18, borderRadius: 22, borderColor: colors.line, borderWidth: 1, gap: 10, shadowColor: '#0B2A5B', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 2 },
  requestHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  requestCategory: { flex: 1, color: colors.ink, fontSize: 16, fontWeight: '800' },
  statusBadge: { overflow: 'hidden', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6, fontSize: 12, fontWeight: '800' },
  statusBadgeOpen: { color: '#166534', backgroundColor: '#DCFCE7' },
  statusBadgeInProgress: { color: '#92400E', backgroundColor: '#FEF3C7' },
  statusBadgeCompleted: { color: '#2F3F5C', backgroundColor: '#E0E8F3' },
  statusBadgeCancelled: { color: '#991B1B', backgroundColor: '#FEE2E2' },
  statusBadgeUnknown: { color: '#2F3F5C', backgroundColor: '#E0E8F3' },
  requestCity: { color: colors.muted, fontSize: 12, marginBottom: 6 },
  requestDescription: { color: colors.ink, fontSize: 14, lineHeight: 20 },
  requestImage: { width: '100%', height: 200, borderRadius: 18, backgroundColor: colors.background },
  mapContainer: { width: '100%', alignItems: 'center', gap: 6 },
  mapAttribution: { color: colors.muted, fontSize: 10, alignSelf: 'flex-end' },
  imageError: { color: colors.coral, fontSize: 13 },
  reviewRequestButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, borderWidth: 1, borderColor: colors.teal, paddingHorizontal: 14 },
  reviewRequestText: { color: colors.tealDark, fontSize: 13, fontWeight: '800' },
  deleteRequestButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, borderWidth: 1, borderColor: colors.coral, paddingHorizontal: 14 },
  deleteRequestText: { color: colors.coral, fontSize: 13, fontWeight: '800' },
  requestLocation: { color: colors.muted, fontSize: 12 },
  profileEmail: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  profileRole: { color: colors.tealDark, fontSize: 15, fontWeight: '700' },
  divider: { height: 1, backgroundColor: colors.line },
  logoutButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center',   borderWidth: 1, borderColor: colors.line, borderRadius: 22 },
  logoutText: { color: colors.coral, fontSize: 14, fontWeight: '800' },
});