# Repository Guidelines

## Project Structure & Module Organization
- `pages/`: Next.js Pages Router routes and page-level UI (`pages/api/` for API handlers).
- `koala/`: Core app logic and shared modules (reader flows, auth helpers, worker, settings, tRPC routes).
- `prisma/`: Prisma schema and migrations (`schema.prisma`, `migrations/`).
- `public/`: Static assets served by Next.js.
- Root config: `next.config.js`, `tsconfig.json`, `.eslintrc.js`, `.prettierrc`.

Keep page concerns in `pages/` and reusable/business logic in `koala/`.

## Build and Development Commands
- This is a containerized setup. We run commands in docker compose as much as possible. Do not assume my local env has the correct vars or tools installed. It does not. Everything runs in the container, including instructions you give me.

## Coding Style & Naming Conventions
- ALWAYS RUN ./tidy.sh WHEN YOU ARE DONE!!!
- Formatting: 2 spaces, semicolons, double quotes, trailing commas (`.prettierrc`).
- Linting: ESLint + `eslint-plugin-no-else-if`; avoid `else if`.
- React components use `PascalCase`.
- Functions and variables use `camelCase`.

## Testing Guidelines
- There is no automated test suite configured in this repository. Don't write tests.

## Commit & Pull Request Guidelines
- Do not commit to git unless instructed to do so.
- Commits and pull requests are for humans.

## Security & Configuration Tips
- Never commit secrets; use `.env` and keep `.env.example` in sync.
- Validate auth/data ownership on server paths (`getServerSideProps`, API routes, tRPC procedures).
- Prefer Prisma `select` to limit serialized data exposure.
