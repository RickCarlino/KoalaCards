# KoalaCards Review System

A spaced repetition flashcard system that guides users through structured lessons with voice recognition and AI grading.

## Overview

The review system presents cards one at a time through different learning phases:

- **New cards**: First exposure with pronunciation practice
- **Remedial cards**: Review of previously failed cards
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
  │   ├── speaking.tsx
  │   ├── new-word-outro.tsx
  │   └── remedial-outro.tsx
  └── use-*.ts                      # Custom hooks for voice processing
koala/review/**                     # Legacy version (being replaced)
```

### State Management

The system uses a reducer pattern with priority-ordered queues:

1. `newWordIntro` - Initial card presentation
1. `remedialIntro` - Review of failed cards
1. `speaking` - Production practice
1. `newWordOutro` - New card quiz
1. `remedialOutro` - Remedial card quiz

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
- **"speaking"**: Creates single `speaking` item

## Custom Hooks

- **`useVoiceTranscription`**: Simple pronunciation validation (intro cards)
- **`useVoiceGrading`**: Advanced AI grading with feedback (quiz cards)
- **`useQuizGrading`**: FSRS integration for spaced repetition
- **`useReview`**: Main state management hook

## Pending Tasks

### Improvements

- [ ] Incorrect speaking answers are not being graded?
- [ ] Sometimes it plays card.term at the start of a speaking and remedial exam!?!?
- [ ] Disable recording after you get it right.
- [ ] Improve legibility of error explanations
- [ ] Need silence detection or something.
- [ ] Need to show card.term on correct explanation view so that "Yes" explanations make sense.
- [ ] Try to translate the writing prompt generator to Korean to see if it improves prompt quality.
- [ ] Change "In the target language" to "Korean"
- [ ] Play audio term on speakign test failure
- [ ] handle accidental hotkey accidents [holding down j key craziness]
- [ ] "How would you say" audio play button is not grayed out
- [ ] CONTINUE: "h" breaks reviews if pressed while using app.

### Features

- [ ] Really need to add a chat bot with Q/A and card generation ability.
- [ ] KoalaMUD - text based quests. a user, a dungeon master LLM and NPC LLM. User goes on quests.
- [ ] Need to re-visit the Cloze/word Occlusion idea
- [ ] Add loading tips and tricks display
- [ ] O3-based follow-up lessons / dynamic grammar improvement ([spec](https://chatgpt.com/c/684de073-9bbc-8010-8dbb-607c8e367de1))
- [ ] Situation/Goal/Guide/Player conversation.
- [ ] Sound effects integration (pending free sound pack)
- [ ] N second countdown for feedback.
- [ ] Refactor the unknown words dialog in writing section to have a "phrases" / "words" toggle.

### Future Ideas

Two-phase grading for listening/speaking:

1. User completes exercise and submits
2. Async grading with later feedback
3. Correct: Choose grade level
4. Incorrect: Re-listen to attempt, then continue

### Prompt For Followups

You are a teaching-content generator for a multilingual language-learning app.

INPUT  
• A batch of rows, each with:  
 id, definition (English), acceptable (correct target-language answer),  
 provided (learner answer), corrected (human feedback – trust this).

TASK  
For every row where provided ≠ acceptable:

1. From corrected, isolate every distinct misunderstanding, keeping
   vocabulary errors separate from grammar / particle / ending errors.  
   – Ignore purely A1/A2 issues (e.g. copula, basic particles, simple word order).  
   – Deduplicate identical items across the batch.

2. For **each misunderstood item** create **3–5** short, natural sentences that
   model correct use.  
   • ≤ 15 words / ≤ 20 syllables.  
   • Roughly B1–B2 difficulty (or learner level if given).  
   • Vary tense, politeness, style, and topic.  
   • Target language only; **no romanization, IPA, or explanations, no Korean personal pronouns.**  
   • Include the target word / pattern **exactly once** per sentence.  
   • Write idiomatically for the target language—use normal word order,
   pronoun usage, particles, and discourse markers typical of native speech;
   do **not** mirror English structure.
   • Don't make it sound like an English sentence that was translated. Eg: Koreans never say 그는, 그녀, 당신, etc.. that's not natural and direct translations don't help students learn.

OUTPUT  
Return one **JSON array**. Each element must be:

{
"definition": "<English translation of the drill sentence>",
"term": "<drill sentence in the target language>"
}

No other keys, text, or wrapping.  
Begin when ready and output JSON only.
