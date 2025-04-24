# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build/Test/Lint Commands
- Build: Never run this
- Dev: It's running on localhost:3000 never attempt to start the server.
- Lint: `npm run lint` - Run ESLint
- Reset DB: Never attempt to do DB operations (migrations, reset, etc...)
- Start: Never do this

## Code Guidelines
- TypeScript strictly typed - avoid using `any` types
- No seriously, never use any type. It's never OK. Use `unknown` if you must.
- React functional components with explicit return types
- Imports ordered: React, external packages, internal modules, types
- PascalCase for components, camelCase for functions/variables
- Follow existing patterns when adding new features
- Components should be small, focused, and reusable
- Use Next.js conventions for routing and data fetching
- UI uses Mantine component library for consistent styling
- Avoid hard-coded values - use environment variables for secrets
- I prefer serverside props over trpc methods where possible
- When the feature is done, run `npm run lint` and `tsc --noEmit` to make sure it's cleaned up.

KoalaCards is a language learning app with listening and speaking flashcards using spaced repetition and automated grading via speech recognition and LLMs.