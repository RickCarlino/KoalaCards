## The Review Session

After logging in and creating a deck of cards, the user clicks on the tile representing a specific deck. This begins a "review session," which includes reviewing 7 cards at a time.

The general flow for each individual review is as follows:

1. The user sees a **prompt**, such as an audio play button or a sentence to read in the target language.
2. The user provides a **response**, such as text or audio input.
3. The user is asked to provide a **self-assessment**, where they pick a difficulty rating: AGAIN (or "WRONG" in the case of failed quizzes), HARD, GOOD, EASY.
4. The app progresses to the next review, or if all reviews are completed, it waits for the server to grade the quizzes ("grading").

## Prompts, Progression, and Grading

The system is designed to support an arbitrary number of quiz types.

Each quiz type has:

- A **prompt**: A UI that presents a gradable task the user must complete.
- A **progression**: An action the user must take to progress to the next quiz, such as speaking into a microphone, typing a response, or selecting a multiple-choice question.
- A **grading system**: A server-side action that happens in the background to check the user's answer. This helps the user know if they failed. For example, if the user thought they provided the correct voice response, but it did not match the expected term, grading helps them correct their perceived difficulty level to "AGAIN."

The UI dynamically renders a dispatched component based on the current quiz type.

### Example Prompts, Progression, and Grading:

- **Listening**: A sentence in the target language plays. The user can replay it by pressing the "play" button. The user progresses by typing an English translation of what they heard. The quiz is graded by an LLM trained to match equivalent phrases.
- **Dictation**: The user hears audio (or presses play to hear it again). They progress by recording an audio sample, repeating the phrase into the microphone. The quiz is graded via string matching after transcription using OpenAI Whisper.
- **Speaking**: The user is shown an English sentence and must translate it into the target language. They progress by speaking into the microphone in the target language. The server grades the quiz using audio transcription and LLM-assisted equivalence detection.

Other quiz types that might be supported in the future include multiple choice, picture identification, short essay response, Chinese character drawing, etc.

In all cases, the response is sent to the server (usually text, sometimes base 64 WAV audio) for grading. After performing the quiz, the user must select a perceived difficulty level (AGAIN, HARD, GOOD, EASY). The grade is not finalized until all 7 cards have been reviewed.

## New Card Prompts

Each card has a past review count. If the number is zero, it means the user has never seen the card before. When the card is completely new, a special "new review" type is performed. This review is generally easier than a normal review and involves the user interacting with a display page that shows information about the card (term, definition, audio, illustrations, etc.).

Each quiz type dynamically decides how the new card prompt is rendered. For example, sometimes it is as simple as reading a phrase or listening to audio.

## Giving Up

If the user does not know how to respond, they can give up by clicking "Fail." The difficulty will be set to "AGAIN," and they will immediately be asked to do a corrective task, usually a dictation drill.

## Finalizing the Review

Once all 7 cards have been reviewed, the user is presented with a table of foldable rows with color-coded results. The tiles will have the following color codes:

- **No color**: The user passed without issue.
- **Red**: The server graded the user's response as incorrect.
- **Yellow**: A server-side error occurred.
- **Gray**: Still awaiting a response from the server.

The user can unfold each tile to reveal the following information:

1. The user-selected difficulty level. This is set to "AGAIN" if server grading fails. The user is free to change this grade if they disagree.
2. User-provided artifacts, such as transcriptions received from the server or input provided.
3. Card information, such as the term/definition or illustrations.

In the background, the app downloads the next 7 cards. If the server returns zero cards due for review, an "End Session" button is displayed.

If the server returns more cards, a "Continue studying" button appears.

Once the user clicks either button, the results are committed to the server-side database, and the scheduling data for the cards is updated accordingly. Closing the browser tab early will cause changes to be lost, so the user should be warned.

The process continues until there are no more reviews left.

## Pausing Reviews

Sometimes a user may want to stop learning a card. Every step of the review wizard exposes a "pause reviews" button (known internally as "flagging" a card). This calls a tRPC method on the backend that sets the card's "flagged" value to true, meaning it will never be scheduled for review again once flagged.

## Adding Notes

Every step of the review wizard includes an "add note" feature, which allows the user to attach comments to a specific card. This is handled via the "addCardComment" feature. Examples of comments:

- Why they got a card wrong.
- TODO items for later, such as adding more related cards.

The comments can be viewed later in a different part of the application.

## Exiting Early

If the user wants to exit a session early, they can click "End Session," which will take them to the menu described in the "Finalizing the Review" section.

## Editing Cards

The user can edit the currently displayed card at any time. This is useful for fixing typos or making quick changes.
