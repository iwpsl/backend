# backend

## Prerequisites
- Linux, use WSL if on Windows
- Docker Daemon (Docker Desktop on Windows)
- VSCode

## Setup
1. Clone the repo (in WSL if on Windows)
2. Open the repo in VSCode
3. In VSCode, reopen in container
4. Wait for it to build the image
5. Install dependencies, `pnpm i`
6. Generate prisma client `pnpm gen:orm`
7. Generate routes, `pnpm gen:routes`
8. Start database service, `pnpm db:up`
9. Migrate database, `pnpm db:migrate`
10. Seed database, `pnpm db:seed`
redis-server
11. In another terminal, run the server `pnpm dev`
12. To inspect the database, run `pnpm db:serve`
