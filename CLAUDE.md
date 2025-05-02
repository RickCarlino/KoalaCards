# CLAUDE.md

### Commands

- **Lint:** `npm run lint`
- **Never run:** build, dev (localhost:3000 already running), start, or any DB ops

### Coding Rules

- **TypeScript:** strict; never use `any` (use `unknown` only when unavoidable)
- **React:** functional components with explicit return types
- **Naming:** PascalCase components; camelCase functions & variables; kebabe-case files.
- **Structure:** small, focused, reusable components; follow existing patterns; Next.js routing & data fetching
- **UI:** Mantine library for styling
- **Config:** store secrets in environment variables
- **Data:** prefer `getServerSideProps` over `trpc`
- **Style:** avoid inline expressions, long one‑liners, and ternaries; expand code vertically
- **Control flow:** no `else if`—use early returns, switch, or lookup tables
- **Safety:** never use `dangerouslySetInnerHTML`

### Finishing Checklist

1. `npm run lint`
2. `npm run format`
3. `tsc --noEmit`

KoalaCards is a language‑learning flashcard app with SRS, speech recognition, and LLM grading.
