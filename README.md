# KoalaCards

<p align="center">
  <img width="33%" src="./logo.png" alt="KoalaCards logo"/>
</p>

KoalaCards is a Korean study app that combines spaced repetition cards, speaking checks, writing feedback, and reading workflows in one place.

## What The App Does

### Study Cards
- Deck-based review sessions with FSRS scheduling.
- Review queues include new cards, due cards, and remedial cards.
- Speaking answers are recorded, transcribed, and graded.
- Built-in assistant panel can explain cards and suggest edits while you study.

### Writing Practice
- Practice by typing or speaking.
- AI grading returns corrected text plus concise feedback.
- Diff view shows exactly what changed.
- Click unknown words to get definitions, then open card creation with those words prefilled.
- Writing history is searchable and tied to decks.

### Reader
- Save Korean content from a URL, pasted text, or local EPUB.
- Background ingest extracts and cleans article content.
- Highlight text while reading to get:
  - a flashcard-friendly definition,
  - general meaning,
  - and meaning in context.
- Import highlight results directly into a deck as cards.
- Mark articles read/unread and reopen EPUBs at saved progress.

### Decks And Cards
- Create cards from:
  - free-form text (`/create?mode=vibe`),
  - word lists (`/create?mode=wordlist`),
  - CSV/text pairs (`/create?mode=csv`).
- Live preview and inline editing before save.
- Deck operations: create, rename, describe, merge, delete.
- Card operations: edit, pause/unpause, delete.
- Deck JSON import/export preserves scheduling fields.

### Settings And Progress
- Tune review pace (`cardsPerDayMax`, `reviewTakeCount`, target retention).
- Configure audio playback and response timing.
- Optional writing-first flow can require daily writing progress before review.
- Optional due-card reminder emails.
- Dashboard charts track card learning, writing volume, and reading progress.

## Runtime Model

- `app` service: Next.js web app + tRPC API.
- `worker` service: background jobs for Reader ingest queue and due-card reminder emails.
- `db` service: PostgreSQL via Prisma.

If the worker is not running, Reader URL ingest and due-card reminder emails do not progress.

## Stack

- Next.js (Pages Router) + React + TypeScript
- Mantine UI
- tRPC
- Prisma + PostgreSQL
- NextAuth (email magic links or Google OAuth)
- OpenAI APIs (grading, parsing, assistant, transcription, TTS, reader language workflows)
- Google Cloud Storage (card images and generated audio artifacts)

## Local Run (Docker)

1. Copy env file: `cp .env.example .env`
2. Fill in required env vars in `.env`.
3. Start everything: `./run-dev.sh`
4. Open `http://localhost:3000`

The compose setup runs app, worker, migrations, and database together. App dependencies, Next cache, npm cache, and Postgres data live in named Docker volumes.

## Developer Notes

- Main setup reference: `SETUP.md`
- Env reference: `.env.example`
- Prisma schema: `prisma/schema.prisma`
- Before finishing changes, run: `docker compose run app sh /app/tidy.sh`

## ChatGPT Connection

In Koala Settings, copy the **ChatGPT Connection** link. In ChatGPT Plugins,
choose **Add custom MCP server**, paste the link, select **No authentication**,
and install the personal plugin. The secret URL itself grants access: keep it
private. Regenerate or disable it in Koala to revoke access, including existing
MCP clients. After regenerating, reconnect ChatGPT with the new URL.

The Streamable HTTP endpoint is `/api/mcp/<token>`. It exposes one read-only
tool, `get_study_report`, with no arguments. Each call returns a fresh rolling
snapshot of recent writing, card outcomes, and reading highlights. `generatedAt`
is the fetch time; record IDs and `createdAt` identify new study activity.

For daily coaching, install the plugin in the coaching chat and instruct the
scheduled task to call `get_study_report` on every run. Verify an unattended run
returns a new `generatedAt`; a previous chat response is not a retrieval check.

The endpoint validates the token on every request and runs without stored MCP
sessions, so multiple app instances do not require sticky routing. It reuses
the existing `StudyReportLink` token storage; the original JSON report URL
remains available and shares the same revocation controls. No new environment
variables or migrations are needed.

To add tools, register them in `koala/mcp/server.ts` and keep each tool in its
own module. Always scope queries to the authenticated user supplied by the
server, declare accurate annotations and schemas, and test authorization.
Existing connection links will authorize newly registered tools, so review
access scope before adding broader data access or write actions.

Protocol and authorization tests use the official MCP client over HTTP:

```sh
docker compose exec app node --import ./test/register-typescript-loader.mjs --test test/mcp.test.ts
```

## License

MIT (`LICENSE`).
