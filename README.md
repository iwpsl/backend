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
6. Generate prisma client `prisma generate`
7. Generate routes, `pnpm genroutes`
8. Start database service, `devenv up`
9. Migrate database, `prisma migrate deploy`
10. Seed database, `prisma db seed`
11. In another terminal, run the server `pnpm dev`
12. To inspect the database, run `prisma studio`
