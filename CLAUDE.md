# CLAUDE.md

### Commands

- **Lint:** `npm run lint`
- **Never run:** build, dev (localhost:3000 already running), start, or any DB ops
- **THE DEV SERVER RUNS IN A CONTAINER!!!** Don't expect the DB to be available on local. Don't try to run the dev server on bare metal. The same goes for the database- it's not on my host, it's on Docker.

### Coding Rules

- **TypeScript:** strict; never use `any` (use `unknown` only when unavoidable)
- **React:** functional components with explicit return types, I don't like inline JSX expressions. Use variables and then {insertTheResult}.
- **Naming:** PascalCase components; camelCase functions & variables; kebab-case files.
- **Structure:** small, focused, reusable components; follow existing patterns; Next.js routing & data fetching
- **UI:** Mantine library for styling
- **Config:** store secrets in environment variables
- **Data:** prefer `getServerSideProps` over `trpc`
- **Style:** avoid inline expressions, long one‑liners, and ternaries; expand code vertically
- **Control flow:** no `else if`—use early returns, switch, or lookup tables. I seriously hate else if statements.
- **Safety:** never use `dangerouslySetInnerHTML`. Always make sure the user owns the resource they are accessing in tRPC.
- **No Else If:** You can use else. You can use if. You can never use else if constructs because that's a sign your code is sloppy.
- **Common Sense:** You are not allowed to use refs. You are not allowed to pass callbacks up to a parent via silly props like "registerClickHandler". Child components passing handlers to parents violates React unidirectional data flow

### Finishing Checklist (Mandatory)

Run these steps before calling the work done:

1. `npm run lint`
2. `npm run format`
3. `tsc --noEmit`

KoalaCards is a language‑learning flashcard app with SRS, speech recognition, and LLM grading.
