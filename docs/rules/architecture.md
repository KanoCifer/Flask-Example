# Architecture

> 架构决策记录见 `docs/adr/`：

## Overview

- Backend: FastAPI + PostgreSQL + MongoDB + Redis + Go
- Desktop: Vue 3.5 (`frontend/`) + Vite 8 + Tailwind CSS v4 + Pinia 3
- Mobile: React 19 (`react-app/`) + Vite 8 + Tailwind CSS v4 + Zustand 5
- Domain terms: see [domain.md](domain.md)

## Dual-Frontend

`src/` 采用 **features/ 按业务域聚合**

## Data Layer

- **PostgreSQL** (asyncpg): core relational data — users, profiles, subscriptions, devices
- **MongoDB** (Beanie): document data — posts, RSS articles, moments, changelogs, fishing records, dev tasks, friend links
- **Redis 8**: caching (`@redis_cache` decorator), sessions, visitor tracking, distributed locks
- **RabbitMQ** (Taskiq): async task queue — RSS refresh, email, boot notifications, log persistence

## Backend Layering

`api -> service -> repository`

## API Conventions

- **Response format**: unified `APIResponse(message, data)` envelope
- **Auth**: JWT (24h access + 7d refresh) + SameSite Cookie (CSRF removed in favor of SameSite)
