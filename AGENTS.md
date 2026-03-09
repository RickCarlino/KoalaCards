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
- Due-card reminder emails are checked by the `worker` service (`koala/worker/`).

## Coding Style & Naming Conventions
- ALWAYS RUN ./tidy.sh WHEN YOU ARE DONE!!!
- Formatting: 2 spaces, semicolons, double quotes, trailing commas (`.prettierrc`).
- Linting: ESLint + `eslint-plugin-no-else-if`; avoid `else if`.
- React components use `PascalCase`.
- Functions and variables use `camelCase`.
- We have a special AI wrapper library for making LLM calls.

## User-Facing Copy
- Everything users read must directly help them use the app.
- Less copy is better. Do not explain how every aspect of the app works.
- Avoid redundant phrasing.
- For toggles, describe the user-visible rule in plain language.
- Match nearby UI copy length and tone before writing new text.
- Never talk about implementation details on user-facing UIs.
- Any time you update user-facing text, load the copy-clarity skill guidance.

## Testing Guidelines
- There is no automated test suite configured in this repository. Don't write tests.

## Commit & Pull Request Guidelines
- Do not commit to git unless instructed to do so.
- Do not stage or unstage stuff
- You may read git for info, but do not modify anything.
- Commits and pull requests are for humans.


## Security & Configuration Tips
- Never commit secrets; use `.env` and keep `.env.example` in sync.
- Validate auth/data ownership on server paths (`getServerSideProps`, API routes, tRPC procedures).
- Prefer Prisma `select` to limit serialized data exposure.
