import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import './App.css';
import { apiFetch, resolveApiUrl } from './api.web';
import { getRequestStatusPresentation } from './requestStatus';

type AuthMode = 'login' | 'register';
type Role = 'CUSTOMER' | 'CRAFTSMAN';
type User = { email: string; role: string; city?: string };
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
  imageUrl: string;
};
type AuthForm = { email: string; password: string; phone: string; role: Role; city: string; categoryIds: number[] };

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
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [token, setToken] = useState<string>(localStorage.getItem('fixhome_token') || '');
  const [user, setUser] = useState<User | null>(getStoredUser);
  const [categories, setCategories] = useState<Category[]>([]);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
  const [selectedJob, setSelectedJob] = useState<CraftsmanRequestDetails | null>(null);
  const [editForm, setEditForm] = useState<RequestForm>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState<RequestForm>(emptyForm);
  const [authForm, setAuthForm] = useState<AuthForm>({
    email: 'test@gmail.com',
    password: '123',
    phone: '+38160000000',
    role: 'CUSTOMER',
    city: '',
    categoryIds: [],
  });
  const [citySearch, setCitySearch] = useState('');
  const [detectingCity, setDetectingCity] = useState(false);
  const [notificationCities, setNotificationCities] = useState<string[]>([]);
  const [notificationCityInput, setNotificationCityInput] = useState('');
  const [savingNotificationCities, setSavingNotificationCities] = useState(false);

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
      void apiFetch<{ cities: string[] }>('/craftsmen/profile/notifications')
        .then((preferences) => setNotificationCities(preferences.cities))
        .catch((preferencesError: unknown) => setError(getErrorMessage(preferencesError)));
    }
  }, [token, userRole]);

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
      setAuthForm((current) => ({ ...current, city }));
    } catch (locationError) {
      setError(getErrorMessage(locationError));
    } finally {
      setDetectingCity(false);
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

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const endpoint = authMode === 'login' ? '/auth/login' : '/auth/register';
      const payload = authMode === 'login'
        ? { email: authForm.email, password: authForm.password, role: authForm.role }
        : {
            email: authForm.email,
            password: authForm.password,
            phone: authForm.phone,
            role: authForm.role,
            city: authForm.city,
            categoryIds: authForm.role === 'CRAFTSMAN' ? authForm.categoryIds : [],
          };
      const data = await apiFetch<{ accessToken?: string; token?: string; email: string; role?: string; city?: string }>(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const authToken = data.accessToken || data.token;

      if (!authToken) throw new Error('Authentication token was not returned');

      const nextUser: User = { email: data.email, role: data.role || authForm.role, city: data.city || authForm.city };
      localStorage.setItem('fixhome_token', authToken);
      localStorage.setItem('fixhome_user', JSON.stringify(nextUser));
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
    setAuthMode(mode);
    setError('');
    setSuccess('');
  }

  function updateRequestForm(event: InputChange) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function logout() {
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
    <div className="app-shell">
      <header className="topbar">
        <div><p className="eyebrow">FixHome</p><h1>Marketplace za usluge</h1></div>
        {token && <button className="secondary" onClick={logout} type="button">Odjava</button>}
      </header>

      {!token ? (
        selectedRole === null ? (
          <main className="welcome-page">
            <section className="welcome-hero">
              <div className="welcome-copy">
                <p className="welcome-eyebrow">DOBRO DOŠLI U FIXHOME</p>
                <h2 className="welcome-title">Sve za vaš dom. Na jednom mestu.</h2>
                <p className="welcome-description">Pronađite pouzdanog majstora ili povežite svoje veštine sa novim poslovima.</p>
                <div className="welcome-promise"><span aria-hidden="true">✓</span> Jednostavno · Lokalno · Pouzdano</div>
              </div>
              <div className="welcome-art" aria-hidden="true">
                <span className="welcome-art-sun" />
                <svg viewBox="0 0 220 180" role="presentation">
                  <path d="M36 91 110 32l74 59v70H36V91Z" fill="#F8F4E9" />
                  <path d="M22 92 110 22l88 70" fill="none" stroke="#E7B75A" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M91 161v-48h38v48" fill="#D66C4E" />
                  <path d="M54 105h25v25H54zM141 105h25v25h-25z" fill="#B9DAD0" />
                  <path d="M13 164h194" stroke="#A5C5B7" strokeWidth="8" strokeLinecap="round" />
                </svg>
                <span className="welcome-art-spark">✦</span>
              </div>
            </section>
            <section className="role-picker" aria-labelledby="role-picker-title">
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
        <main className="card-grid">
          <section className="card auth-card">
            <button className={`role-back ${selectedRole === 'CRAFTSMAN' ? 'role-back-craftsman' : 'role-back-customer'}`} type="button" onClick={showRolePicker}>← Nazad</button>
            <div className="chosen-role">
              <span className="chosen-role-mark">{selectedRole === 'CUSTOMER' ? 'K' : 'M'}</span>
              <span><small>NASTAVLJATE KAO</small><strong>{selectedRole === 'CUSTOMER' ? 'Korisnik' : 'Majstor'}</strong></span>
            </div>
            <form onSubmit={handleAuthSubmit} className="stack form">
              <label>Email<input name="email" value={authForm.email} onChange={updateAuthForm} type="email" required /></label>
              <label>Lozinka<input name="password" value={authForm.password} onChange={updateAuthForm} type="password" required /></label>
              {authMode === 'register' && <>
                <label>Telefon<input name="phone" value={authForm.phone} onChange={updateAuthForm} type="tel" /></label>
                <label>Grad<input name="city" value={authForm.city} onChange={updateAuthForm} type="text" autoComplete="address-level2" maxLength={120} required /></label>
                <button className="secondary" type="button" disabled={detectingCity} onClick={() => void detectRegistrationCity()}>{detectingCity ? 'Prepoznajem grad...' : 'Prepoznaj grad po lokaciji'}</button>
                <small className="location-attribution">Automatsko prepoznavanje koristi OpenStreetMap. Grad možete uneti ili izmeniti ručno.</small>
                {authForm.role === 'CRAFTSMAN' && <fieldset className="category-checkboxes">
                  <legend>Kategorije usluga</legend>
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
                !authForm.city.trim() || (authForm.role === 'CRAFTSMAN' && authForm.categoryIds.length === 0)
              ))}>{loading ? '...' : authMode === 'login' ? 'Prijavi se' : 'Registruj se'}</button>
            </form>
          </section>
        </main>
        <nav className="auth-bottom-nav" aria-label="Prijava i registracija">
          <button type="button" className={authMode === 'login' ? 'active' : ''} onClick={() => changeAuthMode('login')} aria-current={authMode === 'login' ? 'page' : undefined}>
            <span aria-hidden="true">↪</span>Prijava
          </button>
          <button type="button" className={authMode === 'register' ? 'active' : ''} onClick={() => changeAuthMode('register')} aria-current={authMode === 'register' ? 'page' : undefined}>
            <span aria-hidden="true">＋</span>Registracija
          </button>
        </nav>
        </div>
        )
      ) : (
        <main className="card-grid">
          <section className="card"><h2>Profil</h2><div className="profile-box"><span>Email</span><strong>{user?.email}</strong><span>Uloga</span><strong>{userRole}</strong><span>Grad</span><strong>{user?.city || 'Nije unet'}</strong></div>{userRole === 'CRAFTSMAN' && <div className="notification-preferences"><h3>Obaveštenja za nove poslove</h3><p>Dobijaj obaveštenja za poslove u izabranim gradovima i kategorijama tvojih usluga.</p>{notificationCityOptions.map((city) => <label className="notification-city-option" key={city.toLowerCase()}><input type="checkbox" checked={notificationCities.some((selected) => selected.toLowerCase() === city.toLowerCase())} onChange={() => toggleNotificationCity(city)} /><span>{city}</span></label>)}<label>Dodaj drugi grad<input value={notificationCityInput} onChange={(event) => setNotificationCityInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addNotificationCity(); } }} maxLength={120} placeholder="Unesite naziv grada" /></label><button className="secondary" type="button" onClick={addNotificationCity}>Dodaj grad</button><button className="primary" type="button" disabled={savingNotificationCities} onClick={() => void saveNotificationCities()}>{savingNotificationCities ? 'Čuvam...' : 'Sačuvaj gradove'}</button><small>Push obaveštenja uključite u FixHome mobilnoj aplikaciji.</small></div>}</section>
          {selectedRequest ? (
            <section className="card wide">
              <button className="back-button" type="button" onClick={() => setSelectedRequest(null)}>‹ Nazad na zahteve</button>
              <h2>Pregled zahteva</h2>
              <RequestStatusBadge status={selectedRequest.status} />
              <form onSubmit={saveRequestDetails} className="stack form">
                <label>Kategorija<select name="categoryId" value={editForm.categoryId} onChange={updateEditForm} required disabled={!canSubmitRequest}><option value="">Izaberite kategoriju</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
                <label>Slika problema (URL)<input name="imageUrl" value={editForm.imageUrl} onChange={updateEditForm} type="text" disabled={!canSubmitRequest} /></label>
                {selectedRequest.imageUrl && <AuthenticatedRequestImage imageUrl={selectedRequest.imageUrl} token={token} />}
                <label>Opis problema<textarea name="description" value={editForm.description} onChange={updateEditForm} rows={4} required disabled={!canSubmitRequest} /></label>
                <button className="primary" type="submit" disabled={loading || !canSubmitRequest}>{loading ? 'Čuvam...' : 'Sačuvaj izmene'}</button>
              </form>
            </section>
          ) : selectedJob ? (
            <section className="card wide">
              <button className="back-button" type="button" onClick={() => setSelectedJob(null)}>‹ Nazad na poslove</button>
              <h2>{selectedJob.categoryName}</h2>
              <RequestStatusBadge status={selectedJob.status} />
              <p className="request-city">Grad: {selectedJob.city || 'Nije naveden'}</p>
              <div className="job-street">
                <strong>Ulica</strong>
                <RequestAddress latitude={selectedJob.latitude} longitude={selectedJob.longitude} />
              </div>
              {selectedJob.imageUrl && <AuthenticatedRequestImage imageUrl={selectedJob.imageUrl} token={token} />}
              <h3>Opis problema</h3>
              <p>{selectedJob.description}</p>
              <h3>Lokacija zahteva</h3>
              <RequestMap latitude={selectedJob.latitude} longitude={selectedJob.longitude} />
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
                {requests.length === 0 ? <p>Nema zahteva.</p> : <div className="request-list">{requests.map((request) => <article key={request.id} className="request-item"><button className="job-card-open" type="button" onClick={() => void openJobDetails(request.id)} disabled={userRole !== 'CRAFTSMAN' || loading} aria-label={`Pregledaj zahtev: ${request.categoryName}`}><span className="request-header"><strong>{request.categoryName}</strong><RequestStatusBadge status={request.status} /></span>{userRole === 'CRAFTSMAN' && <span className="request-city">Grad: {request.city || 'Nije naveden'}</span>}<span className="request-summary">{request.description}</span></button>{request.imageUrl && <AuthenticatedRequestImage imageUrl={request.imageUrl} token={token} />}<div className="request-actions">{canSubmitRequest && <button className="review-request" type="button" disabled={loading} onClick={() => void openRequest(request.id)}>Pregledaj zahtev</button>}{canSubmitRequest && <button className="delete-request" type="button" disabled={loading} onClick={() => void handleDeleteRequest(request.id)}>Obriši zahtev</button>}</div></article>)}</div>}
              </section>
            </>
          )}
        </main>
      )}

      {(error || success) && <div className={`message ${error ? 'error' : 'success'}`}>{error || success}</div>}
    </div>
  );
}

function RequestStatusBadge({ status }: { status: string }) {
  const presentation = getRequestStatusPresentation(status);
  return <span className={`badge badge-${presentation.tone}`} aria-label={`Status zahteva: ${presentation.label}`}>{presentation.label}</span>;
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

function AuthenticatedRequestImage({ imageUrl, token }: { imageUrl: string; token: string }) {
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

  if (failed) return <p className="request-image-error" role="status">Slika trenutno nije dostupna.</p>;
  if (!source) return <p className="request-image-loading" role="status">Učitavanje slike...</p>;
  return <img className="request-image" src={source} alt="Slika uz zahtev" />;
}

export default App;
