$ErrorActionPreference = 'Stop'

$backendPath = Join-Path $PSScriptRoot 'backend'
$frontendPath = Join-Path $PSScriptRoot 'frontend'

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Docker CLI nije pronadjen. Pokrenite Docker Desktop pa pokusajte ponovo.'
}
if (-not (Get-Command mvn -ErrorAction SilentlyContinue)) {
    throw 'Maven nije pronadjen. Instalirajte Maven i dodajte ga u PATH.'
}
if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    throw 'npm.cmd nije pronadjen. Instalirajte Node.js i pokusajte ponovo.'
}
if (-not (Test-Path (Join-Path $frontendPath 'node_modules'))) {
    throw 'Frontend paketi nisu instalirani. Prvo pokrenite: cd frontend; npm.cmd install'
}

Write-Host 'Pokrecem PostgreSQL bazu...'
& docker compose --project-directory $PSScriptRoot up -d postgres
if ($LASTEXITCODE -ne 0) {
    throw 'Pokretanje PostgreSQL baze nije uspelo. Proverite da li je Docker Desktop pokrenut.'
}

$databaseReady = $false
for ($attempt = 0; $attempt -lt 30; $attempt++) {
    & docker compose --project-directory $PSScriptRoot exec -T postgres pg_isready -U fixhome -d fixhome_db *> $null
    if ($LASTEXITCODE -eq 0) {
        $databaseReady = $true
        break
    }
    Start-Sleep -Seconds 2
}
if (-not $databaseReady) {
    throw 'PostgreSQL se nije pokrenuo u roku od 60 sekundi. Proverite Docker Desktop i logove kontejnera.'
}

Write-Host 'Pokrecem backend i Expo frontend u odvojenim prozorima...'
Start-Process -FilePath 'cmd.exe' -WorkingDirectory $backendPath -ArgumentList '/k', 'mvn spring-boot:run'
Start-Process -FilePath 'cmd.exe' -WorkingDirectory $frontendPath -ArgumentList '/k', 'npm.cmd start'
Write-Host 'Backend i frontend su pokrenuti. Ostavite oba prozora otvorena.'
