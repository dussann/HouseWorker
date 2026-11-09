# FixHome — kontekst projekta

## Šta je aplikacija

FixHome povezuje ljude kojima su potrebne kućne usluge sa majstorima. Korisnik objavljuje zahtev za uslugu, majstori odgovaraju ponudama, korisnik bira ponudu, a po završetku posla može da ostavi ocenu i komentar. Aplikacija je na srpskom jeziku.

## Arhitektura i tehnologije

- `backend/` je modularni monolit: Java 21, Spring Boot 3, Spring MVC/Security, Spring Data JPA/Hibernate i JWT autentifikacija.
- `frontend/` sadrži React Native/Expo aplikaciju za Android/iOS, kao i web UI koji se pokreće preko Vite-a.
- `frontend/src/AppNative.tsx` je glavni mobilni UI; `frontend/src/App.tsx` je web UI.
- Mobilni API klijent je u `frontend/src/api.ts`, a web API klijent u `frontend/src/api.web.ts`.
- Backend domeni su organizovani u `com.fixhome`: `auth`, `user`, `customer`, `craftsman`, `category`, `request`, `offer`, `review` i `web`.
- PostgreSQL je jedina implementirana trajna baza. `docker-compose.yml` definiše lokalni PostgreSQL (`fixhome_db`) i Redis; trenutni backend koristi PostgreSQL, a Redis nije potreban za osnovno pokretanje.
- Flyway migracije su u `backend/src/main/resources/db/migration`. Hibernate koristi `ddl-auto: validate`; promene šeme dodavati kroz novu Flyway migraciju.
- REST API prefiks je `/api/v1`; mobilna i web aplikacija koriste isti backend.

## Uloge i funkcionalnost

- Uloge aplikacije su `CUSTOMER` (korisnik) i `CRAFTSMAN` (majstor); postoji i backend uloga `ADMIN`.
- Registracija traži ime, prezime, email, lozinku i grad; telefon i profilna slika su opcioni. Majstor bira jednu ili više kategorija.
- Ime i prezime su odvojena polja u interfejsu, ali se spajaju u `displayName` pre slanja postojećem backend API-ju. Nemoj menjati ovaj ugovor bez usklađivanja mobilnog klijenta, web klijenta i backend-a.
- Prijava je email-om i lozinkom; backend vraća JWT koji klijenti šalju za zaštićene API pozive. Pri prijavi se bira uloga naloga, a CUSTOMER i CRAFTSMAN su odvojeni nalozi.
- Majstori vide otvorene zahteve filtrirane po kategorijama i gradu i mogu poslati ponudu sa cenom/porukom ili dogovorom na licu mesta.
- Korisnici upravljaju zahtevima i ponudama, prihvataju jednu ponudu i mogu ostaviti recenziju za završen posao.
- Slike se čuvaju na backend serveru; konfiguracija direktorijuma je `UPLOAD_DIR` (podrazumevano `backend/uploads`).
- Push obaveštenja koriste Expo push tokene. Lokacija i mapa koriste dozvole uređaja, OpenStreetMap i mobilni WebView gde je primenljivo.
- Expo aplikacija i APK koriste Spring backend za pristup podacima.

## Kako postupati pri izmenama

- Kod je izvor istine za trenutno implementirano ponašanje. Dokumenti u `Requirements/` mogu opisivati planirano ili nacrtano ponašanje; nemoj pretpostavljati da je svaka specifikacija već implementirana.
- Pre izmene pronađi sve relevantne površine: mobilni UI, web UI, API klijente i backend. Zajedničku funkcionalnost proveri kroz obe aplikacije.
- Zadrži postojeće API ugovore, stilove i poruke na srpskom; ako menjaš ugovor ili ponašanje, ažuriraj povezanu dokumentaciju.
- Ne upisuj lokalne IP adrese, naloge ili tajne u kod. `frontend/.env` je lokalna konfiguracija: sačuvaj postojeće korisničke vrednosti i ne prikazuj ih u dokumentaciji.
- Ne resetuj, briši niti menjaj podatke baze osim kada korisnik to izričito zatraži. Pri brisanju korisničkih/poslovnih podataka sačuvaj referentne kategorije i Flyway istoriju.

## Lokalni razvoj

Detaljna uputstva i pravila za telefon su u [README.md](./README.md); tu dokumentaciju održavati ažurnom kad se menjaju komande ili podešavanja.

- Baza: iz korena `docker compose up -d postgres`.
- Backend: iz `backend/` pokrenuti `mvn spring-boot:run`; API je na `http://localhost:8080/api/v1`.
- Frontend: iz `frontend/` pokrenuti `npm.cmd install` (prvi put), zatim `npm.cmd start` za Expo ili `npm.cmd run dev` za Vite web.
- Windows može pokrenuti bazu, backend i Expo zajedno komandom `powershell -ExecutionPolicy Bypass -File .\start-dev.ps1` iz korena.
- Fizički telefon mora moći da pristupi backend-u preko Wi-Fi/LAN adrese računara, porta `8080`; Android emulator koristi `10.0.2.2`, a iOS simulator `localhost`.
- `frontend/.env` je lokalna konfiguracija i ne prepisivati ga bez potrebe. Promena Expo env vrednosti zahteva restart Metro-a; za već instalirani APK potreban je novi build.
- Android EAS build komande su definisane u `frontend/package.json`; `npm.cmd run build:android` pravi preview APK.

## Provere i smernice

- Frontend tipovi: iz `frontend/` pokrenuti `npm.cmd run typecheck`.
- Backend testovi: iz `backend/` pokrenuti `mvn test`.
- Sačuvati odvojene mobilni i web tokove kada se menja zajednička funkcionalnost; proveriti oba klijenta i odgovarajući API tok.
- Pratiti postojeće obrasce, tipove i nazive na srpskom. Ne menjati mrežne adrese, uloge ili tok autentifikacije bez provere postojećeg podešavanja.
- Destruktivne operacije nad bazom mogu obrisati korisnike i poslovne podatke; ne izvršavati ih bez izričitog zahteva korisnika.

## Dodatna dokumentacija

- [Poslovni zahtevi](./Requirements/02-business-requirements.md)
- [Arhitektura sistema](./Requirements/03-system-architecture.md.txt)
- [Domenski model](./Requirements/04-domain-model.txt)
- [Dizajn baze](./Requirements/05-database-design.txt)
- Ostale specifikacije, bezbednosni dizajn i roadmap nalaze se u [Requirements/](./Requirements/).
