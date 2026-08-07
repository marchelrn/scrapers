# Sistem Manajemen Scrapers BPS

Repositori ini terdiri dari 2 bagian utama:

```
scrapers/
├── backend/     # Aplikasi Go (Gin) API Server & Python Workers
└── frontend/    # Aplikasi React 19 + Vite + Tailwind CSS Web Platform
```

## 🚀 Cara Menjalankan

### 1. Menjalankan Backend (Go Server)
```bash
cd backend
go run main.go
```
* API Server akan berjalan di `http://localhost:8080`

### 2. Menjalankan Frontend (React Platform)
```bash
cd frontend
npm install
npm run dev
```
* Antarmuka Web akan berjalan di `http://localhost:5173`
