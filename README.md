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
