# Repository Guidelines

## Project Structure & Module Organization

- **pages/**: Next.js page components and API routes.
- **koala/**: Business logic, utilities, and React components.
- **prisma/**: Database schema, migrations, and client configuration.
- **public/**: Static assets (images, fonts, icons).
- ****tests**/**: Test suite is undergoing a re-write. Don't do testing for now.

## Build, Test, and Development Commands

- `npm run dev`: Launch development server with hot reload.
- `npm run build`: Create optimized production build.
- `npm start`: Apply migrations and start production server.
- `npm run lint`: Run ESLint checks.
- `npm run format`: Format code with Prettier.
- `npm test`: Execute Jest test suite. (Dont use right now)
- `npm run test:coverage`: Generate coverage report in `coverage/`. (don't use right now)
- `npm run reset`: Clean, reinstall deps, apply migrations, and seed DB.

## Agent/Automation Policy

- Never run the server from the agent. Do not execute `npm run dev`, `npm start`, or any long-running server processes. Rely on static analysis, linting, and formatting.
- Do not introduce or use barrel modules (no `index.ts`/`index.tsx` re-export aggregators). Import from concrete file paths using root aliases or relative paths.

## Coding Style & Naming Conventions

- **Types**: Never add `any` types. Be explicit about data types.
- **Indentation**: 2 spaces per level.
- **Components** (`*.tsx`): PascalCase file names (e.g., `DeckPicker.tsx`).
- **Utilities** (`*.ts`): kebab-case file names (e.g., `time-until.ts`).
- **Imports**: Use root aliases (`@/path/to/module`) or relative paths; never import via barrel modules. Always import from the concrete file that defines the symbol.
- **Linting**: ESLint with `eslint-config-next` and custom rules in `eslint-rules/`.
- **Formatting**: Prettier; run `npm run format` before commit.

### Mobile UI Spacing

- Labels and controls must not appear cramped on small screens. Use Mantine spacing props and ensure comfortable touch targets (around 44px) with adequate margins and padding.

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

## Code Quality & Complexity Rules

- Avoid Boolean soups. Replace complex predicates with well-named helpers.
- Avoid unnecessary `as` casts. If used, keep them local, justified, and safe.
- Choose the right procedure type: reads are `query`, writes/side effects are `mutation`.
- Conditional UI: extract components for distinct states (e.g., Existing vs New forms) instead of inline JSX blocks.
- Define helper types near usage or in `koala/types/` when shared.
- Eliminate duplication. Factor repeated UI or logic into pure functions or tiny components.
- Forms: build payloads in explicit branches, not nested ternaries; validate inputs close to where they’re captured.
- Keep components small: aim for <150 lines per component. Extract subcomponents early.
- Keep prop surfaces tight. Pass only what’s used.
- Keep render selection flat. Use a map/object for mode → component instead of big conditionals when possible.
- Lists: keep keys stable and avoid inline heavy lambdas when possible; move handlers to named functions.
- Never use `any`. Favor precise types and discriminated unions.
- Never use nested ternaries. If/else or small helpers are required instead.
- No comment-driven code. Code should be self-explanatory; prefer clear names over comments.
- Prefer early returns over nested conditionals. Avoid nesting beyond 2 levels in JSX and logic.
- Prefer pure functions for parsing/transforming data. Keep side effects (I/O, mutations, notifications) at edges.
- Styling: use Mantine props (`c="dimmed"`, `mb`, etc.) over passing theme objects around.
- URL parsing: handle each query param in its own `useEffect` with guard clauses; avoid nested branches.

## TRPC Routes Overview

- **archiveCard**: Flags a card as archived (paused) for the current user.
- **bulkCreateCards**: Creates many cards (and optionally a deck) from term/definition/gender input; dedupes and backfills deck metadata.
- **calculate-scheduling-data**: Internal helper (not a route) for FSRS scheduling; used by grading logic.
- **copyDeck**: Placeholder; accepts a deck ID but currently no-op.
- **createDeck**: Creates a new deck for the user if one with the same name/lang doesn’t already exist.
- **defineUnknownWords**: Given context and target words, returns concise English definitions (and optional lemmas) via LLM.
- **deleteCard**: Deletes a specific card owned by the current user.
- **deleteDeck**: Deletes a deck and all its cards for the current user in a transaction.
- **deletePausedCards**: Bulk-deletes all flagged/archived cards for the current user.
- **editCard**: Updates editable fields on a card (term, definition, flags, and review stats) for the owner.
- **editUserSettings**: Updates user settings with conflict detection via updatedAt.
- **faucet**: Test utility that tweaks a few cards to seed different review states for experiments.
- **generateWritingPrompts**: Produces several target-language writing prompts based on deck terms via LLM.
- **generateWritingSample**: Generates a sample answer in the deck’s language for a given prompt via LLM.
- **getDailyWritingProgress**: Returns last-24h writing progress vs goal for the current user.
- **getNextQuizzes**: Selects the next set of quizzes/steps due for a deck (or all), including session meta counts.
- **getUserSettings**: Returns the current user’s settings or null if unauthenticated.
- **gradeQuiz**: Applies an FSRS grade to a card, updates scheduling, and may attach an image on lower grades.
- **gradeSpeakingQuiz**: Grades a spoken response against a card using evaluator/LLM and returns pass/fail feedback.
- **gradeWriting**: Cleans up and deeply corrects an essay in the deck’s language, stores submission and correction.
- **import-cards.setGrade**: Internal helper to compute and persist FSRS state after grading.
- **mergeDecks**: Merges multiple same-language decks into a new deck and reassigns related cards and submissions.
- **parseCards**: Parses plain text into candidate cards (term/definition/gender) for a given language.
- **reportDeck**: Placeholder; accepts a deck ID but currently no-op.
- **reviewAssistant**: Chat assistant for review context that can also suggest new card pairs.
- **transcribeAudio**: Transcribes user-provided base64 audio for a target sentence and language.
- **translate**: Translates a string or list of strings to English via LLM.
- **turbine**: Experimental utilities (not elaborated here) for pipeline-related tasks.
- **updateDeck**: Updates deck metadata (publish toggle and optionally name) for the owner.
