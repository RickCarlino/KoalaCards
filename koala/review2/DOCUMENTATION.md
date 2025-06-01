It's a spaced repetition flash card app similar to Anki, or iknow.jp or old versions of Memrise before they pivoted.
The user is shown one "thing" at a time and works their way through the cards until the lesson is over.
The thing varies on context. It might be:

 * A new card they are learning for the first time (new card review).
 * An overview of a card they recently failed a quiz on (remedial review).
 * AI feedback for a card they finished testing on.
 * A "repeat after me" drill (a listening quiz)
 * A speaking drill (user is asked to say a phrase in the target language)
 * A quiz on a remedial or new card review that was presented at lesson start.

Once they finish the lesson, they can study more or exit to "/".

# Coding Conventions

Here some (not all) relevant files:

pages/review-next/[deckId].tsx - The actual page in Next.js
koala/review2/logic.ts - All the logic, excluding JSX UI components.
koala/review2/card-ui.tsx - JSX Components
koala/review/\*\* - The legacy version we are replacing.

# The Overall UI

There are some elements that are shown throught out the lifecycle of the review session:

- A progress bar shows how far through the lesson they've progressed.
- A "Skip" button allows them to remove the card from the current lesson
- An "Archive" button allows them to archive the card (stop studying)
- An "EDIT" button opens the edit page in a new tab: /cards/[cardID]

This UI will wrap a "card type" component that has UI elements specific to the step (details next).

# Common UI: Record button

All recording will be limited to 10 seconds.
The user presses the record button.
It changes color and begins a countdown.
They can click it again or wait for the timer to finish, at which point it will grab whatever was recorded (much of the infra for this is working just fine in the old version)

# Common UI: Grade buttons

We use the FSRS algorithm, so we need "AGAIN", "HARD", "GOOD", "EASY" buttons.

# Common UI: Remix Button

The user can create new cards based off of old cards. We are going to just use the old modal for this one.

# Common UI: Progress Bar

The progress bar proceeds as the user finishes each item in the lesson.

# Common UI: Ask a question

The user can shift to a chat session with an LLM to ask questions.

# Common UI: Give Up

The "I don't know" button for hard quizzes.
Play the term/definition thrice and then proceed to the next card.

# Common UI: Give Up

It's like giving up, but you will be quizzed on it later.

# CARD TYPES

There are several "card" types in the lesson state. These are just stages of the lesson.

# Card Type: newWordIntro

This is the first time a user has seen the card.
They will be show the "term" and "definition" of the card.
They can play the audio.
They will be shown the card image if it has one, but not all cards have images (the UI needs to handle this gracefully even on mobile).
When the user is ready, they will record a response.
They will wait for the server to check their pronounciation (we will re-use much of the logic and trpc methods from the old versions).
They can proceed once it is corrrect.
They must retry (or give up or skip) if they fail.
They will be quizzed at the end of the lesson via forced active recal (shown english, expected to recite in target language)

# Card Type: remedialIntro

The user has seen this one before, but they failed a quiz previously.
It is like the new word card except that the user already saw the card.

# Card Type: listening

They are shown the image if present.
They will hear the phrase in target language
They will recite the phrase again.
If they pronounce correctly, it will play the english definition.
It will render the term and definition.
There will be 4 buttons to select a difficulty level, like in Anki (see the legacy version for inspiration)

# Card Type: speaking

They are shown the image if present.
They will hear the phrase in English
They will recite the phrase in the target language.
The server will grade their response in the background async.
It will render the term and definition.
There will be 4 buttons to select a difficulty level, like in Anki (see the legacy version for inspiration)
Later, they will get feedback when it comes back from the server.

# Card Type: feedback

AI Grading is slow. Instead of forcing the user to wait after they submit a recording for grading, we move to the next card and manage a pending items queue. Once the grading is done, the next item in the lesson will be a review of what they said, why it was wrong, etc...

# Card Type: newWordOutro

We showed them the term and definition at the lesson's start.
At the end of the lesson, we ask them to do a forced recall of the word (hear english prompt => produce target language sentence from memory)

# Card Type: remedialOutro

If user passes speaking exam, we update the card. Unlike speaking exam, it's pass/fail.

# Card Type: pending

If the user finished all of the lesson, but stuff is still grading (pending queue length > 0) we tell them to please wait.

# Ideas For Later

Make listening and speaking a two part process?

Listinening 1: Repeat the phrase. Write what it means.
Speaking 1: Say the phrase in Korean

--- User presses "Submit for grading and Continue" ---

...User gets feedback later.

If they were correct, they can pick a grade.
If they were wrong, they can re-grade (and wait), re-listen to their response then finally continue to the next card.
