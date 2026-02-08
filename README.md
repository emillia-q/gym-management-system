## Instrukcja uruchomienia projektu

Postępuj zgodnie z poniższymi krokami, aby poprawnie skonfigurować środowisko i uruchomić aplikację.

### 1. Pobranie repozytorium
Pobierz kod na swój dysk lokalny:
cd <Ścieżka do miejsca w którym chcesz trzymać projekt>
git clone <URL_REPOZYTORIUM>

### 2. Wymagania wstępne
Zainstaluj Docker Desktop:  https://www.docker.com/

Zainstaluj Node.js z linku:  https://nodejs.org/en/blog/release/v20.9.0

Zalecane środowisko (IDE): Visual Studio Code:  https://code.visualstudio.com/download

Upewnij się, że masz zainstalowanego Pythona (zalecana wersja 3.8+).

### 3. Instalacja bibliotek Python
W terminalu (najlepiej wewnątrz wirtualnego środowiska) wykonaj komendę:

pip install fastapi uvicorn sqlalchemy psycopg2-binary python-dotenv

### 4. Konfiguracja zmiennych środowiskowych (.env)
W głównym katalogu projektu (tam, gdzie znajduje się plik docker-compose.yml) utwórz plik o nazwie .env.

[!IMPORTANT] Plik musi nazywać się dokładnie .env. Upewnij się, że jest on dodany do pliku .gitignore !!!

Wklej do pliku .env następującą treść:

# Data for Docker
DB_USER=admin
DB_PASSWORD=gym666
DB_NAME=gym_management_system
# Data for Python (link to connect)
DATABASE_URL=postgresql://admin:gym666@localhost:5432/gym_management_system 


### 5. Uruchomienie bazy danych (Docker)
Aby zbudować i uruchomić kontener z bazą danych w tle, wpisz w terminalu:

docker-compose up -d

### 6. Uruchomienie serwera aplikacji
Gdy kontener Docker już działa, odpal serwer FastAPI komendą:

uvicorn backend.main:app --reload

### 7. Uruchomienie aplikacji
W terminalu w którym masz otwarty projekt upewnij się że jesteś w katalogu swojego projektu, jeśli nie zrób: 

cd <NAZWA_KATALOGU_PROJEKTU>

Następnie: 

cd frontend

npm install (wykonywane jednorazowo przy pierwszym uruchomieniu programu)

npm run dev

Aplikację znajdziesz pod stroną: http://localhost:5173/

Dokumentacja API (Swagger): http://localhost:8000/docs