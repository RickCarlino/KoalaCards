# Repository Guidelines

## Project Structure & Module Organization
- `pages/`: Next.js pages and API routes.
- `koala/`: Business logic, utilities, and React components.
- `prisma/`: Schema, migrations, Prisma client config.
- `public/`: Static assets (images, fonts, icons).
- `tests/`: Jest suite (under re-write; see Testing).

## Build, Test, and Development Commands

Don't run other commands!

- `npm run lint`: Run ESLint checks.
- `npm run format`: Format with Prettier.

## Coding Style & Naming Conventions
- Indentation: 2 spaces. No `any` types.
- Components (`*.tsx`): PascalCase (e.g., `DeckPicker.tsx`).
- Utilities (`*.ts`): kebab-case (e.g., `time-until.ts`).
- Imports: use root aliases (e.g., `@/koala/...`) or relative paths; never barrel modules.
- Lint/format: ESLint (`eslint-config-next` + custom rules in `eslint-rules/`) and Prettier.
- Error handling: avoid unnecessary try/catch; never swallow errors.
- UI: ensure comfortable touch targets, use Mantine spacing props.
- Code quality: avoid nested ternaries, keep components small (<150 lines), prefer pure functions, tight props, stable list keys.

### Error Handling Policy

- You need a good reason to use try/catch. Logging is not a good reason. Delete try/catch if you have the chance. Let it fail normally unless there is a good reason to catch().
- Do not swallow errors. Never use empty catch blocks like `catch (_) {}` or `catch (e) {}` without handling.

## Testing Guidelines

- Tests are undergoing a re-write. Don't write or run tests.

## Commit & Pull Request Guidelines

- Never do anything with git other than `git diff` or `git status`.

## Security & Configuration Tips
- Copy `example.env` to `.env`, update secrets, and keep out of VCS.
- Manage secrets via env vars or a secret manager.
- Update `docker-compose.yml` when adding/modifying services.

## Agent-Specific Instructions
- Do not run servers (`npm run dev`/`npm start`). Rely on static analysis, linting, and formatting.
- Avoid barrel modules; import from concrete file paths.
- Prefer minimal, targeted changes; follow repository styles and conventions above.

## Code Quality & Complexity Rules

- Avoid Boolean soups. Replace complex predicates with well-named helpers.
- Avoid unnecessary `as` casts. If used, keep them local, justified, and safe.
- Conditional UI: extract components for distinct states (e.g., Existing vs New forms) instead of inline JSX blocks.
- Define helper types near usage or in `koala/types/` when shared.
- Eliminate duplication. Factor repeated UI or logic into pure functions or tiny components.
- No nested ternaries
- Keep components small: aim for <150 lines per component. Extract subcomponents early.
- Keep prop surfaces tight. Pass only what’s used.
- Keep render selection flat. Use a map/object for mode → component instead of big conditionals when possible.
- Never use `any`. Favor precise types and discriminated unions.
- Never use nested ternaries. If/else or small helpers are required instead.
- No comment-driven code. Code should be self-explanatory; prefer clear names over comments.
- Prefer early returns over nested conditionals. Avoid nesting beyond 2 levels in JSX and logic.
- Prefer pure functions for parsing/transforming data. Keep side effects (I/O, mutations, notifications) at edges.
