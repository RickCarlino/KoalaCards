# KoalaCards Review System

A spaced repetition flashcard system that guides users through structured lessons with voice recognition and AI grading.

## Overview

The review system presents cards one at a time through different learning phases:

- **New cards**: First exposure with pronunciation practice
- **Remedial cards**: Review of previously failed cards
- **Listening drills**: Repeat-after-me exercises (pending implementation)
- **Speaking drills**: Translation from English to target language
- **Quizzes**: Final assessment with FSRS grading

After completing a lesson, users can continue studying or return to the home page.

## Architecture

### File Structure

```
pages/review-next/[deckId].tsx      # Next.js page entry point
koala/review2/
  ├── index.tsx                     # Main component with control bar
  ├── reducer.ts                    # State management and useReview hook
  ├── types.ts                      # TypeScript definitions
  ├── control-bar.tsx               # Fixed bottom navigation and controls
  ├── replace-cards.ts              # Card queue initialization logic
  ├── lesson-steps/                 # Individual card type components
  │   ├── new-word-intro.tsx
  │   ├── remedial-intro.tsx
  │   ├── listening.tsx
  │   ├── speaking.tsx
  │   ├── new-word-outro.tsx
  │   └── remedial-outro.tsx
  └── use-*.ts                      # Custom hooks for voice processing
koala/review/**                     # Legacy version (being replaced)
```

### State Management

The system uses a reducer pattern with priority-ordered queues:

1. `newWordIntro` - Initial card presentation
2. `remedialIntro` - Review of failed cards
3. `listening` - Audio comprehension
4. `speaking` - Production practice
5. `newWordOutro` - New card quiz
6. `remedialOutro` - Remedial card quiz

**Key Actions:**

- `REPLACE_CARDS`: Initialize cards into appropriate queues
- `SKIP_CARD`: Remove all instances of a card from queues
- `GIVE_UP`: Skip with completion count increment
- `RECORDING_CAPTURED`: Store user audio by stepUuid
- `CLEAR_RECORDING`: Remove stored audio
- `COMPLETE_ITEM`: Mark complete and advance to next

**Important:** The current item is explicitly tracked to prevent accidental switching during background queue operations.

## UI Components

### Control Bar

Fixed bottom bar with:

- **Progress ring**: Shows `itemsComplete / totalItems` percentage
- **Exit button**: Returns to home (`/`)
- **Edit button**: Opens card editor in new tab
- **Give up button**: Removes card with failure icon
- **Skip button**: Removes card from current lesson
- **Play audio**: Plays term pronunciation
- **Record button**: Toggles voice recording

### Recording Flow

1. User clicks microphone button to start
2. Button shows stop icon during recording
3. Recording stops on click or timeout
4. Audio processed as base64 and passed to card component

## Card Types

### New Word Introduction ✓

**File:** `lesson-steps/new-word-intro.tsx`

First exposure to a new card:

- Displays term, definition, and image
- Auto-plays term audio on mount
- User records pronunciation
- Voice transcription validates accuracy
- Shows diff on error, allows retry
- Success triggers definition → term audio → advance

### Remedial Introduction ✓

**File:** `lesson-steps/remedial-intro.tsx`

Review of previously failed cards:

- Shows "Reviewing Previous Mistake" header
- Otherwise identical to new word introduction flow

### Listening Drill ⏳

**File:** `lesson-steps/listening.tsx`

**Status:** Not implemented (shows TODO placeholder)

**Planned behavior:**

- Play phrase in target language
- User repeats what they hear
- Validate and show grading options on success

### Speaking Drill ✓

**File:** `lesson-steps/speaking.tsx`

Translation from English to target language:

- Prompts: "Say '[definition]' in [target language]"
- Records user attempt
- AI voice grading with feedback
- Success: FSRS grading buttons (Again/Hard/Good/Easy)
- Failure: Shows feedback, auto-grades as "Again"

### New Word Quiz ✓

**File:** `lesson-steps/new-word-outro.tsx`

Final assessment of newly learned cards:

- Prompts: "How would you say '[definition]'?"
- Tests recall without visual cues
- Voice grading determines success
- FSRS grading on success, auto "Again" on failure

### Remedial Quiz ✓

**File:** `lesson-steps/remedial-outro.tsx`

Currently identical to new word quiz.

## Card Initialization

**File:** `replace-cards.ts`

Lesson types determine queue population:

- **"new"**: Creates `newWordIntro` + `newWordOutro` (2 items)
- **"remedial"**: Creates `remedialIntro` + `remedialOutro` (2 items)
- **"listening"**: Creates single `listening` item
- **"speaking"**: Creates single `speaking` item

## Custom Hooks

- **`useVoiceTranscription`**: Simple pronunciation validation (intro cards)
- **`useVoiceGrading`**: Advanced AI grading with feedback (quiz cards)
- **`useQuizGrading`**: FSRS integration for spaced repetition
- **`useReview`**: Main state management hook

## Pending Tasks

### UI Improvements

- [ ] Improve legibility of error explanations
- [ ] Disable recording after you get it right.

### Features

- [ ] Add loading tips and tricks display
- [ ] Implement listening drill functionality
- [ ] O3-based follow-up lessons / dynamic grammar improvement ([spec](https://chatgpt.com/c/684de073-9bbc-8010-8dbb-607c8e367de1))
- [ ] Situation/Guide/Player/Goals conversation.
- [ ] Sound effects integration (pending free sound pack)
- [ ] Consider restoring `take` parameter for lesson size
- [ ] N second countdown for feedback.

### Future Ideas

Two-phase grading for listening/speaking:

1. User completes exercise and submits
2. Async grading with later feedback
3. Correct: Choose grade level
4. Incorrect: Re-listen to attempt, then continue
