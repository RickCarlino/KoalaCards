It's a spaced repetition flash card app similar to Anki, or iknow.jp or old versions of Memrise before they pivoted.
The user is shown one "thing" at a time and works their way through the cards until the lesson is over.
Once they finish the lesson, they can study more or exit to "/".

# Coding Conventions

Here all the files that matter:

pages/review-next/[deckId].tsx - The actual page in Next.js
koala/review2/logic.ts         - All the logic, excluding JSX UI components.
koala/review2/card-ui.tsx      - JSX Components
koala/review/**                - The legacy version we are replacing.

# The Overall UI
There are some elements that are shown throught out the lifecycle of the review session:

* A progress bar shows how far through the lesson they've progressed.
* A "Skip" button allows them to remove the card from the current lesson
* An "Archive" button allows them to archive the card (stop studying)
* An "EDIT" button opens the edit page in a new tab: /cards/[cardID]

This UI will wrap a "card type" component that has UI elements specific to the step (details next).

# Common UI: Record button

It will have a countdown timer.

# Common UI: Grade buttons

4 buttons.

# Common UI: Remix Button

...

# Common UI: Progress Bar

Need to add the total starting count.

# Common UI: Ask a question

...

# Common UI: Give Up

Play the term/definition thrice.

# Card Type: newWordIntro
This is the first time a user has seen the card.
They will be show the "term" and "definition" of the card.
They can play the audio.
They will be shown the carad image if it has one, but not all cards have images (the UI needs to handle this gracefully even on mobile).
When the user is ready, they will record a response.
They will wait for the server to check their pronounciation.
They can proceed once it is corrrect.
They must retry if they fail.
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
Description coming soon.

# Card Type: newWordOutro
Description coming soon.

# Card Type: remedialOutro
If user passes speaking exam, we update the card. Unlike speaking exam, it's pass/fail.

# Card Type: pending
Description coming soon.

# Ideas For Later

Make listening and speaking a two part process?

Listinening 1: Repeat the phrase. Write what it means.
Speaking 1: Say the phrase in Korean

--- User presses "Submit for grading and Continue" ---

...User gets feedback later.

If they were correct, they can pick a grade.
If they were wrong, they can re-grade (and wait), re-listen to their response then finally continue to the next card.