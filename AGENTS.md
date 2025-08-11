# Repository Guidelines

## Project Structure & Module Organization
- **pages/**: Next.js page components and API routes.
- **koala/**: Business logic, utilities, and React components.
- **prisma/**: Database schema, migrations, and client configuration.
- **public/**: Static assets (images, fonts, icons).
- **__tests__/**: Test suite is undergoing a re-write. Don't do testing for now.

## Build, Test, and Development Commands
- `npm run dev`: Launch development server with hot reload.
- `npm run build`: Create optimized production build.
- `npm start`: Apply migrations and start production server.
- `npm run lint`: Run ESLint checks.
- `npm run format`: Format code with Prettier.
- `npm test`: Execute Jest test suite. (Dont use right now)
- `npm run test:coverage`: Generate coverage report in `coverage/`. (don't use right now)
- `npm run reset`: Clean, reinstall deps, apply migrations, and seed DB.

## Coding Style & Naming Conventions
- **Indentation**: 2 spaces per level.
- **Components** (`*.tsx`): PascalCase file names (e.g., `DeckPicker.tsx`).
- **Utilities** (`*.ts`): kebab-case file names (e.g., `time-until.ts`).
- **Imports**: Use root aliases (`@/path/to/module`) or relative paths.
- **Linting**: ESLint with `eslint-config-next` and custom rules in `eslint-rules/`.
- **Formatting**: Prettier; run `npm run format` before commit.

## Testing Guidelines
- **Framework**: Jest with `jest-environment-jsdom`.
- **Utilities**: `@testing-library/react` & `@testing-library/jest-dom` for assertions.
- **File Naming**: Place tests in `__tests__/` or name as `*.test.ts(x)`.
- **Coverage**: Enforced by `npm run test:coverage`, output in `coverage/`.

## Commit & Pull Request Guidelines
- **Commit Messages**: Use imperative style (e.g., “Add feature X”, “Fix bug Y”), omit trailing periods.
- **Issue References**: Include `#<issue-number>` when applicable.
- **Pull Requests**: Provide descriptive title, detailed description, linked issues, and screenshots for UI changes.
- **Branch Naming**: Use `feature/*`, `fix/*`, or `chore/*` prefixes.

## Security & Configuration Tips
- Copy `example.env` to `.env`, update credentials, and exclude `.env` from VCS.
- Manage secrets via environment variables or a secret manager.
- Update `docker-compose.yml` when adding or modifying services.
