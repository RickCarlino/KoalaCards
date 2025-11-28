# KoalaCards User Manual

## Outline
- Overview and Access
- Navigation Basics
- Create Your First Deck (auto-generated)
- Add Cards to a Deck (manual or bulk)
- Deck Hub (/review)
- Studying Cards (/review/[deckId])
- Speaking Improvement Drills (/speaking/[deckId])
- Writing Practice (/writing/[deckId])
- Writing History (/writing)
- Card Management (/cards and /cards/[id])
- Deck Management and Sharing
- Community Decks (/shared-decks)
- Frequency Lists (/frequency-lists)
- Settings and Account (/user)
- Quiz Results Export (approved users) (/train)
- Admin Tools (super users) (/admin and /link/[userID])
- Help and Troubleshooting

## Overview and Access
- KoalaCards focuses on helping English speakers learn Korean through spaced repetition, speaking drills, and writing practice.
- Sign in with Google if configured by the host; otherwise, expect an email magic link. The email flow lands on `/auth/email`, where clicking “Continue to App” completes login.
- Microphone access is required for speaking quizzes and drills. Enable it in your browser or device settings before starting.
- All learning content and generators currently target Korean.

## Navigation Basics
- The home page (`/`) redirects you to sign in if you are not authenticated. After login, it shows quick actions that adapt to your progress (create cards when empty, study when you have due items, etc.).
- The top bar shows a logo on the home page and a back arrow elsewhere. Clicking it returns you to `/`.
- Common entry points:
  - Study: `/review`
  - Card creation: `/create` (or `/create-new` for your first deck)
  - Card browser: `/cards`
  - Writing: `/writing`
  - Settings: `/user`

## Create Your First Deck (auto-generated)
- Visit `/create-new` if you have no decks; the app sends you there automatically when needed.
- Choose a level (Beginner, Intermediate, Advanced) and enter a topic of interest. The topic field auto-suggests ideas until you focus it.
- Click **Go!** to create a deck named “My First Koala Deck,” auto-generate 15 Korean example-sentence cards for the chosen level/topic, and jump straight into studying that deck.

## Add Cards to a Deck (manual or bulk)
- Go to `/create` to add cards to an existing deck or create another.
- Deck selection:
  - Pick **Existing** and choose a deck, or switch to **New** and enter a deck name.
  - If you arrive here with no decks, you are redirected to `/create-new`.
- Three input modes (choose via the segmented control):
  - **Free Form**: Type an instruction like “Make 25 Korean example sentences about travel.” Click **Generate** to have cards auto-created.
  - **Word list**: Paste one word per line and click **Enrich** to fetch definitions/translations.
  - **CSV/Text**: Set a separator (default comma). Each line is `term{sep}definition`; click **Parse** to preview.
- Preview and edits:
  - Generated/parsed cards appear on the right. You can edit term/definition inline or remove rows.
  - The **Save** button is enabled once you have cards and a target deck (or new deck name). Saving bulk-creates the cards and returns you to `/review`.
- Tip: The **Frequency Lists** page (see below) links useful word lists if you need vocabulary ideas.

## Deck Hub (/review)
- Displays all your decks with **Due** and **New** counts. Cards are sorted by due volume.
- Actions per deck card:
  - **Study Cards** starts a review session (button blinks when due items exist).
  - **Speaking Improvements** opens corrective drills.
  - **Writing Practice** opens the writing flow for that deck.
  - Edit the deck name (pencil), save, or cancel; delete removes the deck and its cards (confirmation shown).
  - **Published** toggle shares/unshares the deck to the community list (confirmation shown when publishing).
  - Checkbox selection enables **Merge Decks**: pick 2+ decks and click **Merge** to create a new deck named after the first selection with “(Merged)”; cards and writing submissions move to the new deck, and the old decks are deleted.
- If you have no decks, the page invites you to add cards and links to `/create`.

## Studying Cards (/review/[deckId])
- Access: Choose **Study Cards** on a deck. If “Require daily writing before card review” is enabled in settings and you have not met your writing goal in the last 24 hours, you are redirected to that deck’s writing page first.
- Session flow:
  - Lessons mix **New Card Intro**, **Speaking Quiz**, and **Outro/Remedial** steps.
  - Each step shows the term/definition, optional image, and instructions. New/Remedial intros require you to repeat the prompt correctly before advancing.
  - Speaking/outro steps require recording an answer; responses are transcribed and auto-graded.
- Controls and hotkeys (bottom control bar):
  - Record/stop: space
  - Play audio: `j` (disabled during speaking quiz)
  - Edit card in a new tab: `n`
  - Skip card: `k`
  - Archive card (pauses it): `l`
  - Fail/I don’t know: `g` (replays audio twice and grades as Again if applicable)
  - Continue/advance: `h`
  - After a correct answer, choose a grade with `a` (Again), `s` (Hard), `d` (Good), `f` (Easy) to schedule the next review.
- Feedback:
  - Success shows difficulty buttons with estimated intervals.
  - Failure shows what you said, feedback, and a **Continue** button that requeues the card as failed.
  - The progress bar indicates lesson completion and cards remaining.
- Study Assistant:
  - Open the chat (speech bubble icon). Ask about recently shown cards or request new practice. Responses stream live; stop streaming if needed.
  - Suggested example phrases include **Add** buttons to instantly create new cards in the current deck.
- End of session: When no items remain, you can fetch more quizzes, jump to **Add more cards**, **Practice Writing**, or return to deck selection.

## Speaking Improvement Drills (/speaking/[deckId])
- Starts a short corrective lesson pulled from your recent incorrect speaking quiz results. Initiates automatically on page load; **Pick Another Issue** restarts.
- Steps include:
  - **Diagnosis**: Shows your incorrect vs. corrected Korean and a short explanation.
  - **Target**: Listen to and repeat a model sentence until it matches.
  - **Contrast** (if provided): Practice a contrasting pattern.
  - **Production**: Respond to an English prompt with Korean; graded with immediate feedback.
- Use the **Speak** button (or space when allowed) to record. Audio playback buttons replay model sentences. Completing the drill marks the source quiz result as reviewed and queues the next issue.

## Writing Practice (/writing/[deckId])
- Start from the deck card’s **Writing Practice** link or visit the URL directly.
- Daily progress bar shows characters written toward your goal (set in Settings); it updates after submissions and during typing.
- Prompt selection:
  - **Write with a prompt** generates multiple prompts. Translate any prompt to English, or open a **Sample response** to read first.
  - Click words in prompts or samples to select them. **Explain Selected Words** fetches definitions; **Create Cards from Words** opens `/create` in a new tab preloaded with those words for a word-list import.
- Writing:
  - Edit the prompt if desired.
  - Tip: wrap unknown words in `?word?` (for example, `?apple?를 먹어요.`) and grading will swap them with an appropriate term.
  - The character counter and progress bar show how close you are to your goal. Click **Save and Review Feedback** to submit.
- Feedback:
  - Shows your text, a corrected version, differences, and bullet feedback. All text is clickable for word explanations; you can again **Explain Selected Words** or **Create Cards from Words**.
  - Buttons: **Write More** (start over) or **Study Cards** (return to the deck).

## Writing History (/writing)
- Browse prior submissions with pagination (5 per page), search text, and optional deck filter.
- Each entry shows date, deck, prompt, and expandable details for your submission, the correction, and a diff.
- Delete an entry with the trash icon (confirmation shown); the page refreshes after deletion. If no submissions exist, the page links you to create a deck and start practicing.

## Card Management (/cards and /cards/[id])
- Card list (`/cards`):
  - Search term/definition, sort by several fields (created date, next review, lapses, etc.), choose sort order, and optionally show only paused cards.
  - Pagination shows 32 cards per page. **Delete Paused Cards** removes all paused items after confirmation.
  - Table columns: paused toggle, term/definition, repetitions, lapses, next review date, created date, and actions. Actions: edit opens the card detail; delete removes the card.
  - Toggling “Paused” flags/unflags a card for review.
- Card detail (`/cards/[id]`):
  - Edit term, definition, and pause state; save or go back. Delete removes the card.
  - View scheduling stats (repetitions, lapses, last/next review via time-until text, stability, difficulty) and the deck’s name, language, and gender. Stats are read-only.
  - If an image exists, it is shown; otherwise, a placeholder note appears.

## Deck Management and Sharing
- Rename, publish/unpublish, delete, and merge decks from `/review` (see Deck Hub above).
- Deleting a deck also deletes its cards; merging moves cards and writing submissions into a new deck and removes the originals.
- Publishing exposes the deck on the Community Decks page; unpublishing hides it.

## Community Decks (/shared-decks)
- Browse published decks with search and optional language filter (Korean is the only listed language).
- Each deck card shows name, card count, owner ID, description (if provided), and a created date when available.
- Buttons:
  - **Report** and **Import** are present but currently have no visible effect; no confirmation or progress is shown after clicking.

## Frequency Lists (/frequency-lists)
- Reference page listing external word-frequency resources for multiple languages (including Korean). Links open in new tabs. A link back to `/create` is provided for quick card creation after browsing.

## Settings and Account (/user)
- Preferences:
  - Audio playback speed slider.
  - New cards per day target (weekly target equals 7× this value).
  - Daily writing goal (characters).
  - Playback percentage (how often your recording is replayed after speaking).
  - **Require daily writing before card review** toggle to enforce writing-first.
  - **Perform corrective reviews** toggle to allow optional post-review drills.
  - Save applies changes and reloads the page; a logout button signs you out.
- Quick stats show totals (cards, new cards, due counts, weekly/new activity, global users, etc.).
- Charts: cumulative cards learned and writing progress over the last 90 days.

## Quiz Results Export (approved users) (/train)
- Restricted to approved accounts; others are redirected to `/user`.
- Shows quiz results from the last 30 days (200 per page) with pagination.
- **Download JSON** saves the current page’s data (including paging info and rows) as a file.

## Admin Tools (super users) (/admin and /link/[userID])
- Access is limited to emails listed in the host’s `AUTHORIZED_EMAILS` environment variable.
- `/admin` lists users with last seen, card counts, studied counts, admin flag, and created date. Clicking a row opens the per-user page.
- `/link/[userID]` shows profile info, counts (cards, studied, paused, decks, writing submissions, quiz results), recent writing, and recent quiz answers. A delete-user form is available (self-delete is blocked).

## Help and Troubleshooting
- Sign-in issues: if an email link opens `/auth/email`, click “Continue to App.” If it fails, the page links to GitHub issues for assistance.
- Microphone errors: allow microphone permissions in your browser/device. The recorder warns you if access fails; iOS Safari users may need to enable microphone access for the PWA.
- No quizzes due: add cards via `/create` or fetch more quizzes from the end-of-lesson screen.
