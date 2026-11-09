# FixHome

FixHome je platforma koja povezuje korisnike kojima su potrebne kućne usluge sa majstorima koji ih pružaju. Korisnici mogu da objave zahtev za uslugu, a majstori da pošalju ponude.

Projekat se sastoji od:

- **Backend-a** — Java 21, Spring Boot i PostgreSQL.
- **Mobilne aplikacije** — React Native i Expo, za Android i iOS.

## Potrebni alati

- Java 21
- Maven
- Node.js i npm
- Docker Desktop sa Docker Compose

## Pokretanje lokalno

### 1. Pokrenite bazu podataka

Iz korenskog direktorijuma projekta pokrenite PostgreSQL:

```powershell
docker compose up -d postgres
```

Lokalna konfiguracija baze je već definisana u `docker-compose.yml`. Backend koristi bazu `fixhome_db` na portu `5432`.

### 2. Pokrenite backend

Otvorite terminal u korenskom direktorijumu projekta i pokrenite:

```powershell
cd backend
mvn spring-boot:run
```

Backend će biti dostupan na `http://localhost:8080`, a API-jevi koriste prefiks `/api/v1`. Migracije baze se izvršavaju automatski pri pokretanju.

### 3. Pokrenite mobilnu aplikaciju

Otvorite drugi terminal i pokrenite:

```powershell
cd frontend
npm.cmd install
npm.cmd start
```

Skenirajte QR kod aplikacijom Expo Go na telefonu. Za Android emulator možete pritisnuti `a` u terminalu u kojem radi Expo. iOS simulator zahteva macOS i Xcode.

### Pokretanje svega jednom skriptom (Windows)

Kada su Docker Desktop i frontend paketi spremni (`cd frontend; npm.cmd install` — potrebno je samo prvi put), iz korenskog direktorijuma pokrenite:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-dev.ps1
```

Skripta pokreće PostgreSQL, sačeka da baza bude spremna, a zatim otvara odvojene prozore za backend i Expo frontend. Ostavite oba prozora otvorena; ako su backend ili Expo već pokrenuti, zaustavite ih pre pokretanja skripte.

### Instaliranje Android aplikacije sa ikonicom

Projekat je podešen da napravi instalacioni APK sa FixHome ikonicom. Za izradu je potreban Expo/EAS nalog:

```powershell
cd frontend
npx eas-cli login
npx eas-cli build:configure
```

Development i preview APK build profili koriste `http://192.168.1.6:8080/api/v1` kao trenutnu Wi-Fi/LAN adresu ovog računara. Telefon mora biti na istoj mreži kao računar, backend mora biti pokrenut, a firewall mora dozvoliti dolazne konekcije na portu `8080`. Koristite Wi-Fi/LAN IP računara, a ne IP virtuelnog WSL adaptera. Ako se IP adresa promeni, ažurirajte `EXPO_PUBLIC_API_URL` u `frontend/eas.json` ili podesite je u EAS okruženju **preview**. Za produkciju obavezno podesite produkcionu adresu kojoj telefon može da pristupi (preporučuje se javno dostupan HTTPS backend). Zatim pokrenite:

```powershell
npm.cmd run build:android
```

Android APK build možete pokrenuti u novom terminalu dok aplikacija radi lokalno u Expo Go; build neće prekinuti postojeći Expo/Metro server. Ostavite terminal sa lokalnom aplikacijom otvoren. Ako ste promenili `.env` i želite da se nove vrednosti koriste i lokalno, restartujte Expo server.

Kada se build završi, otvorite EAS link na telefonu, preuzmite APK i potvrdite instalaciju kada Android zatraži dozvolu za instaliranje aplikacija iz tog izvora. FixHome će se pojaviti u listi aplikacija; prevucite njegovu ikonicu na početni ekran ako želite prečicu tamo. APK ne pokreće backend na računaru; backend mora biti dostupan telefonu i dok koristite aplikaciju.

U obrascu za novi zahtev korisnik može da fotografiše problem ili izabere postojeću sliku iz telefona. Slike se čuvaju na backend-u u direktorijumu `backend/uploads` (ili u direktorijumu zadatom promenljivom `UPLOAD_DIR`), uz ograničenje od 5 MB po slici. Lokacija uređaja se automatski čuva uz zahtev nakon što korisnik dozvoli pristup lokaciji i uključi lokacijske usluge; koordinate se ne prikazuju direktno. Kada majstor otvori detalje otvorenog zahteva, aplikacija prikazuje prepoznatu ulicu i mapu na osnovu koordinata (OpenStreetMap). Korisnik može da obriše svoj zahtev; brisanjem se uklanjaju i ponude povezane sa njim. U pregledaču je za pristup lokaciji potreban HTTPS ili `localhost`.

Pri registraciji korisnik i majstor unose ime i prezime, a mogu da dodaju i profilnu sliku do 5 MB. Unose i grad; mobilna aplikacija može da ga predloži na osnovu lokacije, a u pregledaču se za to koristi OpenStreetMap Nominatim. Predlog se može ručno izmeniti. Majstori biraju jednu ili više kategorija usluga, a otvoreni zahtevi se filtriraju prema izabranim kategorijama i gradu. Majstori mogu da pretražuju poslove u drugom gradu, a mapu u detaljima zahteva otvara ugrađeni WebView.

Majstor može da konkuriše za otvoren posao sa opcionom porukom i cenom ili da izabere dogovor na licu mesta. Ponuda se prikazuje korisniku u detaljima zahteva. U mobilnoj aplikaciji korisnik može da uključi push obaveštenja za nove ponude u profilu; potrebna je instalirana FixHome aplikacija (push nije podržan u Expo Go).

Majstor u tabu „Ocene”, pored tabova „Zahtevi” i „Profil”, vidi prosek, komentare i ocenjene završene poslove. Nakon završetka posla majstor čija je ponuda prihvaćena može jednom da oceni korisnika i opciono ostavi komentar. Korisnik svoje ocene vidi u tabu „Ocene”. Svi prijavljeni korisnici i majstori mogu da vide ocene i komentare: ocene korisnika u detaljima njegovog zahteva, a ocene majstora u detaljima njegove ponude. To uključuje i ranije ocene majstora. Kontakt podaci i opisi poslova nisu deo pregleda ocena.

Pri prijavi se bira uloga naloga. Nalog registrovan kao korisnik prijavljuje se kao korisnik, a majstorski nalog kao majstor. Za prelazak na drugi nalog prvo se odjavite; svaka uloga mora da ima svoj nalog.

Pri izboru uloge i svakom otvaranju kartice za prijavu ili registraciju obrazac se prazni, uključujući izabranu sliku i kategorije. Pregledač ili menadžer lozinki može nezavisno ponuditi automatsko popunjavanje.

### Povezivanje sa telefona

Emulatori su unapred podešeni da pristupe backend-u na računaru:

- Android emulator koristi `10.0.2.2`.
- iOS simulator koristi `localhost`.

Za fizički telefon napravite `frontend/.env` i postavite LAN IP adresu računara:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.6:8080/api/v1
```

Ako se Wi-Fi/LAN IP adresa računara promeni, zamenite `192.168.1.6` novom adresom. Telefon i računar moraju biti na istoj mreži, a firewall mora dozvoliti dolazne konekcije na portu `8080`.
