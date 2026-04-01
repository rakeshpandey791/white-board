# Real-Time Whiteboard Collaboration Tool

Production-grade whiteboard collaboration scaffold with React + Redux Toolkit + Konva frontend and Spring Boot + PostgreSQL + Redis backend.

## Folder Structure

```
.
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   ├── board/
│   │   │   ├── canvas/
│   │   │   └── presence/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── store/
│   │   ├── utils/
│   │   └── __tests__/
│   └── Dockerfile
├── backend/
│   ├── src/main/java/com/whiteboard/collab/
│   │   ├── auth/
│   │   ├── board/
│   │   ├── collaboration/
│   │   ├── config/
│   │   ├── common/
│   │   └── user/
│   ├── src/main/resources/application.properties
│   └── Dockerfile
├── infra/nginx/default.conf
└── docker-compose.yml
```

## Implemented Features

- JWT auth (`/api/auth/signup`, `/api/auth/login`)
- Board APIs (`/api/boards`, `/api/boards/{id}`, share + persistence)
- Konva canvas with tools: select, pencil, rect, circle, line, text, eraser
- Infinite workspace behavior via pan + zoom
- Real-time collaboration with STOMP over WebSocket
- Cursor presence updates
- LWW conflict policy via `updatedAt` timestamps
- Redis pub/sub fan-out for multi-instance WebSocket scaling
- Autosave with debounce
- Undo/redo stack in `canvasSlice`

## Frontend Architecture

### Redux Slices
- `authSlice`: login/signup state + token lifecycle
- `boardSlice`: boards, active board metadata, autosave state
- `canvasSlice`: normalized shape store + tool + history + viewport
- `presenceSlice`: active users + cursor positions

### Realtime Flow
1. User draws on canvas
2. Local optimistic update to Redux store
3. Publish `DRAW_EVENT` to `/app/board/draw`
4. Backend applies LWW and publishes through Redis
5. All instances broadcast to `/topic/board/{id}`
6. Clients reconcile into store

## Backend Architecture

### Main Modules
- `auth`: signup/login and JWT token issuance
- `board`: board CRUD, sharing permissions, board element persistence
- `collaboration`: WebSocket/STOMP handlers and Redis event fan-out

### Core Entities
- `UserEntity`
- `BoardEntity`
- `BoardMemberEntity`
- `BoardElementEntity` (JSON payload per shape)

### WebSocket Contracts
- Endpoint: `/ws`
- App destinations:
  - `/app/board/draw`
  - `/app/board/cursor`
- Topics:
  - `/topic/board/{id}`
  - `/topic/board/{id}/cursor`

## Local Setup

## 1) Frontend
```bash
cd frontend
npm install
npm run dev
```

## 2) Backend
```bash
cd backend
mvn spring-boot:run
```

## 3) Infra (optional, full stack)
```bash
docker compose up --build
```

## Deployment (Free) - Detailed

This project supports two deployment models:

1. **Single-domain (recommended):** build frontend and serve it from Spring Boot backend on Render.  
2. **Split-domain:** frontend on Cloudflare Pages, backend on Render.

Both are free-friendly.

### Prerequisites

- GitHub repo for this project
- Render account
- Neon account (PostgreSQL)
- Upstash account (Redis) OR disable Redis via `REDIS_ENABLED=false`

---

### Step A - Prepare Backend Environment Variables

`backend/src/main/resources/application.properties` already supports env-based config:

- `DB_URL`, `DB_USER`, `DB_PASSWORD`
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_SSL`, `REDIS_ENABLED`
- `APP_JWT_SECRET`, `JWT_EXP_MINUTES`
- `CORS_ALLOWED_ORIGINS`
- `PORT`

Generate JWT secret:

```bash
openssl rand -base64 48
```

Example production values:

```env
DB_URL=jdbc:postgresql://ep-xxxx.ap-southeast-1.aws.neon.tech/whiteboard?sslmode=require
DB_USER=whiteboard_owner
DB_PASSWORD=your_db_password

REDIS_ENABLED=true
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
REDIS_SSL=true

APP_JWT_SECRET=your_long_random_secret
JWT_EXP_MINUTES=120
SEED_USERS=false
CORS_ALLOWED_ORIGINS=https://whiteboard-frontend.pages.dev
```

---

### Step B - Create Free PostgreSQL (Neon)

1. Create Neon project.
2. Create DB (for example `whiteboard`).
3. Copy connection info.
4. Build JDBC URL:

```text
jdbc:postgresql://<host>/<database>?sslmode=require
```

---

### Step C - Create Free Redis (Upstash or Render Key Value)

If using Upstash:

```env
REDIS_ENABLED=true
REDIS_HOST=<upstash_host>
REDIS_PORT=6379
REDIS_PASSWORD=<upstash_password>
REDIS_SSL=true
```

If you do not need multi-instance pub-sub yet:

```env
REDIS_ENABLED=false
```

---

### Option 1 (Recommended): Single-domain Deploy on Render

This avoids CORS and websocket origin issues.

#### 1. Render Web Service

- Runtime: `Java`
- Root directory: `backend`
- Build command:

```bash
cd ../frontend && npm ci && npm run build && cd ../backend && rm -rf src/main/resources/static/* && cp -R ../frontend/dist/* src/main/resources/static/ && mvn -DskipTests clean package
```

- Start command:

```bash
java -Dserver.port=$PORT -jar target/whiteboard-backend-0.0.1-SNAPSHOT.jar
```

#### 2. Render Environment Variables

Set:

```env
DB_URL=jdbc:postgresql://<neon-host>/<db>?sslmode=require
DB_USER=<db-user>
DB_PASSWORD=<db-password>

REDIS_ENABLED=false
# or set REDIS_* values if you want pub-sub

APP_JWT_SECRET=<long-random-secret>
JWT_EXP_MINUTES=120
SEED_USERS=false
CORS_ALLOWED_ORIGINS=*
```

#### 3. Verify

- Open Render URL
- Signup/Login
- Create board
- Open same board in 2 tabs/users and validate collaboration

---

### Option 2: Split Deploy (Frontend Cloudflare Pages + Backend Render)

Use this if you want independent frontend deploys.

#### 1. Backend on Render

- Root directory: `backend`
- Build command:

```bash
mvn -DskipTests clean package
```

- Start command:

```bash
java -Dserver.port=$PORT -jar target/whiteboard-backend-0.0.1-SNAPSHOT.jar
```

Backend env example:

```env
DB_URL=jdbc:postgresql://<neon-host>/<db>?sslmode=require
DB_USER=<db-user>
DB_PASSWORD=<db-password>
REDIS_ENABLED=false
APP_JWT_SECRET=<long-random-secret>
CORS_ALLOWED_ORIGINS=https://whiteboard-frontend.pages.dev
```

#### 2. Frontend on Cloudflare Pages

Frontend now supports env-based backend URLs.

Create `frontend/.env.production`:

```env
VITE_API_BASE_URL=https://whiteboard-backend.onrender.com/api
VITE_WS_ENDPOINT=https://whiteboard-backend.onrender.com/ws
```

Build locally:

```bash
cd frontend
npm ci
npm run build
```

Deploy `frontend/dist` to Cloudflare Pages (or connect repo build command `npm run build`, output `dist`).

---

### ENOTFOUND `red-...` Troubleshooting

If logs show:

```text
getaddrinfo ENOTFOUND red-xxxxxxxx
```

It means a process is trying to resolve a **private Render Redis hostname** from outside that private network.

Fix:

1. If that service does not need Redis -> set `REDIS_ENABLED=false`.
2. If it needs Redis outside Render private network -> use external Redis host (not `red-...`).
3. If inside Render private network -> backend + Redis must be in same workspace and region.

Note: errors with `node:dns` come from a Node process, not Spring Boot.

## Testing

### Frontend
```bash
cd frontend
npm test
```

### Backend
```bash
cd backend
mvn test
```

## Scalability Notes

- Redis pub/sub is used to distribute draw/cursor events across backend instances.
- Any instance can accept WebSocket connections; updates remain consistent through shared channels.
- Nginx reverse proxy routes HTTP and WebSocket traffic.
- Stateful data stays in PostgreSQL; transient fan-out is in Redis.

## Bonus Extensions (Design-Ready)

- CRDT-lite: add per-element operation IDs + tombstones for merges
- Export board as PNG/PDF via Konva stage serialization
- Sticky notes as additional shape type
- Version history with append-only board events table
