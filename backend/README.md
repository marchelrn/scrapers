# Basic Go MVC Template

Template MVC dasar untuk Go, tanpa isi project lama.

## Struktur

- `handler/` HTTP handler (controller)
- `service/` business logic
- `repository/` data access
- `routes/` route registration
- `config/` app config
- `internal/` bootstrap server/database
- `contract/` interface between layer

## Quick Start

1. Rename module dan import path:

```bash
./init_template.sh github.com/username/nama-project
```

2. Siapkan environment:

```bash
cp .env.example .env  
```

3. Jalankan aplikasi:

```bash
go run main.go
```

4. Test endpoint:

```bash
curl http://localhost:8080/health
```