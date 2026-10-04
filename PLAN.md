# Reading overhaul: remove Instapaper first, add YouTube last

Status: Release A in progress; YouTube remains gated until Release A is complete
Scope: everything under `/reader`, plus the server, worker, data, and reporting paths that support it
Principle: improve trust and coherence without losing anything except the retired Instapaper feature and its linked data

## How to review this plan

For a fast review, read these six sections; the rest is supporting detail:

1. [The short version](#the-short-version)
2. [The release boundary](#the-release-boundary)
3. [Instapaper hard-deletion contract](#instapaper-hard-deletion-contract)
4. [YouTube v1 product contract](#youtube-v1-product-contract)
5. [Implementation phases](#implementation-phases)
6. [Decisions requested in review](#decisions-requested-in-review)

The audit evidence, parity contract, schema outline, test matrix, and risks are included so implementation does not have to rediscover them.

## The short version

We should not bolt a third reader onto the two implementations that already exist, and we should not start with a risky database rewrite.

The safe path is:

1. Freeze the supported feature set and record the exact Instapaper rows that the removal migration will delete.
2. Remove Instapaper outright in Release A: permanently delete its UI, routes, provider code, configuration, credentials, schema, and every Instapaper-linked article/highlight.
3. Fix the known selection, highlight, deletion, touch, and anchoring failures.
4. Extract one shared Reading shell and one explicit interaction state model while leaving current article/EPUB URLs and data in place.
5. Finish the current Reader's copy, accessibility, responsive behavior, and consistency work.
6. Release that existing-reader overhaul to production and prove it stable for an agreed observation window.
7. Only after that production gate passes, begin the YouTube feasibility proof and build YouTube as the final additive capability.
8. Roll YouTube out gradually. After the YouTube build, this plan contains verification and operational work only—not another feature phase.

The YouTube v1 includes:

- An embedded player with playback speed and resume position.
- A synchronized Korean transcript: click a line to jump the video, jump playback to the previous/next line, or replay the current line.
- Manual transcript editing. Users can edit spelling, wording, and punctuation in any line and save it; changing timestamps and AI-assisted correction are later features.
- The same explanation, highlight, and Card workflow already used for articles and EPUBs.

V1 will not include dual subtitles, subtitle translation, Netflix, offline video, automatic speech recognition, or advanced study modes.

One feasibility decision must happen before YouTube implementation—but after the existing-reader release gate: the official YouTube API can control playback and return metadata, but it cannot download captions for arbitrary public videos. We must approve a compliant caption provider, with a user-supplied subtitle file (SRT or VTT) as the fallback. We should not make an undocumented transcript scraper a production dependency.

## The release boundary

This is a strict two-release sequence, not parallel work:

- **Release A — Existing Reader:** remove Instapaper and all of its linked data; preserve and repair every other supported feature and record; simplify the code; finish UX/accessibility/copy work; then deploy it to all users and observe it in production.
- **Hard gate:** Release A's parity, Instapaper-removal, quality, rollback, and production-stability checks must pass and receive explicit sign-off.
- **Release B — YouTube last:** only then add the video schema, integrations, jobs, routes, player, transcript, editing, learning workflow, and reporting.

Before the hard gate passes, do not add or ship a video domain variant, database table or enum, migration, endpoint, worker, provider adapter, environment setting, feature flag, route, UI control, metric, or reporting branch. Planning and non-executable provider/legal research may be refined earlier; a working prototype, production dependency, or application code counts as YouTube build work and waits for Release B.

The rollout after the YouTube build may fix release-blocking defects, but it does not introduce another product capability. This makes YouTube the absolute last feature addition in this plan.

### Release A progress

Started September 3, 2026:

- Done: moved two server-only highlight helpers out of `pages/api`, so Next.js no longer treats them as API routes. The full required container check now passes without changing lint rules.
- Done locally, not yet deployed or production-verified: Instapaper's UI, routes, provider code, configuration, active tests, schema model/field/index, and supporting references have been removed. A new forward migration deletes every Instapaper-linked article and its highlights, deletes every Instapaper credential, and then drops the retired schema. Cards survive the highlight cascade.
- Done in code, not yet deployed: a confirmed deletion removes its mark from local cache before any refetch and cancels its matching active retry; the same range can be selected again; empty checkbox selection cannot add every highlight; and multiline selections match normal whitespace.
- Done in code, not yet deployed: the wide-screen tools rail stays docked on long articles and owns one internal scroller. A disposable 44,922px local article verified the rail at 30,000px scroll, independent history scrolling, selection without a page jump, repeated selection, and deletion through reload.
- Done in code, not yet deployed: EPUB selection supports touch, and iframe listeners are cleaned up and rebound when the current highlights or callbacks change.
- Not done: permanent browser automation; production inventory, backup/rehearsal, deployment of the removal migration, production reconciliation and secret cleanup; server-side handling for the narrow delete-before-upsert race; canonical anchors; and the mobile tools sheet.

## Decisions requested in review

Unless changed during review, this plan proceeds with these recommendations:

1. Release A must be complete and stable in production before any executable YouTube work begins.
2. Instapaper had zero real-user production use. Release A deletes the complete integration, every linked article/highlight, and every stored credential. A one-time count and ID preview verifies the migration's exact impact; it is not another usage audit. Cards survive when their source highlights are deleted.
3. Videos are private in v1: only the Koala Cards account that added a video can open it. Public video study pages are deferred.
4. Adding the same YouTube video again opens the saved video instead of creating a duplicate.
5. We use an approved caption provider plus SRT/VTT upload, never undocumented scraping or media download.
6. Study/explanation support is Korean-only in v1. Other embeddable videos can be watched, but learning tools stay unavailable until a timed Korean transcript is added.
7. Manual transcript editing is in v1: users can edit spelling, wording, and punctuation in any transcript line and save it. Timestamp editing and AI-assisted correction are deferred.
8. Transcript saves create revisions and never silently rewrite an existing highlight, explanation, or Card.
9. Highlight and Card deletion remain independent and non-destructive to each other.
10. Existing article, pasted-text, EPUB, highlight, and Card capabilities/data outside the Instapaper deletion set define parity; historically retired experiments and Instapaper do not.
11. Database unification is deferred. We share the Reader UI and business rules while keeping the existing article/EPUB tables and adding separate video tables later.

## Outcomes

The finished Reading area should make these promises:

- A completed selection always produces visible feedback or a short, actionable reason it cannot proceed.
- Removing a highlight removes its mark immediately and it cannot reappear after a refetch or reload.
- On long content, the learning panel stays docked beside the current reading position; using it never requires returning to the top of the document.
- Article, pasted-text, EPUB, highlight, and Card capabilities and data unrelated to Instapaper are preserved while defects and ambiguous actions are corrected.
- Instapaper is absent rather than disabled: its UI, routes, provider code, configuration, credentials, schema, and every linked article/highlight are gone; all unrelated articles, books, and Cards are unchanged.
- The repaired existing Reader ships and proves stable independently; its success is not coupled to YouTube readiness.
- A user can paste a supported YouTube link, watch it in Reading, follow its transcript, select a word or phrase, get an explanation, save the highlight, and create a Card.
- Desktop, keyboard, and touch interactions are intentional rather than separate partial implementations.
- Reader and YouTube schema work is additive except for the rehearsed forward migration that permanently removes Instapaper and all of its linked data after backup verification and before/after checks.
- Every phase is deployable in bounded steps. Application rollback cannot restore deleted Instapaper-linked rows; it protects all unrelated Reading data.

## Non-negotiables

- No big-bang rewrite.
- No destructive migration or bulk rewrite of live Reader content outside the Instapaper hard-deletion contract. That one cleanup requires a preview of every linked article and dependent highlight, before/after counts, rehearsal, a verified backup, and a maintenance cutover that stops old instances before the schema changes.
- No changes to lint rules or lint overrides.
- Instapaper is the only feature this plan removes. Removing anything else requires a separate decision.
- Delete every article with a non-null Instapaper linkage, regardless of account, because the feature and linkage are being removed. Stop the cutover if the preflight result changes before migration or the deletion query reaches an article without that linkage.
- Deleting an Instapaper-linked article also deletes its Reader highlights. Preserve Cards, books, and everything unrelated to Instapaper.
- No YouTube-specific application code, production schema, configuration, or UI before the Release A production gate passes.
- No raw exception text in user-facing error messages.
- No silent interaction state: loading, empty, success, error, and disabled states must be distinguishable.
- No YouTube audio/video download, caching, offline playback, or hidden page scraping in v1.
- Keep Pages Router routes thin and keep reusable/business logic under `koala/`.
- Run the full required container check after every implementation phase:

  ```sh
  docker compose run app sh /app/tidy.sh
  ```

## What the audit found

The first four rows contain confirmed code paths that directly explain the reported symptoms. The remaining rows are verified gaps or race risks that Phase 0 characterization tests must exercise.

| Priority | Finding                                            | Evidence and effect                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0       | The newest deleted highlight can reappear.         | The controller keeps the persisted highlight in `optimisticHighlight`, hides it while query data contains the same ID, and does not clear it on delete. After refetch removes the database row, the stale optimistic copy becomes visible again. See `koala/reader/ui/use-reader-highlight-controller.ts`.                                                                                                          |
| P0       | Selecting the same word or range can do nothing.   | Article and EPUB readers clear the native selection, compare it with a long-lived selection key, and return early when the same range is selected again. See `article-reader.tsx:388-406` and `book-reader.tsx:855-884`.                                                                                                                                                                                            |
| P0       | Saved and rendered article anchors can disagree.   | The browser selects rendered DOM text, while the API resolves against raw Markdown that can include a stripped title. Rendering then trusts the occurrence index and ignores stored context. Repeated terms, formatting, and whitespace can make a valid saved highlight invisible or put it on the wrong occurrence.                                                                                               |
| P0       | The desktop tools panel scrolls away on long text. | `ReaderWorkspace` marks the rail sticky, but its ancestor uses `overflowX: hidden`, which can create the non-viewport scroll container that traps sticky positioning (`workspace.tsx:4-10,75-82`). The rail is also wrapped in a rounded `ReaderPanel`, while nested overflow/max-height rules can clip rather than provide one clear panel scroller (`reader-tools-rail.tsx:19-33`; `article-reader.tsx:533-547`). |
| P0       | Delete can race with an active explanation.        | A highlight can be removed while its stream is still running; the stream can then try to update the deleted row or restore stale client state.                                                                                                                                                                                                                                                                      |
| P1       | EPUB interactions have lifecycle and touch gaps.   | The iframe installs mouse/keyboard listeners without a matching touch listener or a clear listener cleanup/rebind lifecycle.                                                                                                                                                                                                                                                                                        |
| P1       | Some “nothing happened” reports are silent rules.  | More than 220 selected characters are discarded without feedback. Selections from 81–220 characters require a second, manual action without making that transition obvious.                                                                                                                                                                                                                                         |
| P1       | Bulk Card creation is surprising.                  | With no checked highlights, the current “Add to deck” path can act on every importable highlight rather than doing nothing.                                                                                                                                                                                                                                                                                         |
| P1       | Highlight and Card lifecycles are unclear.         | They are intentionally independent records. Deleting a Card keeps its source highlight, and deleting a highlight keeps an already-created Card, but the interface does not make that rule clear.                                                                                                                                                                                                                    |
| P1       | Mobile tools obscure the reading task.             | The tools rail can permanently occupy about 44% of a small viewport and saved marks are not fully keyboard-operable.                                                                                                                                                                                                                                                                                                |
| P1       | Failure states are inconsistent.                   | Deck loading can look like an empty deck list; preference, read-state, and progress saves can fail silently; processing reloads the whole page; several surfaces expose raw error messages.                                                                                                                                                                                                                         |

The Instapaper audit supports complete removal:

- Imports enter the normal article queue and become ordinary `ReaderArticle` records. Their content, IDs, read state, highlights, Cards, public links, and reporting do not depend on the Instapaper credential row or provider client.
- `ReaderInstapaperCredential` stores a username plus encrypted OAuth access token/secret. The submitted password is not stored.
- Instapaper had zero real-user production use. The schema has no usage history, so current database counts are collected only to preview the destructive migration and reconcile its result—not to revisit that product fact.
- Disconnect currently deletes only the local credential row. The code has no provider-side token revocation and cannot inventory or delete copies previously exported into a user's Instapaper account.
- `ReaderArticle.instapaperBookmarkId` means an article was linked to Instapaper, not necessarily created by it. Import or export matching can attach it to an existing URL article. Every row with that linkage is intentionally in scope because the field itself is being removed.

The code shape also explains the sprawl:

- `pages/reader/index.tsx` is 1,312 lines.
- `koala/reader/ui/book-reader.tsx` is 1,175 lines.
- `koala/reader/ui/article-reader.tsx` is 629 lines.
- `koala/reader/ui/highlights.tsx` is 689 lines.
- `koala/trpc-routes/reader-instapaper.ts` was a 970-line integration-specific route module and is now removed locally as part of Release A.
- Article and EPUB flows duplicate selection limits, occurrence calculation, selection deduplication, mark rendering, preferences, and error behavior.
- EPUB code depends on article-named highlight helpers.
- Resource mappings and ownership checks are repeated across SSR, tRPC, the streaming API, library code, Recent, User, and admin reporting.
- The library merges two independently capped lists in the browser, so counts and older items can become incomplete.
- Two server-only highlight helpers were inside `pages/api`, so Next.js treated them as API routes and the generated type check failed. The first Release A cleanup moved them to `koala/reader/server`; the required container check now passes.
- The pre-removal baseline's 97 tests passed, but line coverage was 45.35% and there was no component/hook, permanent real-browser, Reader route/database, EPUB/IndexedDB, or Reader worker coverage. The locally completed removal still requires the full container check before deployment, and Phase 0 adds those missing protections before broad structural work.

## Feature-parity contract

This is the “do not lose supported behavior or unrelated data” checklist. It becomes an executable regression suite before structural work begins. Instapaper is the one feature being removed and follows the separate deletion contract below.

### Library and source intake

- Add a URL article.
- Paste text, with optional title and the current size limit.
- Add a local EPUB.
- Keep the combined recency library, filters/counts, refresh, open, read/unread, and delete actions.
- Keep EPUB cover, progress, local-file availability, permission recovery, and same-file recovery.

### Article reading

- Keep current public, read-only article links working.
- Keep source metadata; only the Koala Cards account that added an article can change its read/unread status.
- Keep pending, processing, ready, and error behavior.
- Keep Markdown/GFM rendering, including code handling.
- Keep font size, line height, and reading width preferences.

### EPUB reading

- Keep the browser-local file model; do not upload book files as part of this work.
- Keep sanitized, sandboxed rendering.
- Keep table of contents, previous/next, Arrow/PageUp/PageDown/J/K navigation, and saved last/furthest progress.
- Keep permission recovery and same-file validation.

### Shared learning workflow

- Select text with mouse, keyboard, or touch.
- Automatically explain short selections and manually explain longer supported selections.
- Stream the explanation and retain retry/error behavior.
- Save and reopen highlights; navigate from history to the source location.
- Keep the learning tools reachable at the user's current position throughout long articles and EPUB books. The final YouTube stage extends this guarantee to transcripts.
- Choose a deck, create one or many Cards, and retain duplicate/already-added handling.
- Remove a highlight without deleting an existing Card.
- Delete a Card without deleting its source highlight.

### Reporting

- Keep all supported resource types represented in Recent activity, user progress, admin document counts, highlight counts, and recent activity.
- Keep every article unrelated to Instapaper counted as an Article. Reporting must subtract every deleted Instapaper-linked article/highlight and leave all unrelated records and resource types unchanged.
- The final YouTube stage adds video reporting only after the Release A gate.

Historically removed experiments are not silently added back to this contract. After Release A, Instapaper joins comprehension, typing, bookmarklet, and the other retired flows; restoring any of them requires a separate product decision.

## Instapaper hard-deletion contract

Instapaper had zero real-user production use. Release A deletes the feature and every record tied to it permanently. There is no deprecation period, user notice, temporary retirement page, or retained route.

### Delete

- Every `ReaderInstapaperCredential` row and its encrypted access details.
- Every article with an `instapaperBookmarkId`, regardless of account, including its content, metadata, read state, public URL, and reporting entries.
- The highlights and explanations attached to those articles. They are removed automatically when the article is deleted.
- The Instapaper table, article field/index, provider code, UI/routes, tests, configuration, secrets, and current documentation.

### Keep

- Every article without an Instapaper linkage, plus all EPUB data.
- Cards, Decks, and Card review history. Cards created from a deleted highlight survive; only the link back to that deleted highlight is lost.
- Historical migrations. Removal uses a new forward migration.

An `instapaperBookmarkId` only proves that an article was linked to Instapaper. It may have been added by URL first and linked later. Removing the integration still deliberately deletes every linked article because the linkage and all supporting schema are being removed.

The app cannot identify or erase bookmarks previously exported to the remote Instapaper account because it did not save the returned export IDs. Any remote cleanup must happen in Instapaper; this plan covers Koala Cards data and access.

### Safe execution order

1. Count every credential, every article with a non-null Instapaper linkage, its dependent highlights, and Cards linked through those highlights. Record exact IDs and counts without logging article content or secrets.
2. Preview the migration result and verify that only the intended linked articles, highlights, and credential rows are in the deletion set. A changed count pauses the cutover for a fresh preview; it does not narrow the contract to one account.
3. Stop incoming traffic, stop all old app and worker instances, and finish or cancel work for the linked articles. This is a maintenance cutover, not an intermediate compatibility release.
4. Rehearse the forward migration on a production-shaped snapshot and verify a restorable production backup.
5. Complete available provider-side deauthorization or retire the app's Instapaper consumer credentials before discarding the local encrypted credentials. Record local and provider outcomes separately; do not claim remote bookmarks were deleted.
6. While old processes remain stopped, install the post-removal release and run the forward migration. It deletes every article whose Instapaper linkage is non-null, lets its highlights cascade, deletes every credential row, and drops the credential table, User relation, article field, and index. Historical migrations remain untouched.
7. Start only the post-removal app and worker build. Block the pre-removal build from redeployment because it is incompatible with the new schema.
8. Confirm all linked articles, their highlights, and credentials are gone; the count changes match the preview; Cards/Decks/review history survive; and every unrelated account and Reading record is unchanged.
9. Remove Instapaper production secrets after runtime dependence is zero. Never remove `NEXTAUTH_SECRET`; remove `READER_ENCRYPTION_KEY` only if nothing else uses it. Backups containing deleted rows expire under normal restricted retention, and any restore reapplies the deletion before traffic resumes.

Application rollback cannot restore the deleted linked articles, highlights, or credentials. Only a verified database backup could recover them, and any production restore must reapply the purge before traffic resumes. Application rollback must use a post-removal build, keep Instapaper absent, and preserve everything unrelated.

Exit gate: all live Instapaper-linked data, access, code, UI, routes, configuration, secrets, and schema are gone; Cards and everything unrelated to Instapaper reconcile exactly; no Instapaper work crosses into Release B.

## YouTube v1 product contract

This section specifies the final feature addition. It is reviewed now so the Reader architecture does not block it later, but none of it is implemented before Release A passes the production-stability gate.

### The primary flow

1. The user chooses YouTube alongside the existing article, text, and EPUB source types.
2. They paste a `youtube.com`, `youtu.be`, Shorts, or single-video URL that also contains playlist parameters. Only the referenced video is saved; playlist import/navigation is ignored.
3. The server extracts and canonicalizes only the video ID; it does not fetch the URL through the article scraper.
4. An idempotent video record is created immediately, then metadata and transcript status update in place as processing completes.
5. Opening the item shows the YouTube player and timed Korean transcript in one Reading workspace.
6. As the video plays, the current transcript line is highlighted. When Follow is on, the transcript scrolls to keep that line visible; when Follow is off, the user's transcript position stays put. Selecting a word or phrase pauses the video and opens the same explanation/highlight workflow used elsewhere.
7. The user can edit spelling, wording, and punctuation in any transcript line and save the correction. Its start/end times and line boundaries stay fixed in v1. Saving creates a revision; it never silently rewrites explanations, highlights, or Cards.
8. Clicking a transcript line or saved video highlight jumps the video to that point. Playback position and preferred speed resume on the next visit.

### Core v1

| Area           | Included behavior                                                                                                                                                                                                                                                                              |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Add            | Strict URL parsing, canonical video identity, one saved item per user/video, status-driven metadata/transcript hydration, appropriate next actions for unsupported states, and safe retry. Re-adding the same video opens the existing item; existing article duplicate behavior is unchanged. |
| Player         | Official YouTube IFrame Player API, native controls, play/pause, volume, seek, captions, fullscreen, plays-inline, and no autoplay. Custom controls sit outside the player and never obscure it.                                                                                               |
| Study controls | Available playback speeds, back/forward 5 seconds, jump playback to the previous/next transcript line, replay the current line, and transcript-follow on/off. All have accessible names and keyboard equivalents.                                                                              |
| Transcript     | One timed Korean caption track, current-line emphasis, click/tap a line to jump playback, and user-controlled follow. Non-Korean videos remain watch-only in v1.                                                                                                                               |
| Editing        | Manually edit spelling, wording, and punctuation in any transcript line; keep its start/end times and line boundaries fixed; explicit save/cancel and unsaved-change protection; revision-safe undo; no silent mutation of existing highlights, explanations, or Cards.                        |
| Learning       | Single-word and phrase selection, streamed explanation, retry, persistent highlight, highlight history, navigation/seek, deck selection, and single/bulk Card creation.                                                                                                                        |
| Progress       | Last meaningful playback position, last opened time, and completion-safe behavior near the end of a video.                                                                                                                                                                                     |
| Library        | YouTube type/filter/count, thumbnail, channel, duration, transcript state, progress, highlight count, open, and remove.                                                                                                                                                                        |
| Devices        | Responsive desktop/tablet/mobile layout, touch selection, keyboard navigation, focus management, and reduced-motion support.                                                                                                                                                                   |
| Failure modes  | Invalid URL, deleted/private/restricted video, embedding disabled, no usable Korean captions, provider failure, quota failure, and player failure each have a distinct state and an appropriate next action when one exists.                                                                   |

### Caption fallback

If a video is embeddable but has no provider transcript or uploaded SRT/VTT file, it remains watchable in a clearly identified watch-only state. V1 includes a bounded SRT/VTT upload fallback. Uploaded transcript lines support the full v1 editing, highlighting, explanation, and Card workflow. Parsed lines are stored server-side for revisit/cross-device behavior; the raw upload is discarded after parsing. A video that cannot be embedded stays in the library only if the user chooses to keep it and offers only actions that are actually possible, such as opening YouTube or removing the item.

### Deliberately out of v1

- Dual subtitles or line-by-line translation.
- Non-Korean transcript explanation and multilingual prompt support.
- Automatic pause after every transcript line, loop modes, or configurable study profiles.
- Automatic speech recognition or downloading/extracting YouTube audio.
- AI spell-checking/correction, automatic rewriting, timestamp editing, splitting/merging transcript lines, and a full revision-browser UI. The schema should permit a later reviewable AI-assisted revision source.
- Browser extensions, Netflix, local video, podcasts, or arbitrary media URLs.
- Offline video or cached YouTube media.
- Screenshot/audio capture into Cards or Anki export.
- Subtitle appearance editors, transliteration modes, or word-level knowledge coloring.
- Playlists, recommendations, discovery catalogs, or social sharing.
- Public video study pages. The recommended v1 default keeps each video private to the Koala Cards account that added it.

These can be considered after usage shows which study behaviors matter.

## Final-stage YouTube feasibility gate

This is the first executable YouTube phase after Release A is complete. It is required before video schema or UI implementation; it does not run in parallel with the existing-reader overhaul.

The official APIs divide into two different capabilities:

- The IFrame Player API supports playback control, current time, seeking, events, and available playback rates.
- The Data API can return video metadata such as title, duration, caption availability, and embeddable status.
- The official captions download endpoint requires the authenticated user to have permission to edit the video. It is not a general transcript API for arbitrary public videos.

Therefore the spike must select and document one production caption path:

1. Preferred: a vetted caption/transcript provider whose terms, Korean coverage, reliability, latency, and cost are acceptable.
2. Required fallback: a user-provided SRT/VTT track with strict size/type validation when provider captions are missing or unusable.
3. Not approved for v1: scraping YouTube page markup, calling undocumented endpoints, or downloading media for transcription.

The provider lives behind a small adapter and circuit breaker so it can be replaced without touching Reader UI or stored highlights. The spike must cover:

- Human and automatically generated Korean captions, including a deterministic choice when multiple Korean tracks exist.
- Rights to persist, display, edit, version, and delete full transcript text, and to send selected text/context to the configured AI provider.
- Required retention limits, attribution, provenance, refresh, user-deletion, and provider-deletion behavior.
- No-caption, private, deleted, region-restricted, age-restricted, and embedding-disabled videos.
- Transcript edits after import and stable line timestamps/IDs.
- API quotas, timeouts, retries, provider outage behavior, and cost telemetry.
- YouTube player requirements, attribution, referrer/origin configuration, privacy-enhanced embeds, and policy-change monitoring.

Exit gate: one caption path and its storage/processing rights are approved, and a real prototype proves add, play, sync, seek, speed, edit/save, and error handling. Without a provider transcript or uploaded SRT/VTT file, a video is watch-only. An uploaded file still enables the complete v1 transcript-editing and learning workflow.

## Target architecture

The unification should happen in code first, not by forcing articles, EPUBs, and videos into one database table.

The table below describes the final shape. Release A implements only the article/book parts that serve today's product. Release B adds the video parts after the hard gate. Extensibility comes from small contracts, not from shipping speculative `video` branches, empty routes, dormant flags, or placeholder jobs early.

| Layer                          | Owns                                                                                                           | Does not own                                                            |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Thin routes in `pages/reader/` | Authentication handoff, SSR/route parameters, and page composition.                                            | Selection logic, mutations, parsing, or source-specific business rules. |
| `koala/reader/domain/`         | Article/book contracts first; video is appended in Release B. Canonical status, selection, and progress types. | React, Prisma, or API transport details.                                |
| `koala/reader/client/`         | Query-cache transactions and one explicit interaction state machine.                                           | Source parsing or direct persistence.                                   |
| `koala/reader/ui/`             | Shared page frame, library, source intake, reading settings, and learning panel.                               | Resource-specific rendering.                                            |
| `koala/reader/surfaces/`       | Article body and EPUB frame first; video player/transcript adapters are appended in Release B.                 | Duplicated highlight/deck workflows.                                    |
| `koala/reader/server/`         | Ownership-aware services, unified library facade, resource adapters, and repositories.                         | User-facing rendering.                                                  |
| `koala/worker/`                | Existing bounded work first; isolated video ingest is appended in Release B.                                   | Long unbounded work that can starve due-card reminders.                 |

In Release A, the resource contract is a discriminated union with only `article` and `book` variants. Release B adds `video`; the contract is not one adapter that spans every layer:

- A pure domain descriptor defines summary, progress, and location/anchor types.
- A server repository/service adapter owns persistence, ownership/visibility, selection validation, and highlight operations.
- A client surface component owns article, EPUB, or video rendering and navigation while consuming the shared interaction contract.

The library gets one server-side cursor-paginated facade. In Release A it reads only the remaining article/book tables, sorts them consistently, and returns real counts after the Instapaper deletion. Instapaper has no adapter because the integration and every linked row are removed before the Release A hard gate. Release B appends the video repository and counts. Other existing endpoints remain until every supported caller has moved.

### Docking and scroll ownership

The shared Reading shell—not each source surface—owns a single responsive panel contract:

- On widths that can fit the reading measure plus the tools rail, the rail is a true viewport-docked region beside the content. It uses a sticky position, a chrome-aware top offset, and a viewport-bounded height for the full document.
- The document owns page scrolling. The rail owns one internal vertical scroller when its explanation is taller than the viewport. Its deck selector, mode switcher, and current-selection status remain reachable while its body scrolls.
- No ancestor of the sticky rail creates an accidental scroll container. Horizontal overflow is clipped at the page root with `overflow-x: clip`, not hidden on the workspace wrapper, so sticky positioning remains tied to the viewport.
- The docked rail reads as part of the workspace: one continuous surface/divider, not a rounded card floating above the page or another card nested inside it.
- Opening a new selection updates the visible rail in place. It does not change the document scroll position or force the user to return to the top; the rail's internal view reveals the new selection/status.
- When there is not enough usable width, the rail becomes the collapsible learning sheet already described in this plan. It is closed or compact by default, opens for a selection, preserves the reading position, returns focus correctly, respects safe areas, and does not permanently cover the selected text.
- Article and EPUB routes adopt this contract in Release A. The final YouTube surface must adopt it without changing existing routes. Breakpoints are chosen where the reading measure plus rail no longer fit, rather than by device name.

### One interaction state model

The current collection of booleans, refs, query results, and optimistic objects should become one tested reducer/state machine:

| State      | Required visible guarantee                                                                           |
| ---------- | ---------------------------------------------------------------------------------------------------- |
| Idle       | No stale selection, request, error, or optimistic mark remains.                                      |
| Selected   | The source selection has a visible anchor before the browser selection is cleared.                   |
| Explaining | One request owns the draft and temporary mark; retry/delete rules are explicit.                      |
| Ready      | The server highlight has replaced the temporary one exactly once.                                    |
| Error      | The selection remains recoverable and retryable; a later identical gesture is accepted.              |
| Importing  | The exact selected highlights and destination deck are shown. Zero selected items never means “all.” |
| Deleting   | The mark and history row leave the cache together; failure restores both once.                       |

Selection event deduplication must use a short-lived gesture ID, not a permanent key derived from the text. Every in-flight explanation has an abort/request ID. Starting a new selection, navigating, unmounting, or deleting cancels the matching request. If persistence already started, the server must finish in a terminal state or remove the unreferenced provisional row; a bounded recovery task resolves stale `IN_PROGRESS` records. Delete first cancels a matching stream, then performs a cache transaction, then reconciles with the server.

### Canonical anchoring

Article and EPUB selection must stop using incompatible text coordinate systems. Introduce one canonical display-text projection per resource:

- Normalize only explicitly documented whitespace and Unicode behavior.
- Resolve by exact quote plus prefix/suffix context; use occurrence index only as a fallback/tie-breaker.
- Store the content hash/version used by the anchor.
- Render against the same projection used for persistence.
- Treat overlaps explicitly rather than silently dropping a saved mark.
- Keep old anchors and unique-key inputs untouched. Phase 2 uses the existing quote, context, occurrence, and content-hash fields through a dual-read resolver; it does not require a migration. Leave unresolved highlights visible in history with a recovery path.

When Release B begins, video locations add time-aware fields: transcript version, transcript-line IDs, canonical text offsets, and start/end milliseconds. The time is for seek/navigation; the quote and surrounding context remain the stable language-learning evidence.

Manual edits retain transcript-line IDs and timestamps while rebuilding text offsets in a new revision. Existing highlights first reconcile by line ID plus quote/context. If edited text removes the selected phrase, the highlight and its Card/explanation remain intact and seekable, but the transcript mark is shown as needing review instead of being guessed or deleted. A future AI spell-checker must use this same draft → visible diff/review → saved revision path.

## Additive data model

This entire section belongs to Release B. None of these models, enums, columns, migrations, settings, or generated-client changes enter the production repository before the Release A hard gate.

When Release B begins, add dedicated tables rather than relabeling production article or EPUB rows:

### `ReaderVideo`

- Owner and a unique public ID.
- Provider (`YOUTUBE`), provider video ID, original URL, and canonical URL.
- Title, channel, thumbnail, duration, and embeddable status.
- Separate metadata/embed and transcript states/errors, so a playable video can remain watch-only when transcript processing fails.
- One explicit `currentTranscriptId`; do not infer the current revision from competing active booleans.
- Last playback position, last opened time, and timestamps.
- Unique `(userId, provider, providerVideoId)` for idempotent YouTube adds.
- Atomic job/lease fields (`attemptCount`, `nextAttemptAt`, claim timestamps, and terminal state) or an equivalent dedicated video-job table.

### `ReaderVideoTranscript`

- Video relation, provider/track identity, language, caption kind, revision source (`PROVIDER`, `UPLOAD`, or `USER_EDIT`), parent revision, and version.
- Immutable, bounded transcript-line JSON with line IDs, start/end milliseconds, text, and canonical text offsets.
- Canonical flattened text and content hash.
- Retained while current or referenced by a highlight, subject to the storage/deletion rights approved in the feasibility gate.

### `ReaderVideoHighlight`

- Owner, video, and transcript-version relations.
- Transcript-line IDs, canonical start/end offsets, start/end milliseconds, exact quote, and prefix/suffix context.
- Content hash, prompt version, explanation status/result/error, and timestamps.
- Optional imported Card relation using `onDelete: SetNull`, matching the current non-destructive Card/highlight rule.
- An idempotency/cache key covering owner, video, transcript/hash, selection hash/location, and prompt version.

Add one nullable `readerVideoPlaybackRate` column to `UserSettings` with an application default. The existing `UserSettings.playbackSpeed` is used by flashcard/review audio and must not acquire a second meaning.

Removing a video requires an explicit confirmation that names what will be removed. It cascades to parsed transcripts and video highlights; already-created Cards survive because their source link becomes null. After confirmation, the UI and server reconcile as one operation, and a failed request restores the item once. Provider-origin and uploaded parsed text follow the approved retention/deletion policy; raw uploads are never retained after parsing.

All relations, ownership checks, indexes, limits, and API outputs are explicit. Server reads use narrow Prisma `select` clauses. The migration consists of new video-only tables/enums plus the nullable settings column. No backfill is required, and no existing `contentText`, content hash, occurrence index, locator, or public ID is changed.

## Implementation phases

The phases are sequential. Release A repairs, consolidates, audits, deploys, and stabilizes the existing Reader. Release B begins YouTube work only after Release A's hard production gate passes. A dormant flag or unused video branch still counts as YouTube code and is not permitted early.

| Order | Stage                          | Result                                                        | YouTube implementation allowed?     |
| ----- | ------------------------------ | ------------------------------------------------------------- | ----------------------------------- |
| 1     | Phase 0 — Baseline             | Existing behavior and the exact deletion boundary are locked. | No                                  |
| 2     | Phase 1 — Instapaper deletion  | Integration and all linked data are gone.                     | No                                  |
| 3     | Phase 2 — Interaction trust    | Selection, deletion, anchoring, docking, and touch are fixed. | No                                  |
| 4     | Phase 3 — Stable seams         | Existing article/EPUB code is coherent without behavior loss. | No                                  |
| 5     | Phase 4 — UX completion        | Current-reader copy, accessibility, and responsive work ends. | No                                  |
| 6     | Phase 5 — Production stability | Release A reaches all users and completes observation.        | No                                  |
| Gate  | Explicit Release A sign-off    | Every hard-gate check passes.                                 | Only after approval                 |
| 7     | Phase 6 — YouTube feasibility  | The first YouTube prototype resolves external risks.          | Yes, as the first Release B work    |
| 8     | Phase 7 — YouTube backend      | Additive schema and flagged services are ready.               | Yes                                 |
| 9     | Phase 8 — YouTube experience   | Player, transcript editing, and learning UI are complete.     | Yes; this is the last feature phase |
| 10    | Phase 9 — YouTube rollout      | The finished feature is deployed and verified.                | Defect/operational fixes only       |

### Release A — finish the existing Reader

#### Phase 0 — lock the current baseline

Work:

- Turn the feature-parity and Instapaper hard-deletion contracts above into characterization tests.
- Keep the restored required tidy check as a hard baseline; do not weaken or bypass it.
- Record production counts by existing resource/status without recording user content.
- Record Instapaper credentials and linked articles grouped by `User.id`, plus their ingest/read states, dependent highlights, linked Card IDs, ownership mismatches, and pending/in-progress work. This measures the migration boundary; it does not exempt linked rows on another account.
- Create anonymized fixtures for representative Markdown, repeated terms, Unicode, EPUB navigation, highlights, Card imports, linked Instapaper articles across accounts, unrelated articles, stored credentials, and Cards attached through highlights.
- Walk every reading action at the top, middle, and end of long article/EPUB fixtures, recording document scroll, panel scroll, focus, and selection behavior so similar “works only near the top” defects enter the parity suite.
- Establish baseline Reader funnel/error measurements before changing the UI.
- Record a targeted repository inventory confirming that no YouTube-specific Reader schema, code, route, dependency, configuration, or flag exists at the start. Exclude unrelated generic media handling from this check.

Exit gate:

- The supported-feature checklist and exact Instapaper deletion set—including every linked article, its highlight cascade, all credentials, and Card preservation—are signed off.
- Existing critical flows have deterministic browser coverage.
- Production baselines, Instapaper deletion counts, and the no-video-code starting point are recorded.
- No schema or production data changes have been made.

#### Phase 1 — remove Instapaper and all linked data

Work:

1. Confirm the production counts and exact IDs for every credential, linked article, dependent highlight, linked Card, and active job. Recheck immediately before the cutover if anything changes.
2. Verify a restorable backup and run the complete forward migration and reconciliation procedure on a production-shaped snapshot.
3. Complete available provider-side deauthorization or retire the consumer credentials while the local encrypted credentials still exist. Record local and provider outcomes separately; do not claim remote bookmarks were deleted.
4. Begin a maintenance cutover: stop incoming traffic, stop every old app and worker instance, and finish or cancel work for the linked articles.
5. Install the post-removal build. Locally this build already removes `pages/reader/instapaper.tsx`, `koala/reader/ui/instapaper/`, `koala/reader/instapaper.ts`, `koala/trpc-routes/reader-instapaper.ts`, main-router registrations, active integration tests, configuration, and product/setup references. It removes `koala/reader/secret.ts` only if no other code consumes it.
6. Run the forward migration. It deletes every article with a non-null `instapaperBookmarkId`, lets its highlights cascade, deletes every `ReaderInstapaperCredential`, and drops the credential model/User relation and article linkage field/index. Never edit historical migrations.
7. Start only the post-removal build and reconcile the exact count changes. Cards, Decks, reviews, books, articles without an Instapaper linkage, and all other unrelated data must remain unchanged.
8. Remove Instapaper production secrets only after all runtime dependence is zero. Remove a dedicated `READER_ENCRYPTION_KEY` only after proving it has no other consumer; never remove `NEXTAUTH_SECRET`. Verify the backup-retention/restore purge rule and final repository/schema inventory before leaving Phase 1.

Exit gate:

- No Instapaper shortcut, route, provider operation, configuration, or integration surface remains.
- Controlled provider deauthorization has completed; all later provider traffic, live/runtime credential rows, and production consumer secrets are zero. Provider-side limitations are documented.
- Every Instapaper-linked article and its highlights are gone; no job for one of those articles is still running; the reporting changes match the preflight set exactly.
- Cards, Decks, reviews, books, other accounts, and every unrelated article/highlight count and relationship reconcile unchanged.
- The schema migration never overlaps a pre-removal application instance, and the post-removal rollback procedure is rehearsed.

#### Phase 2 — restore interaction trust

Work:

- Promote and clear optimistic highlights once the server ID is confirmed.
- Make highlight deletion an atomic query-cache transition with one rollback path.
- Cancel or serialize deletion against an active explanation stream.
- Define terminal server behavior for cancellation on a new selection, navigation, unmount, or disconnect, and recover stale `IN_PROGRESS` rows.
- Replace the permanent selection-key check with per-gesture deduplication.
- Keep a visible selection anchor before clearing native selection.
- Fix the whitespace matcher and introduce the canonical anchor resolver.
- Repair the workspace scroll hierarchy: remove the sticky-breaking overflow ancestor, make the desktop tools rail viewport-docked for the entire document, and give it one intentional internal scroller.
- When selection changes, reveal the new Current state inside the rail without scrolling the article, moving keyboard focus unexpectedly, or losing the source selection anchor.
- Add EPUB listener cleanup/rebinding and touch selection.
- Make long-selection and overlapping-highlight outcomes visible.
- Make zero-selection bulk import do nothing; provide a separately explicit all-items action if retained.
- Invalidate Reader state when a linked Card is deleted elsewhere.
- Include keyboard/touch semantics and concise visible feedback in each repaired interaction rather than deferring them to a later polish pass.

Exit gate:

- The reported delete/reappear and select/nothing-happens reproductions fail on old code and pass on new code.
- At the beginning, middle, and end of a multi-screen article, the tools rail remains visible and usable without a page jump; long rail content scrolls independently.
- Article and EPUB flows pass mouse, keyboard, touch, retry, delete, reload, and Card lifecycle tests.
- No database schema, existing field, ID, content hash, locator, or public URL has changed.

#### Phase 3 — create stable seams without changing behavior

Work:

- Create an agreed `DESIGN.md` before multi-page visual changes, preserving the current brand while defining one quiet, focused Reading workspace across all routes.
- Split the dashboard into source intake, library query/state, filters, and resource rows.
- Split article and EPUB readers into shared shell/learning/settings plus small source surfaces.
- Define responsive and accessible component contracts as the shell is extracted; do not recreate the current mobile rail or nested-control semantics in new components.
- Make docking, page-scroll ownership, rail-scroll ownership, and the narrow-screen sheet part of the shared shell API so source surfaces cannot override them independently.
- Move article/book contracts, canonical status mapping, interaction state, and server ownership services into the target layers above.
- Add the server-side cursor-paginated library facade for existing article and EPUB data.
- Replace full-page processing reloads with query updates and an explicit retry path.
- Keep old supported route and endpoint adapters until their current consumers have migrated. Instapaper is already absent and is not included in those adapters.
- Keep the seams extensible, but do not add a `video` union case, stub, route, provider, job, flag, configuration value, dependency, or reporting branch.

Exit gate:

- No schema change is required or made.
- The complete existing-feature parity suite is unchanged and passing.
- Page files compose features; they no longer own reusable business logic.
- The shipped contracts represent only source types that exist in production.

#### Phase 4 — finish current-reader UX, copy, accessibility, and consistency

Work:

- Use one terminology system across every supported Reading route. Instapaper added no temporary user-facing retirement copy in Phase 1.
- Complete a dedicated copy pass using the repository's copy-clarity guidance before changing final UI strings. That skill was not available during this planning pass, so this document defines terminology and behavior rather than final sentences.
- Audit the loading, empty, success, error, and disabled treatment already required in earlier phases and close remaining gaps.
- Move visual values into semantic Reader theme tokens; remove one-off inline styling as components are touched.
- Verify visible focus, semantic control structure, labels, focus return, screen-reader announcements, contrast, reduced motion, and practical touch targets.
- Verify 320, 375, 414, and 768 px widths, plus representative desktop widths.
- Conduct task-based usability checks for add, select, explain, remove, retry, create Card, read-state, progress, and recover-file flows.
- Reconcile existing-source counts and behaviors in Recent, user progress, and admin reporting.

Exit gate:

- No critical automated or task-based accessibility failures remain.
- No horizontal overflow or content-obscuring tools remain at supported widths.
- A user can distinguish a highlight from a Card and predict what each destructive action removes.
- All existing-reader copy, responsive, and consistency work intended by this plan is complete; none is postponed until after YouTube.

#### Phase 5 — release and stabilize the existing Reader

Work:

1. Take and verify a restorable production backup.
2. Deploy the post-Instapaper Release A through internal accounts, synthetic checks, and a small cohort before expanding.
3. Compare interaction errors, Reader funnels, expected post-purge production counts, Instapaper zero-state checks, and existing worker health with the Phase 0 baseline at each step.
4. Expand to all users only while parity, data checks, accessibility checks, and behavior remain healthy.
5. Observe normal production use for a period agreed before rollout; do not shorten it merely to start YouTube.
6. Keep supported-source compatibility adapters through at least one stable release.
7. Recheck that every Instapaper data, code, configuration, secret, backup-restore, and schema task finished in Phase 1; do not carry cleanup into Release B.

Rollback:

- Return application traffic only to a post-removal release that supports the new schema. Application rollback cannot restore the intentionally deleted Instapaper-linked articles/highlights or credentials.
- Keep article, pasted text, EPUB, highlight, and Card paths available.
- Do not restore Instapaper provider operations, linkage schema, or purged credentials. A database restore requires reapplying the purge before traffic resumes.
- Reconcile caches and in-flight explanation work using the Phase 2 recovery rules.

### Release A hard gate — YouTube work may now begin

Every item must be true:

- Release A is serving all users and has completed the agreed production observation window.
- The full existing-reader parity suite and required container tidy command pass.
- There are no known P0 interaction defects or open critical regressions.
- The reported selection, deletion, docking, anchoring, touch, and Card-lifecycle cases pass with mouse, keyboard, and touch where applicable.
- Production counts and existing foreign-key relationships reconcile after subtracting the complete Instapaper deletion set, and core Reader/worker health has not regressed from baseline.
- Accessibility and supported-width checks pass.
- The rollback runbook preserves every unrelated record and does not pretend application rollback can restore deleted Instapaper articles, highlights, or credentials.
- Instapaper has no UI, route, provider code or operation, post-deauthorization traffic, live/runtime credential row, consumer secret, linked article/highlight, linkage column/index, or unfinished cleanup task. Cards and all unrelated account/resource counts reconcile unchanged.
- A final repository inventory confirms Release A did not introduce dormant YouTube implementation.
- The product owner explicitly signs off on starting Release B.

If any item fails, work remains in Release A. A feature flag, schedule, or completed design document cannot waive this gate.

### Release B — YouTube is the final product addition

Release B contains the YouTube feasibility proof, implementation, and controlled rollout. No unrelated Reader feature work is scheduled after it.

#### Phase 6 — resolve YouTube feasibility

Work:

- Audit existing saved `youtube.com`/`youtu.be` article URLs so the new dispatcher does not surprise current data.
- Confirm the v1 policies proposed here: videos private to the account that added them, idempotent per-user video adds, Korean-only learning tools, independent Card/highlight deletion, and no undocumented caption scraping.
- Select the caption path, including storage, editing, AI-processing, retention, deletion, reliability, quota, and cost terms.
- Build the first executable YouTube prototype now—not during Release A—to prove add, play, sync, seek, speed, manual transcript edit/save, and required failure handling.
- Validate the official player requirements, origin/referrer behavior, privacy mode, embeddability checks, and provider adapter boundary.
- Reconfirm the bounded SRT/VTT fallback and watch-only behavior.

Exit gate:

- One caption path and its storage/processing rights are approved.
- The prototype proves the primary integration risks without writing production Reader data.
- Provider failure, quota, cost, retention, and deletion behavior are documented.
- If no provider is approved, videos without an uploaded SRT/VTT transcript are watch-only. Uploaded transcripts retain the full editing and learning workflow; no hidden acquisition method is substituted.

#### Phase 7 — add the flagged YouTube backend

Work:

- Extend the resource union, surfaces contract, library facade, and reporting contracts with the first `video` variant.
- Add the three video tables, video-only enums, durable job/lease fields, and nullable Reader video-speed setting in one isolated additive migration with no backfill or database default.
- Add strict YouTube URL parsing/canonicalization and metadata validation.
- Add transcript provider and SRT/VTT parser adapters with bounded inputs and provenance.
- Add ownership-scoped video create/get/list/remove/progress/preferences endpoints.
- Extend the shared highlight/explanation/import services with a video repository adapter.
- Run bounded, idempotent video work from a dedicated, independently stoppable job queue/process with retry/backoff, so article ingest and due-card reminders cannot be starved.
- Extend Recent, user progress, and admin aggregates before enabling the flag.
- Add the YouTube feature flag, dependencies, and required configuration to `.env.example` without secrets.

Exit gate:

- The migration is rehearsed against a production-shaped clone and old-table row/relation counts are unchanged.
- The old application safely ignores the additive schema; rollback is an application/flag rollback, never a destructive reverse migration after video data exists.
- Jobs are idempotent and recover cleanly from timeout, provider failure, and duplicate delivery.
- Every write verifies the signed-in account. Without a transcript, explanation/highlight actions are unavailable, while the account that added the video can still retry, add captions, or remove it.

#### Phase 8 — build and finish the YouTube Reading surface

Work:

- Add YouTube intake to the shared source form and video rows to the library.
- Add `/reader/videos/[publicId]` as a private route available only to the account that added the video.
- Build an official IFrame API wrapper with cleanup, state/event handling, available-rate reconciliation, origin/referrer configuration, and no overlays.
- Build a performant normal-DOM synchronized transcript, click-to-seek, current-line highlighting, follow toggle, and resume behavior. Add measured chunking only if real transcript sizes require it and selection/accessibility remain correct.
- Build manual transcript editing with fixed line timestamps/boundaries, explicit save/cancel, unsaved-change protection, optimistic concurrency, revision-safe undo, and highlight reconciliation.
- Connect word/phrase selection to the shared explanation/highlight/Card workflow.
- Add previous-line, next-line, replay-current-line, and back/forward controls without duplicating YouTube native controls.
- Build watch-only, processing, retryable error, and terminal unavailable states.
- Build the mobile composition as player, transcript, and a collapsible learning sheet that does not permanently cover the selected content.
- Apply the same desktop docking contract while a long transcript scrolls; player, transcript, and learning panel must not create competing page-level scroll containers.
- Complete YouTube-specific copy, loading/error states, keyboard, touch, focus, screen-reader, contrast, reduced-motion, and responsive checks inside this phase.
- Complete all video telemetry, reporting, operational documentation, and kill-switch behavior needed for rollout.

Exit gate:

- A supported link completes the primary flow on desktop, keyboard, and touch devices.
- Highlight history jumps to the correct transcript line after reload.
- Transcript edits survive reload; stale-tab saves cannot overwrite a newer revision; changed text never silently mutates an existing explanation or Card.
- Speed and progress degrade safely when a video exposes fewer rates or cannot resume.
- All final copy, accessibility, responsive, security, ownership, worker, and reporting checks pass.

This is the final feature-development phase in the plan.

#### Phase 9 — roll out and verify YouTube

This phase deploys and verifies the completed feature; it does not add another product capability.

Work:

1. Verify a fresh restorable backup and the production migration rehearsal.
2. Apply the additive migration in the compatibility-safe order, then deploy the backend and UI with the YouTube flag off.
3. Enable internal accounts and synthetic checks.
4. Enable a small user cohort and compare errors, queue behavior, provider health, quota, cost, and core Reading funnels with their baselines.
5. Expand in steps only while old-source parity, data checks, and video behavior remain healthy.
6. Retain compatibility adapters through at least one stable release. Any later feature request starts a separately reviewed plan.

Rollback:

- Disable YouTube creation and study features with the feature flag.
- Keep every unrelated article, pasted-text, and EPUB path available; the deleted Instapaper-linked rows remain absent.
- Retain new video rows and make them readable by the compatibility release; do not delete or reverse-migrate user data.
- Stop video jobs independently if the caption provider, quota, or player integration is unhealthy.

Exit gate:

- Production counts reconcile, no supported route regresses, and no known P0 interaction failure remains.
- The YouTube rollback runbook has been exercised without deleting data.
- Rollout fixes are limited to defects, safety, accessibility, operations, and compatibility—not new features.

## Copy and interaction direction

Use these terms consistently:

| Meaning                   | Term                                           |
| ------------------------- | ---------------------------------------------- |
| Product area              | Reading                                        |
| Saved source types        | Article, pasted text, EPUB book, YouTube video |
| Saved source selection    | Highlight                                      |
| AI result                 | Explanation                                    |
| Spaced-repetition item    | Card                                           |
| Exact destructive actions | Remove highlight; Delete Card; Remove source   |

Rules for the final copy pass:

- Describe the user-visible outcome, not storage, browser APIs, workers, or implementation status.
- Use one direct task verb per action.
- Do not alternate between “Reading,” “Reader,” and “Koala” for the same area.
- Do not show occurrence indexes or other anchoring internals unless they solve a user problem.
- Do not treat loading or errors as empty states.
- Put the recovery action next to the problem.
- Keep status text short; put technical detail in structured logs.
- Distinguish creating a Card from adding a highlight to a deck.

## Test strategy

Testing is additive except for removing the retired Instapaper feature tests and data. Release A contains no video fixtures, stubs, or dormant integration tests; it proves the supported Reader independently. The destructive removal migration is verified with a production-shaped rehearsal and before/after reconciliation, not an application test. Release B adds the YouTube suites without weakening or replacing any Release A assertion.

### Release A required coverage

| Level                    | Required coverage                                                                                                                                                                                                                   |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pure unit                | Canonical text projection, anchor resolution, overlap policy, progress math, and interaction reducer transitions.                                                                                                                   |
| Component/hook           | Optimistic-to-confirmed-to-deleted lifecycle, delayed/failed refetch, same-range reselection, cancellation, stale-request recovery, loading/error states, bulk selection, and Card invalidation.                                    |
| Browser DOM              | Mouse, keyboard, and touch selection; Markdown markup; repeated terms; whitespace; Unicode; mark focus/click; nested history controls; mobile-sheet focus; and docked-rail behavior at the beginning, middle, and end of long text. |
| EPUB iframe              | Listener setup/cleanup, touch selection, navigation, progress, permission recovery, relink, and highlights across section changes.                                                                                                  |
| Database/service         | Ownership, public article read-only behavior, private-book behavior, narrow selects, duplicate Card handling, and preservation of unrelated records.                                                                                |
| Worker                   | Existing article processing, stale-work recovery, concurrency, and fairness with reminder emails.                                                                                                                                   |
| End to end               | URL article, pasted text, and EPUB complete the supported add → open → select → explain → highlight → Card → revisit → remove paths.                                                                                                  |
| Accessibility/responsive | Automated checks plus keyboard/screen-reader task checks at 320/375/414/768 px and desktop.                                                                                                                                         |

### Release B YouTube additions

| Level                    | Additional required coverage                                                                                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pure unit                | YouTube URL/video-ID parsing, SRT/VTT parsing, transcript-line normalization, transcript revision/reconciliation, time-aware anchors, video progress math, and playback-rate fallback.            |
| Component/hook           | Player event cleanup, follow on/off, seek controls, video selection, transcript edit/save/cancel/undo, stale-tab conflicts, and every watch-only/error state.                                     |
| Browser DOM              | Long-transcript docking, player/transcript/learning-panel scroll ownership, selection while playback changes, mobile composition, and transcript-line/history seek behavior.                      |
| Database/service         | Private-video ownership, narrow selects, idempotent adds/jobs, video cascade/Card survival, exactly one current transcript, optimistic revision conflicts, and rights-aware transcript retention. |
| Worker                   | Video claims, concurrency, retry/backoff, stale-job recovery, provider failures, quotas, and fairness with article processing and reminder emails.                                                |
| End to end               | YouTube add → watch → resume/speed → edit transcript → select → explain → highlight → Card → revisit/seek → remove, plus watch-only and provider-failure paths.                                   |
| Migration                | Apply to a scrubbed production-shaped snapshot, compare old row/relation counts, run both release suites, roll app behavior back with the flag, and prove no old data changed.                    |
| Accessibility/responsive | Repeat the full keyboard, screen-reader, touch, focus, and supported-width checks with the player and transcript present.                                                                         |

During Release B, mock the IFrame API and caption provider for deterministic CI. Keep a small scheduled smoke test against a known embeddable public fixture so external integration changes are detected without making every build depend on YouTube.

The docking regression uses a multi-screen article and a long highlight history. It scrolls the document near the end, selects text, and asserts that the rail remains inside the viewport, the document's scroll position does not jump, the Current state is visible, and rail scrolling does not move the article. The same flow runs above and below the content-driven dock/sheet breakpoint.

Every phase ends with `docker compose run app sh /app/tidy.sh`; no lint rule is weakened to make a phase pass.

## Observability and success checks

Establish real baselines before setting numeric targets. Do not invent success percentages.

Instrument Release A without logging selected text, private URLs, credentials, or other user content:

- Existing source-add attempted/succeeded/failed by source type and stable error code.
- Selection completed, explanation started/succeeded/failed, and reason a selection was rejected.
- Highlight confirmed/removed/restored-after-error, with a detector for client marks lacking a server record.
- Card creation result: created, duplicate, already linked, not ready, or missing.
- Instapaper preflight and post-migration credential/article/highlight counts, Card-preservation result, and migration reconciliation status, without username, URL, bookmark ID, token, or article content.
- Infrastructure-level confirmation that no outbound Instapaper traffic remains after provider deauthorization and the hard-removal release.
- Queue age and throughput for article ingest and reminder email work.
- Frontend exceptions, API errors, and accessibility/browser smoke failures by Release A cohort.

Add these only when Release B begins, still without logging transcripts or other user content:

- Video source-add attempted/succeeded/failed by stable error code.
- Video metadata/transcript job latency, retry count, provider error class, quota, and cost.
- Player ready/error, study-mode availability, speed selection, transcript-line seek, resume, and completion.
- Transcript revision saved/conflicted/restored and highlight reconciliation outcome, without transcript text.
- Video queue age/throughput and its effect on article ingest and reminder email work.
- Frontend exceptions, API errors, and accessibility/browser smoke failures by Release B cohort.

Release A checks:

- Zero known paths that resurrect a successfully removed highlight.
- Zero silent supported selection paths in the regression suite.
- All current-feature parity tests pass throughout rollout.
- Existing production counts and foreign-key relationships reconcile after subtracting every Instapaper-linked article and highlight plus all credentials; Cards and all unrelated records remain unchanged.
- The docked rail remains usable throughout long content at the supported widths.
- No core Reader or reminder-worker health regression appears during the agreed observation window.
- All Instapaper-linked articles/highlights, code and routes, post-deauthorization calls, live/runtime credential rows, consumer secrets, and linkage schema are zero before the hard gate; all unrelated account/resource counts reconcile exactly.

Release B adds these checks:

- Both Release A and Release B end-to-end suites pass before and after migration.
- Production before/after counts and foreign-key relationships reconcile, with existing tables unchanged.
- New errors are actionable and stable; internal details remain in logs.
- Provider reliability, quota, and unit cost are visible before cohort expansion.

## Risk register

| Risk                                                                                   | Mitigation                                                                                                                                                         |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| YouTube work distracts from or hides an incomplete Reader repair.                      | Two releases, a no-video-code rule, a production observation window, explicit sign-off, and no parallel implementation.                                            |
| Arbitrary YouTube captions are not available from the official download API.           | Provider/compliance spike first; adapter boundary; SRT/VTT fallback; honest watch-only state.                                                                      |
| Provider terms do not permit durable, editable transcript storage or AI processing.    | Make those rights part of the feasibility exit gate; do not integrate a display-only source into study mode.                                                       |
| YouTube/player policy or embed behavior changes.                                       | Official IFrame API only, no overlays/downloads, origin/referrer compliance, scheduled external smoke test, and kill switch.                                       |
| Refactor loses a supported feature.                                                    | Executable parity contract, thin compatibility adapters, and phase-by-phase deployments; only Instapaper follows the hard-deletion contract.                       |
| Instapaper-linked rows change between the preview and migration.                        | Record exact IDs/counts, stop writes by taking a maintenance cutover, and rerun the preview if its result changes.                                                   |
| Local token deletion is mistaken for provider revocation.                              | Track local purge and provider deauthorization separately; retire consumer credentials and document any provider limitation.                                       |
| Credential schema is dropped while an old app instance still reads it.                 | Stop all old app/worker instances before migration, start only the post-removal build, and block old builds from redeployment.                                       |
| A database restore revives purged rows or encrypted credentials.                       | Restrict/expire backups on schedule, keep consumer access retired, and reapply the purge before restored traffic starts.                                           |
| A migration harms live data.                                                           | For Instapaper: exact preview, maintenance cutover, production-like rehearsal, verified backup, and reconciliation. For YouTube: additive video-only tables and no existing-row backfill. |
| Old highlights cannot be resolved by the new anchor.                                   | Compatibility resolver at read time, immutable old fields, visible unresolved history, and no silent deletion.                                                     |
| Caption updates move highlights.                                                       | Immutable transcript versions; highlights retain their original transcript/hash and line/time evidence.                                                            |
| A transcript edit overwrites another tab or detaches a highlight.                      | Optimistic version checks, locked line timing/IDs, revision-safe undo, reconciliation tests, and a visible needs-review state.                                     |
| Video jobs delay article ingest or reminder emails.                                    | Separate claim budget/concurrency, bounded work, idempotency, queue telemetry, and an independent stop switch.                                                     |
| External API cost or quota grows unexpectedly.                                         | Per-provider metrics, request caching where permitted, limits, retries with backoff, and cohort rollout.                                                           |
| Video visibility exposes user activity or licensed transcript data.                    | Private v1 route, account checks on every read/write, and no raw content in telemetry.                                                                             |
| “Remove highlight” is confused with “Delete Card.”                                     | Preserve independent records, precise action names, cross-query invalidation, and transaction tests.                                                               |

## Definition of done

### Release A is complete before YouTube begins when

- The supported feature-parity and Instapaper hard-deletion contracts are covered and passing end to end.
- The two reported intermittent failures and the related race, anchor, touch, and docking cases have permanent regression tests.
- `/reader` uses one coherent shell, terminology system, interaction state model, and article/book resource contract.
- Long articles and EPUB books keep the desktop learning rail docked and independently scrollable; narrow screens use a non-obscuring, focus-safe sheet, with no selection-triggered page jump.
- Existing-source Recent, user, and admin reporting is complete and reconciled.
- Instapaper connections and remote actions are gone; post-deauthorization provider traffic, live/runtime credential rows, linked articles/highlights, consumer secrets, linkage schema, UI/routes/provider code, and integration cleanup tasks are zero.
- Every Instapaper-linked article/highlight is permanently absent, its Cards survive, expected reporting changes reconcile, and every unrelated account/resource record and relationship remains intact.
- Existing-reader accessibility, responsive, security, ownership, worker, production-observation, and rollback checks pass.
- The full required container tidy command passes with no lint-rule changes.
- The repository contains no YouTube-specific implementation, and the product owner has approved crossing the hard gate.

### The full program is complete after the final YouTube release when

- Every Release A requirement still passes unchanged.
- YouTube v1 satisfies the included product contract—including safe manual transcript editing—on desktop, keyboard, and touch devices.
- Long transcripts use the same docked desktop rail and focus-safe mobile sheet contract.
- Captions have documented provenance, policy approval, failure behavior, quota, and cost monitoring.
- The additive migration and rollout are rehearsed against production-shaped data; no existing data is rewritten.
- Recent, user, and admin reporting include videos and video highlights.
- YouTube accessibility, responsive, security, ownership, worker, and rollback checks pass.
- Operational docs cover configuration, provider outage, quota, job retry, rollout, and rollback.
- No product feature phase follows YouTube in this plan.

## Sources reviewed

Competitor behavior informed the Pareto scope; it is not a request to copy any competitor's interface.

- [Readlang features](https://readlang.com/features): synchronized YouTube transcripts with the same lookup and flashcard workflow as reading.
- [Readlang transcript synchronization guide](https://forum.readlang.com/t/synchronize-transcriptions-to-youtube-videos/30): timed transcript playback, seeking, speed, and shortcuts.
- [Language Reactor basic guide](https://www.languagereactor.com/help/basic): subtitle navigation, lookup/save, replay, keyboard controls, and auto-pause patterns.
- [Language Reactor updates](https://www.languagereactor.com/help/updates): transcript list, mobile/player changes, saved vocabulary, and subtitle controls.
- [LingQ YouTube import guide](https://www.lingq.com/blog/youtube-videos-into-lingq/): video, readable transcript, word lookup, vocabulary saving, and mobile continuity.
- [Kimchi Reader changelog](https://kimchi-reader.app/changelog): transcript-line navigation, playback speed, transcript modes, mobile layout, custom SRT/VTT, and resume behavior.
- [YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference): supported playback methods, events, current time, seeking, and playback rates.
- [YouTube embedded-player parameters](https://developers.google.com/youtube/player_parameters): controls, captions, plays-inline, JavaScript API, and origin configuration.
- [YouTube captions download API](https://developers.google.com/youtube/v3/docs/captions/download): authorization and permission-to-edit requirement for caption downloads.
- [YouTube required minimum functionality](https://developers.google.com/youtube/terms/required-minimum-functionality): player sizing, autoplay, identity/referrer, controls, and overlay constraints.
- [YouTube developer policies](https://developers.google.com/youtube/terms/developer-policies): restrictions relevant to downloading, storing, or modifying YouTube audiovisual content.
- [YouTube privacy-enhanced embedding](https://support.google.com/youtube/answer/171780): `youtube-nocookie.com` embeds and third-party playback limitations.

Sources and repository state reviewed on 2026-09-03.
