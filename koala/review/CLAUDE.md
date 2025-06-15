# TODO - Broke

- Archive does not skip to next.
- The "How would you say" UI gives away the answer by playing the term. (koala/review/lesson-steps/remedial-outro.tsx)
- It's possible to record at strange times. Need a way of knowing when recording is even required maybe? Maybe the problem is that there is a "tri-state" step but we should be using queues.

# TODO - Cleanup

- Run ts-unused-exports
- Remove or implement "// Unused ... ?" state tree branches
- Re-write this doc after analysis.
- Claude CLI custom notification hook??
- UI on the "Not quite right" page sucks. Explanation should be more legible.
- When you get a speaking quiz correct, play quiz.term. (? Maybe not ?)

# TODO - Features

- Implement O3 based follow-up lessons. PROMPT: https://chatgpt.com/c/684de073-9bbc-8010-8dbb-607c8e367de1
- Add playFX after finding a good free sound pack
- Bring back the `take` param maybe hmm
- show tips and tricks while loading.

Dead exports: koala/review/types.ts: QuizList, Quiz, RecordingCapturedAction, ClearRecordingAction, CompleteItemAction, GiveUpAction
Dead exports: koala/review/components/index.ts: CardImage, FailureView, GradingSuccess
Dead exports: koala/review/hooks/index.ts: usePhaseManager, useRecordingProcessor, useGradeHandler, useAudioPlayback
Dead exports: koala/trpc-routes/grade-writing.ts: FeedbackItem, ApiResponse, EssayResponse

---

This is a spaced repetition flash card app that guides the user through steps of a structrued review one "thing" at a time and works their way through the cards until the lesson is over.

The thing varies on context. It might be:

- A new card they are learning for the first time (new card review).
- An overview of a card they recently failed a quiz on (remedial review).
- AI feedback for a card they finished testing on.
- A "repeat after me" drill (a listening quiz)
- A speaking drill (user is asked to say a phrase in the target language)
- A quiz on a remedial or new card review that was presented at lesson start.

Once they finish the lesson, they can study more or exit to "/".

# Coding Conventions

Here are the relevant files:

pages/review-next/[deckId].tsx - The actual page in Next.js
koala/review2/index.tsx - Main component that renders card types with control bar
koala/review2/reducer.ts - State management, reducer logic, and main useReview hook
koala/review2/types.ts - TypeScript types and interfaces
koala/review2/control-bar.tsx - Fixed bottom control bar with buttons and progress
koala/review2/lesson-steps/_.tsx - Individual card type components
koala/review2/replace-cards.ts - Logic for initializing cards into queues
koala/review2/use-_.ts - Custom hooks for voice grading, transcription, etc.
koala/review/\*\* - The legacy version we are replacing.

# The Overall UI

The main component (index.tsx) renders:

- A card-specific component based on the current item type
- A fixed bottom control bar with universal buttons and progress

The control bar includes:

- Progress ring showing completion percentage
- Exit button (links to home "/")
- Edit button (opens card editor in new tab)
- Archive button (placeholder - logs to console)
- Give up button (removes card from lesson with "F" icon)
- Skip button (removes card from current lesson)
- Play audio button (plays term audio)
- Record button (starts/stops voice recording)

# Common UI: Record button

Recording is handled in the control bar:

- User presses the microphone button to start recording
- Button changes to stop icon while recording
- User can click again or wait for automatic timeout
- Recording is processed as base64 audio and passed to the current card component

# Common UI: Progress Bar

The progress ring in the control bar shows completion as a percentage:

- Based on itemsComplete / totalItems
- Updates automatically as items are completed

# CARD TYPES

There are several card types, each implemented as a separate component in lesson-steps/:

# Card Type: newWordIntro (COMPLETE)

Located: lesson-steps/new-word-intro.tsx
This is the first time a user has seen the card.

- Shows term, definition, and image (if present)
- Plays term audio automatically on load
- User records their pronunciation attempt
- Uses voice transcription to check pronunciation
- Shows visual diff if incorrect, allows retry
- On success, plays definition audio then term audio, then proceeds
- Handles recording via recordings prop from control bar

# Card Type: remedialIntro (COMPLETE)

Located: lesson-steps/remedial-intro.tsx
The user has seen this card before but failed a quiz previously.

- Similar to newWordIntro but shows "Reviewing Previous Mistake" header
- Same pronunciation checking flow as newWordIntro
- Uses voice transcription for grading

# Card Type: listening (NOT COMPLETE)

Located: lesson-steps/listening.tsx
Currently shows "TODO: Listening" placeholder.
Intended to be a repeat-after-me drill:

- User hears phrase in target language
- They repeat it back
- If correct, plays English definition and shows grading buttons

# Card Type: speaking (COMPLETE)

Located: lesson-steps/speaking.tsx
User is asked to translate from English to target language:

- Shows "Say '[definition]' in the target language"
- User records their attempt
- Uses voice grading (more sophisticated than transcription)
- On success: shows grading success component with FSRS buttons (Again/Hard/Good/Easy)
- On failure: shows feedback and "Continue" button, automatically grades as "Again"

# Card Type: newWordOutro (COMPLETE)

Located: lesson-steps/new-word-outro.tsx
Final quiz on new cards introduced at lesson start:

- Shows "How would you say '[definition]'?"
- User must recall and speak the target language term
- Uses voice grading like speaking quiz
- Success shows FSRS grading buttons
- Failure shows feedback and continues with "Again" grade

# Card Type: remedialOutro (COMPLETE)

Located: lesson-steps/remedial-outro.tsx
Similar to newWordOutro but for cards that were previously failed.
Currently implemented identically to newWordOutro.

# State Management

The app uses a reducer pattern with these key concepts:

## Queue System

Cards are organized into priority-ordered queues:

1. newWordIntro
1. remedialIntro
1. listening
1. speaking
1. newWordOutro
1. remedialOutro

Certain reducer actions, such as skipping an item, failing an item, etc.. cause the current item to change.

It is important that the reducer can add and remove items from the review in the background without accidentally switching the current item (this is why we explicitly set the current item in the state tree).

## Card Initialization

When cards are fetched (replace-cards.ts):

- "new" lesson type → creates newWordIntro + newWordOutro items (2 total items)
- "remedial" lesson type → creates remedialIntro + remedialOutro items (2 total items)
- "listening" lesson type → creates listening item (1 total item)
- "speaking" lesson type → creates speaking item (1 total item)

## Actions

- REPLACE_CARDS: Initialize cards into queues
- SKIP_CARD: Remove all items for a card from all queues
- GIVE_UP: Same as skip but increments completion count
- RECORDING_CAPTURED: Store audio recording by stepUuid
- CLEAR_RECORDING: Remove stored recording
- COMPLETE_ITEM: Remove item by stepUuid and proceed to next

## Custom Hooks

- useVoiceTranscription: Simple pronunciation checking (used in intro cards)
- useVoiceGrading: Advanced AI grading with feedback (used in quiz cards)
- useQuizGrading: FSRS grading integration with server
- useReview: Main hook that manages the entire lesson state

# Ideas For Later

Make listening and speaking a two part process?

Listening 1: Repeat the phrase. Write what it means.
Speaking 1: Say the phrase in Korean

--- User presses "Submit for grading and Continue" ---

...User gets feedback later.

If they were correct, they can pick a grade.
If they were wrong, they can re-grade (and wait), re-listen to their response then finally continue to the next card.
