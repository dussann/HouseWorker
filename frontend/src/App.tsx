import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import './App.css';
import { apiFetch, resolveApiUrl } from './api.web';
import { createEmptyAuthForm, type AuthForm, type Role } from './authForm';
import { averageRating, type PublicReview, type CustomerReview } from './reviews';
import { getRatingCountLabel, getRequestStatusPresentation } from './requestStatus';

type AuthMode = 'login' | 'register';
type User = { email: string; displayName?: string; profileImageUrl?: string | null; role: string; city?: string };
type AuthResponse = {
  accessToken?: string;
  token?: string;
  email: string;
  displayName?: string;
  profileImageUrl?: string | null;
  role?: string;
  city?: string;
};
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
  imageUrl: string;
};

type InputChange = ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>;

const emptyForm: RequestForm = {
  categoryId: '',
  description: '',
  imageUrl: '',
};

function getStoredUser(): User | null {
  const storedUser = localStorage.getItem('fixhome_user');
  return storedUser ? (JSON.parse(storedUser) as User) : null;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Request failed';
}

function getBrowserLocation(): Promise<GeolocationCoordinates> {
  if (!navigator.geolocation) {
    return Promise.reject(new Error('Pregledač ne podržava pristup lokaciji.'));
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position.coords),
      (locationError) => reject(new Error(
        locationError.code === locationError.PERMISSION_DENIED
          ? 'Dozvolite pristup lokaciji da biste poslali zahtev.'
          : 'Lokaciju nije moguće pribaviti. Proverite da li su lokacijske usluge uključene.',
      )),
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 15_000 },
    );
  });
}

function App() {
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const authFormVersion = useRef(0);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [token, setToken] = useState<string>(localStorage.getItem('fixhome_token') || '');
  const [user, setUser] = useState<User | null>(getStoredUser);
  const [categories, setCategories] = useState<Category[]>([]);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
  const [receivedOffers, setReceivedOffers] = useState<Offer[]>([]);
  const [offersDialogOpen, setOffersDialogOpen] = useState(false);
  const [focusedOffer, setFocusedOffer] = useState<Offer | null>(null);
  const [selectedReview, setSelectedReview] = useState<ServiceReview | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [completedJobs, setCompletedJobs] = useState<CompletedJob[]>([]);
  const [loadingCompletedJobs, setLoadingCompletedJobs] = useState(false);
  const [completedJobsError, setCompletedJobsError] = useState('');
  const [craftsmanTab, setCraftsmanTab] = useState<'requests' | 'profile' | 'ratings'>('requests');
  const [customerRatingsOpen, setCustomerRatingsOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<CraftsmanRequestDetails | null>(null);
  const [editForm, setEditForm] = useState<RequestForm>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState<RequestForm>(emptyForm);
  const [authForm, setAuthForm] = useState<AuthForm>(() => createEmptyAuthForm('CUSTOMER'));
  const [registrationImage, setRegistrationImage] = useState<File | null>(null);
  const [citySearch, setCitySearch] = useState('');
  const [detectingCity, setDetectingCity] = useState(false);
  const [notificationCities, setNotificationCities] = useState<string[]>([]);
  const [craftsmanCategories, setCraftsmanCategories] = useState<string[]>([]);
  const [notificationCityInput, setNotificationCityInput] = useState('');
  const [savingNotificationCities, setSavingNotificationCities] = useState(false);
  const [offerModalOpen, setOfferModalOpen] = useState(false);
  const [offerMessage, setOfferMessage] = useState('');
  const [offerPrice, setOfferPrice] = useState('');
  const [offerAgreeOnSite, setOfferAgreeOnSite] = useState(false);

  const userRole = user?.role || 'CUSTOMER';
  const notificationCityOptions = Array.from(new Set([
    'Beograd',
    'Novi Sad',
    user?.city || '',
    ...notificationCities,
  ].map((city) => city.trim()).filter(Boolean)));

  useEffect(() => {
    void loadCategories();
  }, []);

  useEffect(() => {
    if (token) {
      void loadMyRequests();
    }
  }, [token, userRole]);

  useEffect(() => {
    if (token && userRole === 'CRAFTSMAN') {
      void apiFetch<{ cities: string[]; categories: string[] }>('/craftsmen/profile/notifications')
        .then((preferences) => {
          setNotificationCities(preferences.cities);
          setCraftsmanCategories(preferences.categories ?? []);
        })
        .catch((preferencesError: unknown) => setError(getErrorMessage(preferencesError)));
    }
  }, [token, userRole]);

  useEffect(() => {
    if (!token || userRole !== 'CRAFTSMAN' || craftsmanTab !== 'ratings') return;
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
  }, [token, userRole, craftsmanTab]);

  async function saveNotificationCities() {
    setSavingNotificationCities(true);
    setError('');
    setSuccess('');
    try {
      const preferences = await apiFetch<{ cities: string[] }>('/craftsmen/profile/notifications/cities', {
        method: 'PUT',
        body: JSON.stringify({ cities: notificationCities }),
      });
      setNotificationCities(preferences.cities);
      setSuccess('Gradovi za obaveštenja su sačuvani.');
    } catch (preferencesError) {
      setError(getErrorMessage(preferencesError));
    } finally {
      setSavingNotificationCities(false);
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
    if (notificationCityOptions.some((existing) => existing.toLowerCase() === city.toLowerCase())) {
      setError('Taj grad je već na listi.');
      return;
    }
    setError('');
    setNotificationCities((current) => [...current, city]);
    setNotificationCityInput('');
  }

  const canSubmitRequest = useMemo(
    () => userRole === 'CUSTOMER' && Boolean(token),
    [userRole, token],
  );

  async function loadCategories() {
    try {
      setCategories(await apiFetch<Category[]>('/categories'));
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    }
  }

  async function loadMyRequests(city = citySearch) {
    if (!token) return;

    try {
      const endpoint = userRole === 'CRAFTSMAN'
        ? `/service-requests/available${city.trim() ? `?city=${encodeURIComponent(city.trim())}` : ''}`
        : '/service-requests/my';
      setRequests(await apiFetch<ServiceRequest[]>(endpoint));
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    }
  }

  async function detectRegistrationCity() {
    const formVersion = authFormVersion.current;
    setDetectingCity(true);
    setError('');
    try {
      const location = await getBrowserLocation();
      const query = new URLSearchParams({
        format: 'jsonv2',
        lat: String(location.latitude),
        lon: String(location.longitude),
        zoom: '10',
        addressdetails: '1',
      });
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${query.toString()}`);
      if (!response.ok) throw new Error('Automatsko prepoznavanje grada trenutno nije dostupno.');
      const result = await response.json() as { address?: Record<string, string> };
      const address = result.address;
      const city = address?.city || address?.town || address?.village || address?.municipality;
      if (!city) throw new Error('Grad nije pronađen. Unesite ga ručno.');
      if (formVersion === authFormVersion.current) setAuthForm((current) => ({ ...current, city }));
    } catch (locationError) {
      if (formVersion === authFormVersion.current) setError(getErrorMessage(locationError));
    } finally {
      if (formVersion === authFormVersion.current) setDetectingCity(false);
    }
  }

  async function searchRequestsByCity() {
    setLoading(true);
    setError('');
    await loadMyRequests(citySearch);
    setLoading(false);
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
      setOfferModalOpen(true);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  async function submitOffer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedJob) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await apiFetch<Offer>('/offers', {
        method: 'POST',
        body: JSON.stringify({
          requestId: selectedJob.id,
          price: offerAgreeOnSite ? null : Number(offerPrice),
          message: offerMessage.trim() || null,
          agreeOnSite: offerAgreeOnSite,
        }),
      });
      setOfferModalOpen(false);
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

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const registrationDisplayName = `${authForm.firstName.trim()} ${authForm.lastName.trim()}`.trim();
      const endpoint = authMode === 'login' ? '/auth/login' : '/auth/register';
      const payload = authMode === 'login'
        ? { email: authForm.email, password: authForm.password, role: authForm.role }
        : {
            displayName: registrationDisplayName,
            email: authForm.email,
            password: authForm.password,
            phone: authForm.phone,
            role: authForm.role,
            city: authForm.city,
            categoryIds: authForm.role === 'CRAFTSMAN' ? authForm.categoryIds : [],
          };
      let data: AuthResponse;
      if (authMode === 'register' && registrationImage) {
        const registration = new FormData();
        registration.append('displayName', registrationDisplayName);
        registration.append('email', authForm.email);
        registration.append('password', authForm.password);
        registration.append('phone', authForm.phone);
        registration.append('role', authForm.role);
        registration.append('city', authForm.city.trim());
        registration.append('categoryIds', authForm.role === 'CRAFTSMAN' ? authForm.categoryIds.join(',') : '');
        registration.append('image', registrationImage);
        data = await apiFetch<AuthResponse>('/auth/register-with-image', { method: 'POST', body: registration });
      } else {
        data = await apiFetch<AuthResponse>(endpoint, { method: 'POST', body: JSON.stringify(payload) });
      }
      const authToken = data.accessToken || data.token;

      if (!authToken) throw new Error('Authentication token was not returned');

      const nextUser: User = {
        email: data.email,
        displayName: data.displayName || registrationDisplayName,
        profileImageUrl: data.profileImageUrl,
        role: data.role || authForm.role,
        city: data.city || authForm.city,
      };
      localStorage.setItem('fixhome_token', authToken);
      localStorage.setItem('fixhome_user', JSON.stringify(nextUser));
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

  async function handleCreateRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const location = await getBrowserLocation();
      await apiFetch('/service-requests', {
        method: 'POST',
        body: JSON.stringify({
          categoryId: Number(form.categoryId),
          description: form.description,
          imageUrl: form.imageUrl,
          latitude: location.latitude,
          longitude: location.longitude,
        }),
      });
      setForm(emptyForm);
      setSuccess('Zahtev je kreiran');
      await loadMyRequests();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteRequest(requestId: number) {
    if (!window.confirm('Obrisati zahtev i sve primljene ponude?')) return;

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await apiFetch<void>(`/service-requests/${requestId}`, { method: 'DELETE' });
      setRequests((current) => current.filter((request) => request.id !== requestId));
      setSuccess('Zahtev je obrisan');
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
    } finally {
      setLoading(false);
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
      setEditForm({
        categoryId: String(request.categoryId),
        description: request.description,
        imageUrl: request.imageUrl || '',
      });
    } catch (requestError) {
      setError(getErrorMessage(requestError));
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
      setSuccess('Posao je završen. Hvala na oceni!');
    } catch (reviewError) {
      setError(getErrorMessage(reviewError));
    } finally {
      setLoading(false);
    }
  }

  async function saveRequestDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRequest) return;

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const updatedRequest = await apiFetch<ServiceRequest>(`/service-requests/${selectedRequest.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          categoryId: Number(editForm.categoryId),
          description: editForm.description.trim(),
          imageUrl: editForm.imageUrl.trim() || null,
        }),
      });
      setSelectedRequest(updatedRequest);
      setRequests((current) => current.map((request) => request.id === updatedRequest.id ? updatedRequest : request));
      setEditForm({
        categoryId: String(updatedRequest.categoryId),
        description: updatedRequest.description,
        imageUrl: updatedRequest.imageUrl || '',
      });
      setSuccess('Izmene zahteva su sačuvane');
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setLoading(false);
    }
  }

  function updateEditForm(event: InputChange) {
    const { name, value } = event.target;
    setEditForm((current) => ({ ...current, [name]: value }));
  }

  function updateAuthForm(event: InputChange) {
    const { name, value } = event.target;
    setAuthForm((current) => ({ ...current, [name]: value } as AuthForm));
  }

  function toggleRegistrationCategory(categoryId: number) {
    setAuthForm((current) => ({
      ...current,
      categoryIds: current.categoryIds.includes(categoryId)
        ? current.categoryIds.filter((selectedId) => selectedId !== categoryId)
        : [...current.categoryIds, categoryId],
    }));
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
    resetAuthForm(selectedRole || 'CUSTOMER');
    setAuthMode(mode);
    setError('');
    setSuccess('');
  }

  function updateRequestForm(event: InputChange) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function logout() {
    resetAuthForm('CUSTOMER');
    setCraftsmanTab('requests');
    setCustomerRatingsOpen(false);
    setCompletedJobs([]);
    setCompletedJobsError('');
    localStorage.removeItem('fixhome_token');
    localStorage.removeItem('fixhome_user');
    setToken('');
    setUser(null);
    setSelectedRequest(null);
    setSelectedJob(null);
    setRequests([]);
    setCitySearch('');
    setSelectedRole(null);
    setSuccess('Odjavljen si');
  }

  return (
    <div className="app-shell" id="top">
      <header className="site-header">
        <div className="site-header-inner">
          <a className="brand" href="#top" onClick={() => { if (!token && selectedRole !== null) showRolePicker(); }}>
            <span className="brand-mark" aria-hidden="true">
              <svg viewBox="0 0 32 32"><path d="m4 14 12-10 12 10M7 12v15h18V12M13 27v-9h6v9" /></svg>
            </span>
            <span className="brand-name">Fix<b>Home</b></span>
          </a>
          {!token && selectedRole === null ? (
            <nav className="site-nav" aria-label="Glavna navigacija">
              <a href="#kako">Kako funkcioniše</a>
              <a href="#usluge">Usluge</a>
              <a href="#uloge">Pridruži se</a>
            </nav>
          ) : (
            <nav className="site-nav" aria-label="Glavna navigacija">
              {token && <span className="site-nav-current">{userRole === 'CRAFTSMAN' ? 'Portal za majstore' : 'Portal za korisnike'}</span>}
            </nav>
          )}
          <div className="site-actions">
            {token ? (
              <>
                <span className="user-chip">
                  <span className="user-chip-avatar" aria-hidden="true">{(user?.displayName || user?.email || 'K').charAt(0).toUpperCase()}</span>
                  <span className="user-chip-name">{user?.displayName || user?.email}</span>
                </span>
                <button className="secondary" onClick={logout} type="button">Odjava</button>
              </>
            ) : selectedRole === null ? (
              <a className="btn-link" href="#uloge">Prijavi se</a>
            ) : (
              <button className="secondary" type="button" onClick={showRolePicker}>← Početna</button>
            )}
          </div>
        </div>
      </header>

      {!token ? (
        selectedRole === null ? (
          <main className="welcome-page">
            <section className="welcome-hero">
              <div className="welcome-copy">
                <p className="welcome-eyebrow">DOBRO DOŠLI U FIXHOME</p>
                <h2 className="welcome-title">Sve za vaš dom. Na jednom mestu.</h2>
                <p className="welcome-description">Pronađite pouzdanog majstora ili povežite svoje veštine sa novim poslovima.</p>
                <div className="welcome-cta">
                  <a className="btn-primary-link" href="#uloge">Počnite besplatno</a>
                  <a className="btn-ghost-link" href="#kako">Kako funkcioniše</a>
                </div>
                <div className="welcome-promise"><span aria-hidden="true">✓</span> Jednostavno · Lokalno · Pouzdano</div>
              </div>
              <div className="welcome-art" aria-hidden="true">
                <span className="welcome-art-sun" />
                <svg viewBox="0 0 220 180" role="presentation">
                  <path d="M36 91 110 32l74 59v70H36V91Z"                   fill="#FFFFFF" />
                                    <path d="M22 92 110 22l88 70" fill="none" stroke="#8FB8F5" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M91 161v-48h38v48"                   fill="#1A5FD8" />
                                    <path d="M54 105h25v25H54zM141 105h25v25h-25z" fill="#E6F0FD" />
                                    <path d="M13 164h194" stroke="#9CC0F2" strokeWidth="8" strokeLinecap="round" />
                </svg>
                <span className="welcome-art-spark">✦</span>
              </div>
            </section>
            <section className="stats-strip" aria-label="FixHome u brojkama">
              <div><strong>6+</strong><span>kategorija usluga</span></div>
              <div><strong>24/7</strong><span>objavljivanje zahteva</span></div>
              <div><strong>1 klik</strong><span>do ponuda majstora</span></div>
              <div><strong>★ 5</strong><span>ocene i komentari</span></div>
            </section>
            <section className="portal-section" id="usluge" aria-labelledby="services-title">
              <div className="section-heading">
                <p className="eyebrow">USLUGE</p>
                <h2 id="services-title">Majstori za svaku potrebu u domu</h2>
                <p>Od sitnih popravki do većih radova — izaberite kategoriju i opišite problem.</p>
              </div>
              <div className="service-grid">
                {[
                  ['💧', 'Vodoinstalater', 'Curenje, slavine, bojleri i kanalizacija'],
                  ['⚡', 'Električar', 'Instalacije, utičnice, osigurači i rasveta'],
                  ['🎨', 'Moler', 'Krečenje, gletovanje i dekorativni radovi'],
                  ['🪚', 'Stolar', 'Nameštaj, vrata, prozori i ugradnje'],
                  ['❄️', 'Klima i grejanje', 'Montaža, servis i održavanje uređaja'],
                  ['🧹', 'Čišćenje', 'Generalno čišćenje stana, kuće i poslovnog prostora'],
                ].map(([icon, title, text]) => (
                  <article className="service-card" key={title}>
                    <span className="service-icon" aria-hidden="true">{icon}</span>
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </article>
                ))}
              </div>
            </section>
            <section className="portal-section portal-section-tinted" id="kako" aria-labelledby="how-title">
              <div className="section-heading">
                <p className="eyebrow">KAKO FUNKCIONIŠE</p>
                <h2 id="how-title">Do rešenja u tri jednostavna koraka</h2>
              </div>
              <ol className="steps">
                <li><span className="step-number">1</span><h3>Opišite problem</h3><p>Izaberite kategoriju, dodajte opis i sliku. Lokacija se čuva uz zahtev.</p></li>
                <li><span className="step-number">2</span><h3>Primite ponude</h3><p>Majstori iz vašeg grada šalju ponude sa cenom ili dogovorom na licu mesta.</p></li>
                <li><span className="step-number">3</span><h3>Izaberite i ocenite</h3><p>Prihvatite najbolju ponudu, a po završetku ostavite ocenu majstoru.</p></li>
              </ol>
            </section>
            <section className="role-picker" id="uloge" aria-labelledby="role-picker-title">
              <div className="role-picker-heading">
                <p className="eyebrow">ZA POČETAK</p>
                <h2 id="role-picker-title">Kako želite da koristite FixHome?</h2>
                <p>Izaberite ulogu i nastavljamo dalje.</p>
              </div>
              <div className="role-options">
                <button className="role-option role-option-customer" type="button" onClick={() => chooseRole('CUSTOMER')}>
                  <span className="role-option-icon" aria-hidden="true">
                    <svg viewBox="0 0 32 32"><path d="m4 14 12-10 12 10M7 12v15h18V12M13 27v-9h6v9" /></svg>
                  </span>
                  <span className="role-option-copy"><strong>Korisnik</strong><small>Treba mi pomoć oko kuće</small></span>
                  <span className="role-option-arrow" aria-hidden="true">→</span>
                </button>
                <button className="role-option role-option-craftsman" type="button" onClick={() => chooseRole('CRAFTSMAN')}>
                  <span className="role-option-icon" aria-hidden="true">
                    <svg viewBox="0 0 32 32"><path d="m19 5 8 8-4 4-8-8M16 8l-3 3 8 8 3-3M5 27l11-11M8 24l-3-3M23 5l4 4" /></svg>
                  </span>
                  <span className="role-option-copy"><strong>Majstor</strong><small>Tražim nove poslove</small></span>
                  <span className="role-option-arrow" aria-hidden="true">→</span>
                </button>
              </div>
            </section>
          </main>
        ) : (
        <div className="auth-flow">
        <main className="auth-split">
          <aside className="auth-aside" aria-hidden="false">
            <p className="eyebrow">{selectedRole === 'CUSTOMER' ? 'PORTAL ZA KORISNIKE' : 'PORTAL ZA MAJSTORE'}</p>
            <h2>{selectedRole === 'CUSTOMER' ? 'Objavite zahtev i primite ponude majstora.' : 'Pronađite nove poslove u svom gradu.'}</h2>
            <ul>
              {(selectedRole === 'CUSTOMER'
                ? ['Besplatno objavljivanje zahteva', 'Ponude proverenih majstora', 'Ocene i komentari korisnika']
                : ['Poslovi filtrirani po kategoriji i gradu', 'Konkurišite sa cenom ili dogovorom', 'Gradite reputaciju kroz ocene']
              ).map((item) => <li key={item}><span aria-hidden="true">✓</span>{item}</li>)}
            </ul>
          </aside>
          <section className="card auth-card">
            <button className={`role-back ${selectedRole === 'CRAFTSMAN' ? 'role-back-craftsman' : 'role-back-customer'}`} type="button" onClick={showRolePicker}>← Nazad</button>
            <div className="chosen-role">
              <span className="chosen-role-mark">{selectedRole === 'CUSTOMER' ? 'K' : 'M'}</span>
              <span><small>NASTAVLJATE KAO</small><strong>{selectedRole === 'CUSTOMER' ? 'Korisnik' : 'Majstor'}</strong></span>
            </div>
            <div className="auth-tabs" role="tablist" aria-label="Prijava i registracija">
              <button type="button" role="tab" aria-selected={authMode === 'login'} className={authMode === 'login' ? 'active' : ''} onClick={() => changeAuthMode('login')}>Prijava</button>
              <button type="button" role="tab" aria-selected={authMode === 'register'} className={authMode === 'register' ? 'active' : ''} onClick={() => changeAuthMode('register')}>Registracija</button>
            </div>
            <form key={authFormVersion.current} onSubmit={handleAuthSubmit} className="stack form" autoComplete="off">
              {authMode === 'register' && <>
                <label>Ime <span className="required-marker" aria-hidden="true">*</span><input name="firstName" value={authForm.firstName} onChange={updateAuthForm} type="text" autoComplete="off" maxLength={120} required /></label>
                <label>Prezime <span className="required-marker" aria-hidden="true">*</span><input name="lastName" value={authForm.lastName} onChange={updateAuthForm} type="text" autoComplete="off" maxLength={120} required /></label>
                {authForm.firstName.trim().length + authForm.lastName.trim().length + 1 > 120 && <p className="auth-error" role="alert">Ime i prezime zajedno mogu imati najviše 120 znakova.</p>}
                <label className="profile-image-upload">Profilna slika (opciono)
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setRegistrationImage(event.target.files?.[0] || null)} />
                </label>
              </>}
              <label>
                Email
                <span className="required-marker" aria-hidden="true">*</span>
                <input name="email" value={authForm.email} onChange={updateAuthForm} type="email" required />
              </label>
              <label>
                Lozinka
                <span className="required-marker" aria-hidden="true">*</span>
                <input name="password" value={authForm.password} onChange={updateAuthForm} type="password" required />
              </label>
              {authMode === 'register' && <>
                <label>Telefon<input name="phone" value={authForm.phone} onChange={updateAuthForm} type="tel" /></label>
                <label>Grad <span className="required-marker" aria-hidden="true">*</span><input name="city" value={authForm.city} onChange={updateAuthForm} type="text" autoComplete="off" maxLength={120} required /></label>
                <button className="secondary" type="button" disabled={detectingCity} onClick={() => void detectRegistrationCity()}>{detectingCity ? 'Prepoznajem grad...' : 'Prepoznaj grad po lokaciji'}</button>
                <small className="location-attribution">Automatsko prepoznavanje koristi OpenStreetMap. Grad možete uneti ili izmeniti ručno.</small>
                {authForm.role === 'CRAFTSMAN' && <fieldset className="category-checkboxes">
                  <legend>Kategorije usluga <span className="required-marker" aria-hidden="true">*</span></legend>
                  <p>Izaberite jednu ili više kategorija.</p>
                  {categories.filter((category) => !/^vodoinstalater\s*\d+$/i.test(category.name.trim())).map((category) => <label key={category.id} className="category-checkbox">
                    <input
                      type="checkbox"
                      checked={authForm.categoryIds.includes(category.id)}
                      onChange={() => toggleRegistrationCategory(category.id)}
                    />
                    <span>{category.name}</span>
                  </label>)}
                </fieldset>}
              </>}
              <button className="primary" type="submit" disabled={loading || (authMode === 'register' && (
                !authForm.firstName.trim() || !authForm.lastName.trim()
                || authForm.firstName.trim().length + authForm.lastName.trim().length + 1 > 120
                || !authForm.city.trim() || (authForm.role === 'CRAFTSMAN' && authForm.categoryIds.length === 0)
              ))}>{loading ? '...' : authMode === 'login' ? 'Prijavi se' : 'Registruj se'}</button>
              {error && <p className="auth-error" role="alert">{error}</p>}
              {success && <p className="auth-success" role="status">{success}</p>}
            </form>
          </section>
        </main>
        </div>
        )
      ) : (
        <>
        <section className="portal-banner">
          <div>
            <p className="eyebrow">{userRole === 'CRAFTSMAN' ? 'PORTAL ZA MAJSTORE' : 'PORTAL ZA KORISNIKE'}</p>
            <h1>Dobrodošli, {user?.displayName || user?.email}</h1>
            <p>{userRole === 'CRAFTSMAN' ? 'Pregledajte otvorene poslove i pošaljite ponude klijentima.' : 'Objavite novi zahtev i pratite ponude majstora na jednom mestu.'}</p>
          </div>
          <div className="portal-banner-stats">
            <div><strong>{requests.length}</strong><span>{userRole === 'CRAFTSMAN' ? 'dostupnih poslova' : 'vaših zahteva'}</span></div>
            <div><strong>{user?.city || '—'}</strong><span>grad</span></div>
          </div>
        </section>
        {userRole === 'CRAFTSMAN' && <nav className="portal-tabs" aria-label="Navigacija naloga">
          <button type="button" aria-current={craftsmanTab === 'requests' ? 'page' : undefined} onClick={() => setCraftsmanTab('requests')}>Zahtevi</button>
          <button type="button" aria-current={craftsmanTab === 'profile' ? 'page' : undefined} onClick={() => setCraftsmanTab('profile')}>Profil</button>
          <button type="button" aria-current={craftsmanTab === 'ratings' ? 'page' : undefined} onClick={() => setCraftsmanTab('ratings')}>Ocene</button>
        </nav>}
        {userRole === 'CUSTOMER' && <nav className="portal-tabs" aria-label="Ocene korisnika">
          <button type="button" aria-current={!customerRatingsOpen ? 'page' : undefined} onClick={() => setCustomerRatingsOpen(false)}>Zahtevi i profil</button>
          <button type="button" aria-current={customerRatingsOpen ? 'page' : undefined} onClick={() => setCustomerRatingsOpen(true)}>Ocene</button>
        </nav>}
        <main className={`card-grid portal-dashboard${userRole === 'CRAFTSMAN' ? ' portal-dashboard-tabbed' : ''}`}>
          {userRole === 'CUSTOMER' && customerRatingsOpen && <section className="card"><h2>Moje ocene</h2><PublicReviews endpoint="/customers/profile/reviews" /></section>}
          {((userRole === 'CUSTOMER' && !customerRatingsOpen) || (userRole === 'CRAFTSMAN' && craftsmanTab === 'profile')) && <section className="card">
            <h2>Profil</h2>
            <div className="profile-box">
              <div className="profile-heading">
                {user?.profileImageUrl ? (
                  <AuthenticatedImage
                    imageUrl={user.profileImageUrl}
                    token={token}
                    className="profile-avatar"
                    alt="Slika profila"
                    fallbackText={(user.displayName || user.email || 'K').charAt(0).toUpperCase()}
                  />
                ) : (
                  <span className="profile-avatar profile-avatar-placeholder" aria-hidden="true">
                    {(user?.displayName || user?.email || 'K').charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="profile-heading-details">
                  <strong>{user?.displayName || 'Korisnik'}</strong>
                  <span>{user?.email}</span>
                </div>
              </div>
              <span>Uloga</span><strong>{userRole}</strong>
              <span>Grad</span><strong>{user?.city || 'Nije unet'}</strong>
              {userRole === 'CRAFTSMAN' && <><span>Kategorije usluga</span><strong>{craftsmanCategories.length > 0 ? craftsmanCategories.join(', ') : 'Nije izabrana'}</strong></>}
            </div>
            {userRole === 'CRAFTSMAN' && <>
              <div className="notification-preferences">
                <h3>Obaveštenja za nove poslove</h3>
                <p>Dobijaj obaveštenja za poslove u izabranim gradovima i kategorijama tvojih usluga.</p>
                {notificationCityOptions.map((city) => <label className="notification-city-option" key={city.toLowerCase()}><input type="checkbox" checked={notificationCities.some((selected) => selected.toLowerCase() === city.toLowerCase())} onChange={() => toggleNotificationCity(city)} /><span>{city}</span></label>)}
                <label>Dodaj drugi grad<input value={notificationCityInput} onChange={(event) => setNotificationCityInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addNotificationCity(); } }} maxLength={120} placeholder="Unesite naziv grada" /></label>
                <button className="secondary" type="button" onClick={addNotificationCity}>Dodaj grad</button>
                <button className="primary" type="button" disabled={savingNotificationCities} onClick={() => void saveNotificationCities()}>{savingNotificationCities ? 'Čuvam...' : 'Sačuvaj gradove'}</button>
                <small>Push obaveštenja uključite u FixHome mobilnoj aplikaciji.</small>
              </div>
            </>}
          </section>}
          {userRole === 'CRAFTSMAN' && craftsmanTab === 'ratings' && <section className="card">
            <h2>Završeni poslovi i ocene</h2>
            <div className="completed-jobs">
              {loadingCompletedJobs ? <p>Učitavam završene poslove...</p> : completedJobsError ? (
                <p className="auth-error" role="alert">{completedJobsError}</p>
              ) : completedJobs.length === 0 ? (
                <p>Još nema završenih i ocenjenih poslova.</p>
              ) : <>
                <p className="completed-job-average">
                  ★ {(completedJobs.reduce((sum, job) => sum + job.rating, 0) / completedJobs.length).toFixed(1)}
                  {' · '}{completedJobs.length} {getRatingCountLabel(completedJobs.length)}
                </p>
                {completedJobs.map((job) => (
                  <article className="completed-job" key={job.requestId}>
                    <strong>{job.categoryName}</strong>
                    <small>{new Date(job.completedAt).toLocaleDateString('sr-RS')}</small>
                    <p>{job.description}</p>
                    <span className="completed-job-rating">{'★'.repeat(job.rating)}{'☆'.repeat(5 - job.rating)}</span>
                    <p>{job.comment || 'Korisnik nije ostavio komentar.'}</p>
                    <CustomerReviewForm job={job} onSaved={(review) => setCompletedJobs((current) => current.map((item) => item.requestId === job.requestId ? { ...item, customerReview: review } : item))} />
                  </article>
                ))}
              </>}
            </div>
          </section>}
          {((userRole === 'CUSTOMER' && !customerRatingsOpen) || (userRole === 'CRAFTSMAN' && craftsmanTab === 'requests')) && (selectedRequest ? (
            <section className="card wide">
              <button className="back-button" type="button" onClick={() => setSelectedRequest(null)}>‹ Nazad na zahteve</button>
              <h2>Pregled zahteva</h2>
              <RequestStatusBadge status={selectedRequest.status} />
              {userRole === 'CUSTOMER' && receivedOffers.length > 0 && <button className="primary" type="button" onClick={() => { setOffersDialogOpen(true); setFocusedOffer(null); }}>
                Ponude majstora ({receivedOffers.length})
              </button>}
              {(selectedRequest.status === 'ACCEPTED' || selectedRequest.status === 'IN_PROGRESS') && (
                <div className="completion-review">
                  <h3>Završi posao i oceni majstora</h3>
                  <p>Ocenu i komentar mogu da vide svi prijavljeni korisnici i majstori.</p>
                  <div className="review-rating" role="radiogroup" aria-label="Ocena majstora">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={rating}
                        type="button"
                        role="radio"
                        aria-checked={reviewRating === rating}
                        aria-label={`${rating} od 5 zvezdica`}
                        className={rating <= reviewRating ? 'selected' : ''}
                        onClick={() => setReviewRating(rating)}
                      >★</button>
                    ))}
                  </div>
                  <label>Komentar (opciono)<textarea value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} rows={3} maxLength={1000} /></label>
                  <button className="primary" type="button" disabled={loading} onClick={() => void completeAndReview()}>{loading ? 'Čuvam ocenu...' : 'Završi posao'}</button>
                </div>
              )}
              {selectedRequest.status === 'COMPLETED' && (
                <div className="completion-review">
                  <h3>Ocena za majstora</h3>
                  {selectedReview
                    ? <><p className="completed-job-rating">{'★'.repeat(selectedReview.rating)}{'☆'.repeat(5 - selectedReview.rating)}</p><p>{selectedReview.comment || 'Komentar nije ostavljen.'}</p></>
                    : <p>Posao je završen.</p>}
                </div>
              )}
              {selectedRequest.status !== 'COMPLETED' ? (
                <form onSubmit={saveRequestDetails} className="stack form">
                  <label>Kategorija<select name="categoryId" value={editForm.categoryId} onChange={updateEditForm} required disabled={!canSubmitRequest}><option value="">Izaberite kategoriju</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
                  <label>Slika problema (URL)<input name="imageUrl" value={editForm.imageUrl} onChange={updateEditForm} type="text" disabled={!canSubmitRequest} /></label>
                  {selectedRequest.imageUrl && <AuthenticatedImage imageUrl={selectedRequest.imageUrl} token={token} />}
                  <label>Opis problema<textarea name="description" value={editForm.description} onChange={updateEditForm} rows={4} required disabled={!canSubmitRequest} /></label>
                  <button className="primary" type="submit" disabled={loading || !canSubmitRequest}>{loading ? 'Čuvam...' : 'Sačuvaj izmene'}</button>
                </form>
              ) : <p>{selectedRequest.description}</p>}
            </section>
          ) : selectedJob ? (
            <section className="card wide">
              <button className="back-button" type="button" onClick={() => setSelectedJob(null)}>‹ Nazad na poslove</button>
              <h2>{selectedJob.categoryName}</h2>
              <RequestStatusBadge status={selectedJob.status} />
              <p className="request-city">Grad: {selectedJob.city || 'Nije naveden'}</p>
              <h3>Ocene korisnika</h3>
              <PublicReviews endpoint={`/customers/${selectedJob.customerId}/reviews`} />
              <div className="job-street">
                <strong>Ulica</strong>
                <RequestAddress latitude={selectedJob.latitude} longitude={selectedJob.longitude} />
              </div>
              {selectedJob.imageUrl && <AuthenticatedImage imageUrl={selectedJob.imageUrl} token={token} />}
              <h3>Opis problema</h3>
              <p>{selectedJob.description}</p>
              <h3>Lokacija zahteva</h3>
              <RequestMap latitude={selectedJob.latitude} longitude={selectedJob.longitude} />
              {(selectedJob.status === 'NEW' || selectedJob.status === 'WAITING_FOR_OFFERS') && (selectedJob.hasOffered ? <p className="offer-sent-notice"><strong>Već si konkurisao za ovaj posao.</strong> Ponuda je na čekanju dok klijent ne odgovori.</p> : <button className="primary" type="button" onClick={() => { setError(''); setOfferMessage(''); setOfferPrice(''); setOfferAgreeOnSite(false); setOfferModalOpen(true); }}>Konkuriši</button>)}
            </section>
          ) : (
            <>
              {canSubmitRequest && <section className="card">
                <h2>Novi zahtev</h2>
                <form onSubmit={handleCreateRequest} className="stack form">
                  <label>Kategorija<select name="categoryId" value={form.categoryId} onChange={updateRequestForm} required={canSubmitRequest} disabled={!canSubmitRequest}><option value="">Izaberite kategoriju</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
                  <label>Slika problema (URL)<input name="imageUrl" value={form.imageUrl} onChange={updateRequestForm} type="text" disabled={!canSubmitRequest} /></label>
                  <label>Opis problema<textarea name="description" value={form.description} onChange={updateRequestForm} rows={4} required={canSubmitRequest} disabled={!canSubmitRequest} /></label>
                  <button className="primary" type="submit" disabled={loading || !canSubmitRequest}>{loading ? '...' : 'Pošalji zahtev'}</button>
                </form>
              </section>}
              <section className="card wide">
                <h2>{userRole === 'CRAFTSMAN' ? 'Potencijalni poslovi' : 'Moji zahtevi'}</h2>
                {userRole === 'CRAFTSMAN' && <div className="city-search">
                  <label>Pretraga po gradu<input value={citySearch} onChange={(event) => setCitySearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void searchRequestsByCity(); }} placeholder="Unesite grad" maxLength={120} /></label>
                  <button className="primary" type="button" disabled={loading} onClick={() => void searchRequestsByCity()}>{loading ? 'Pretražujem...' : 'Pretraži'}</button>
                </div>}
                {requests.length === 0 ? <p>Nema zahteva.</p> : <div className="request-list">{requests.map((request) => <article key={request.id} className="request-item"><button className="job-card-open" type="button" onClick={() => void openJobDetails(request.id)} disabled={userRole !== 'CRAFTSMAN' || loading} aria-label={`Pregledaj zahtev: ${request.categoryName}`}><span className="request-header"><strong>{request.categoryName}</strong><RequestStatusBadge status={request.status} /></span>{userRole === 'CRAFTSMAN' && <span className="request-city">Grad: {request.city || 'Nije naveden'}</span>}<span className="request-summary">{request.description}</span></button>{request.imageUrl && <AuthenticatedImage imageUrl={request.imageUrl} token={token} />}<div className="request-actions">{userRole === 'CRAFTSMAN' && (request.status === 'NEW' || request.status === 'WAITING_FOR_OFFERS') && (request.hasOffered ? <p className="offer-sent-notice"><strong>Već si konkurisao za ovaj posao.</strong> Ponuda je na čekanju dok klijent ne odgovori.</p> : <button className="primary" type="button" disabled={loading} onClick={() => void openOfferForm(request.id)}>Konkuriši</button>)}{canSubmitRequest && <button className="review-request" type="button" disabled={loading} onClick={() => void openRequest(request.id)}>Pregledaj zahtev</button>}{canSubmitRequest && request.status !== 'COMPLETED' && <button className="delete-request" type="button" disabled={loading} onClick={() => void handleDeleteRequest(request.id)}>Obriši zahtev</button>}</div></article>)}</div>}
              </section>
            </>
          ))}
        </main>
        </>
      )}

      <footer className="site-footer">
        <div className="site-footer-inner">
          <div>
            <span className="brand-name">Fix<b>Home</b></span>
            <p>Platforma koja povezuje korisnike i majstore za poslove u domu.</p>
          </div>
          <p className="site-footer-copy">© {new Date().getFullYear()} FixHome. Sva prava zadržana.</p>
        </div>
      </footer>

      {offersDialogOpen && <div className="offer-modal-backdrop" onClick={() => { if (!loading) { setOffersDialogOpen(false); setFocusedOffer(null); } }}>
        <section className="offer-modal" role="dialog" aria-modal="true" aria-labelledby="received-offers-title" onClick={(event) => event.stopPropagation()}>
          <button className="back-button" type="button" disabled={loading} onClick={() => focusedOffer ? setFocusedOffer(null) : (setOffersDialogOpen(false), setFocusedOffer(null))}>
            ‹ {focusedOffer ? 'Nazad na ponude' : 'Zatvori'}
          </button>
          {focusedOffer ? <>
            <h2 id="received-offers-title">{focusedOffer.craftsmanCompanyName || 'Ponuda majstora'}</h2>
            <h3>Ocene majstora</h3>
            <PublicReviews endpoint={`/craftsmen/${focusedOffer.craftsmanId}/reviews`} />
            <OfferStatusBadge status={focusedOffer.status} />
            <p>{focusedOffer.agreeOnSite ? 'Dogovor na licu mesta' : `${focusedOffer.price?.toLocaleString('sr-RS')} RSD`}</p>
            {focusedOffer.message && <p>{focusedOffer.message}</p>}
            {focusedOffer.status === 'ACCEPTED' ? (
              <div className="offer-contact-details">
                <h3>Kontakt majstora</h3>
                <a href={`mailto:${focusedOffer.craftsmanEmail}`}>{focusedOffer.craftsmanEmail}</a>
                <a href={`tel:${focusedOffer.craftsmanPhone}`}>{focusedOffer.craftsmanPhone}</a>
              </div>
            ) : focusedOffer.status === 'PENDING' ? (
              <button className="primary" type="button" disabled={loading} onClick={() => void acceptOffer()}>{loading ? 'Prihvatam...' : 'Prihvati ponudu'}</button>
            ) : <p>Ova ponuda više nije aktivna.</p>}
          </> : <>
            <h2 id="received-offers-title">Ponude majstora</h2>
            <div className="received-offers">
              {receivedOffers.map((offer) => (
                <button className="received-offer-button" type="button" key={offer.id} onClick={() => setFocusedOffer(offer)}>
                  <strong>{offer.craftsmanCompanyName || 'Majstor'}</strong>
                  <span>{offer.agreeOnSite ? 'Dogovor na licu mesta' : `${offer.price?.toLocaleString('sr-RS')} RSD`}</span>
                  <OfferStatusBadge status={offer.status} />
                </button>
              ))}
            </div>
          </>}
          {error && <p className="offer-modal-error" role="alert">{error}</p>}
        </section>
      </div>}
      {offerModalOpen && selectedJob && <div className="offer-modal-backdrop" onClick={() => { if (!loading) setOfferModalOpen(false); }}>
        <form className="offer-modal" role="dialog" aria-modal="true" aria-labelledby="offer-modal-title" onSubmit={(event) => void submitOffer(event)} onClick={(event) => event.stopPropagation()}>
          <h2 id="offer-modal-title">Konkuriši za posao</h2>
          <p>{selectedJob.categoryName}</p>
          <label>Poruka (opciono)<textarea value={offerMessage} onChange={(event) => setOfferMessage(event.target.value)} rows={3} maxLength={1000} placeholder="Predstavi se i opiši kako možeš da pomogneš" /></label>
          <label>Iznos (RSD, opciono)<input type="number" min="1" step="0.01" value={offerPrice} disabled={offerAgreeOnSite} onChange={(event) => setOfferPrice(event.target.value)} placeholder="Unesite cenu" required={!offerAgreeOnSite} /></label>
          <label className="offer-onsite"><input type="checkbox" checked={offerAgreeOnSite} onChange={(event) => { setOfferAgreeOnSite(event.target.checked); if (event.target.checked) setOfferPrice(''); }} /><span>Ako ne unosim iznos, dogovorićemo cenu na licu mesta.</span></label>
          {error && <p className="offer-modal-error" role="alert">{error}</p>}
          <div className="offer-modal-actions">
            <button className="secondary" type="button" disabled={loading} onClick={() => setOfferModalOpen(false)}>Otkaži</button>
            <button className="primary" type="submit" disabled={loading}>{loading ? 'Šaljem...' : 'Pošalji ponudu'}</button>
          </div>
        </form>
      </div>}
      {(token || selectedRole === null) && (error || success) && <div className={`message ${error ? 'error' : 'success'}`} role={error ? 'alert' : 'status'}>{error || success}</div>}
    </div>
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
  if (loading) return <p>Učitavam ocene...</p>;
  if (error) return <p className="auth-error" role="alert">{error}</p>;
  if (reviews.length === 0) return <p>Još nema ocena.</p>;
  return <div className="completed-jobs">
    <p className="completed-job-average">★ {averageRating(reviews)} · {reviews.length} {getRatingCountLabel(reviews.length)}</p>
    {reviews.map((review, index) => <article className="completed-job" key={`${review.createdAt}-${index}`}>
      <span className="completed-job-rating">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
      <small>{new Date(review.createdAt).toLocaleDateString('sr-RS')}</small>
      <p>{review.comment || 'Komentar nije ostavljen.'}</p>
    </article>)}
  </div>;
}

function CustomerReviewForm({ job, onSaved }: { job: CompletedJob; onSaved: (review: CustomerReview) => void }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
  if (job.customerReview) return <p>Vaša ocena korisnika: {'★'.repeat(job.customerReview.rating)}{'☆'.repeat(5 - job.customerReview.rating)} {job.customerReview.comment}</p>;
  return <form className="stack form" onSubmit={(event) => void submit(event)}>
    <strong>Ocenite korisnika</strong>
    <label>Ocena<select value={rating} onChange={(event) => setRating(Number(event.target.value))}>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
    <label>Komentar (vidljiv svim prijavljenim korisnicima)<textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={1000} rows={2} /></label>
    {error && <p className="auth-error" role="alert">{error}</p>}
    <button className="primary" type="submit" disabled={loading}>{loading ? 'Čuvam...' : 'Oceni korisnika'}</button>
  </form>;
}

function RequestStatusBadge({ status }: { status: string }) {
  const presentation = getRequestStatusPresentation(status);
  return <span className={`badge badge-${presentation.tone}`} aria-label={`Status zahteva: ${presentation.label}`}>{presentation.label}</span>;
}

function OfferStatusBadge({ status }: { status: Offer['status'] }) {
  const labels: Record<Offer['status'], string> = {
    PENDING: 'Čeka prihvatanje',
    ACCEPTED: 'Prihvaćena',
    REJECTED: 'Nije prihvaćena',
  };
  return <span className={`offer-status offer-status-${status.toLowerCase()}`}>{labels[status]}</span>;
}

function RequestMap({ latitude, longitude }: { latitude: number | null; longitude: number | null }) {
  if (latitude === null || longitude === null) {
    return <p className="request-image-error">Lokacija zahteva nije dostupna, pa mapa ne može da se prikaže.</p>;
  }

  const longitudeOffset = 0.004 / Math.max(Math.cos(latitude * Math.PI / 180), 0.2);
  const latitudeOffset = 0.0025;
  const bounds = [
    longitude - longitudeOffset,
    latitude - latitudeOffset,
    longitude + longitudeOffset,
    latitude + latitudeOffset,
  ].join(',');
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bounds)}&layer=mapnik&marker=${encodeURIComponent(`${latitude},${longitude}`)}`;

  return (
    <div className="request-map">
      <iframe
        title="Mapa lokacije zahteva"
        src={mapUrl}
        loading="lazy"
        referrerPolicy="no-referrer"
      />
      <small>© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a></small>
    </div>
  );
}

function RequestAddress({ latitude, longitude }: { latitude: number | null; longitude: number | null }) {
  const [street, setStreet] = useState('');
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [addressError, setAddressError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setStreet('');
    setAddressError('');
    if (latitude === null || longitude === null) {
      setAddressError('Lokacija zahteva nije dostupna.');
      return () => controller.abort();
    }

    setLoadingAddress(true);
    const query = new URLSearchParams({
      format: 'jsonv2',
      lat: String(latitude),
      lon: String(longitude),
      zoom: '18',
      addressdetails: '1',
    });
    void fetch(`https://nominatim.openstreetmap.org/reverse?${query.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Ulicu trenutno nije moguće pronaći.');
        const result = await response.json() as { address?: Record<string, string> };
        const address = result.address;
        const road = address?.road || address?.pedestrian || address?.footway || address?.residential;
        const streetName = [road, address?.house_number].filter(Boolean).join(' ');
        if (!streetName) throw new Error('Ulica nije pronađena za ovu lokaciju.');
        if (!controller.signal.aborted) setStreet(streetName);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setAddressError(error instanceof Error ? error.message : 'Ulicu trenutno nije moguće pronaći.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingAddress(false);
      });

    return () => controller.abort();
  }, [latitude, longitude]);

  if (loadingAddress) return <p className="request-image-loading" role="status">Pronalazim ulicu...</p>;
  if (addressError) return <p className="request-image-error" role="status">{addressError}</p>;
  return <p>{street} <small>© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a></small></p>;
}

function AuthenticatedImage({ imageUrl, token, className = 'request-image', alt = 'Slika uz zahtev', fallbackText }: { imageUrl: string; token: string; className?: string; alt?: string; fallbackText?: string }) {
  const [source, setSource] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl = '';
    setSource('');
    setFailed(false);

    void fetch(resolveApiUrl(imageUrl), {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Image request failed (${response.status})`);
        const image = await response.blob();
        if (!image.type.startsWith('image/')) throw new Error('Image response is not an image');
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(image);
        setSource(objectUrl);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [imageUrl, token]);

  if (fallbackText !== undefined && (failed || !source)) {
    return <span className={`${className} profile-avatar-placeholder`} aria-label={alt}>{fallbackText}</span>;
  }
  if (failed) return <p className="request-image-error" role="status">Slika trenutno nije dostupna.</p>;
  if (!source) return <p className="request-image-loading" role="status">Učitavanje slike...</p>;
  return <img className={className} src={source} alt={alt} />;
}

export default App;
