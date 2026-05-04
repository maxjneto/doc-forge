# DocForge

AI-powered document generation platform.

## Structure

```
docforge/
├── packages/
│   ├── frontend/     # React + Vite + TailwindCSS
│   └── backend/      # FastAPI + SQLAlchemy + Inngest
├── docs/             # Project documentation
├── docker-compose.yml
└── package.json      # Monorepo root (npm workspaces)
```

## Prerequisites

- Node.js >= 20
- Python >= 3.11
- Docker & Docker Compose
- PostgreSQL (via Docker or local)

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Start infrastructure

```bash
npm run infra:up
```

### 3. Setup backend

```bash
cd packages/backend
python -m venv .venv
.venv/Scripts/activate  # Windows
pip install -e ".[dev]"
cp .env.example .env    # Edit with your keys
npm run db:migrate
```

### 4. Run development servers

```bash
# Terminal 1 - Frontend
npm run dev:frontend

# Terminal 2 - Backend
npm run dev:backend
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start frontend dev server |
| `npm run dev:frontend` | Start frontend dev server |
| `npm run dev:backend` | Start backend dev server |
| `npm run build` | Build frontend for production |
| `npm run db:up` | Start PostgreSQL container |
| `npm run db:migrate` | Run database migrations |
| `npm run infra:up` | Start all infrastructure (DB + Inngest) |

## Ports

| Service | Port | URL |
|---------|------|-----|
| Frontend | 5173 | http://localhost:5173 |
| Backend | 8000 | http://localhost:8000 |
| PostgreSQL | 5480 | localhost:5480 |
| Inngest Dev Server | 8288 | http://localhost:8288 |
