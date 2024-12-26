# Card Remix Design Document

## 1. Overview & Goals

The **Card Remix** feature allows users to generate additional variations of a difficult card. By prompting an LLM to create new sentences that utilize the same core grammar and vocabulary, users can bolster their understanding of tricky concepts. The goal is to help learners:

1. **Reinforce Grammar**: Revisit (and vary) the same grammatical structures in fresh contexts.
2. **Expand Vocabulary Use**: See difficult words in multiple, slightly different sentences.
3. **Break Study Plateaus**: Provide variety for “stuck” users who keep failing the same card.

## 2. User Stories

1. **Stuck on a Hard Card**:
   - *As a user who keeps failing a particular Korean verb usage card,*
   - *I want to generate more example sentences using that same verb,*
   - *So that I can see it in multiple contexts and finally understand how to use it.*

2. **Want to Build Depth**:
   - *As a user who learns better through patterns,*
   - *I want to create multiple examples of a single grammar structure,*
   - *So that I can solidify the pattern in different contexts.*

3. **Minimal Overhead**:
   - *As a busy learner,*
   - *I want the remix process to be simple and not disrupt my existing review flow,*
   - *So that I don’t lose focus or get overwhelmed by new features.*

## 3. High-Level Flow

1. **Trigger Remix**
   The user selects a difficult card and clicks a “Remix” button or link.
2. **Configure Remix Options (Optional)**
   A modal or panel opens, allowing the user to specify how many variations to generate, the complexity level, or additional constraints (e.g., “Use the same verb, but in different tenses”).
3. **LLM Generation**
   The app sends a request to the LLM provider to create a specified number of new card variations.
4. **Preview & Refine**
   The user previews the newly generated content. They can discard or tweak any sentence before finalizing.
5. **Create New Cards**
   Approved remixes become newly generated cards in the user’s deck, automatically scheduled for future review.
6. **Return to Review Flow**
   The user either continues their current study session or exits the remix wizard.

## 4. Detailed User Flow

### Step 1: Identify a Difficult Card
- **Location**: Review Wizard → “Finalizing the Review” screen OR Card Detail Page.
- **Action**: User sees a card that they frequently fail (or rates as “AGAIN”).
- **Trigger**: The user clicks on the “Remix” button.

<details>
<summary>Wireframe: Card Review Screen</summary>

```
+----------------------------------------------------+
| 1. Card Prompt                [Remix] [Pause Card] |
|                                                    |
|     Target Language: “동물원에 갔어요.”            |
|     English: “I went to the zoo.”                  |
|                                                    |
| 2. Self-Assessment Buttons: [AGAIN] [HARD] [GOOD]  |
+----------------------------------------------------+
```
</details>

### Step 2: Remix Modal Opens
- **UI Element**: A modal overlay appears, prompting the user to specify remix settings.
- **Default Behavior**: If the user doesn’t want to configure anything, they can simply press “Remix Now” to accept defaults.

<details>
<summary>Wireframe: Remix Modal (Configuration)</summary>

```
+--------------------------------------------------+
|            CREATE A CARD REMIX                   |
|  [X]                                             |
|--------------------------------------------------|
|  Generate how many variations?   [  3  ]          |
|  Difficulty level?               [★ ★ ☆]         |
|  Additional instructions:                        |
|     "Focus on past tense usage."                 |
|--------------------------------------------------|
|               [ Cancel ]  [ Remix Now ]          |
+--------------------------------------------------+
```
</details>

### Step 3: LLM Generation
- **Back-End Action**:
  - The app compiles the user’s target phrase, translations, grammar focus, and additional instructions.
  - Sends a request to the LLM with these parameters.
  - Waits for a response, typically 1–5 seconds.
- **UX Consideration**: Display a loading indicator or progress bar in the modal to signal that content is generating.

### Step 4: Preview & Refine
- **Modal Display**: Shows the newly created sentences (proposed new cards).
- **Actions**:
  - *Approve/Discard Individual Variations*: Each variation can be toggled on/off.
  - *Quick Edit*: Minor edits to the sentence or translation if the LLM output is partially incorrect.
  - *Compare**: A small “Compare” panel might show the original card text side by side with each new variation.

<details>
<summary>Wireframe: Remix Modal (Preview)</summary>

```
+-----------------------------------------------------------------------------------+
|             REVIEW YOUR NEW REMIXES                                              |
| [X]                                                                               |
|-----------------------------------------------------------------------------------|
| Original Card:                                                                    |
|   - KO: "동물원에 갔어요"   EN: "I went to the zoo."                                |
|-----------------------------------------------------------------------------------|
| 1) KO: "저는 지난주에 동물원에 또 갔어요."    [ ✓ Use this sentence ]               |
|    EN: "I went to the zoo again last week."        [ Edit ]  [ Discard ]         |
|-----------------------------------------------------------------------------------|
| 2) KO: "동물원에 가는 것은 재미있어요."       [   Use this sentence ]               |
|    EN: "Going to the zoo is fun."                   [ Edit ]  [ Discard ]         |
|-----------------------------------------------------------------------------------|
| 3) KO: "주말마다 동물원에 가고 싶어요."         [ ✓ Use this sentence ]             |
|    EN: "I want to go to the zoo every weekend."     [ Edit ]  [ Discard ]         |
|-----------------------------------------------------------------------------------|
|                                    [Back to Configure]  [Finalize & Add to Deck]  |
+-----------------------------------------------------------------------------------+
```
</details>

### Step 5: Finalize & Create New Cards
- **Action**: Clicking **“Finalize & Add to Deck”** inserts the user-approved remixes as **new cards**:
  - Each new card has a distinct ID.
  - The “Term” is the new target-language sentence.
  - The “Definition” is the user-approved English translation.
  - Other metadata such as hints, grammar tags, or deck ID is carried over from the original.
- **Scheduling**: The new cards will appear in the next session. The user is not forced to review them immediately.

### Step 6: Return to Review Flow
- **Modal Closes**: The user is taken back to either the review wizard or the card detail page, depending on where they initiated the remix.
- **Success Message**: A short toast or inline alert confirms that new cards were successfully added.
## 5. Edge Cases & Error States

1. **LLM Timeout or Error**:
   - Show an error message and a “Retry” button.
   - Provide a fallback suggestion: “Try fewer variations” or “Check your internet connection.”

2. **Inappropriate or Low-Quality Output**:
   - The user can discard or edit any generated sentence.
   - Maintain a quick “Report Content” button for spam or inappropriate LLM output (this may require a future moderation flow).

3. **User Cancels Midway**:
   - If the user closes the modal, do not create any new cards.
   - Return them to their previous view seamlessly.

4. **Multiple Remixes**:
   - The user might remix a single card multiple times. Ensure the new cards are distinct. Possibly show a gentle reminder: “You’ve already remixed this card. Continue anyway?”

5. **Language Ambiguity**:
   - If a card does not have a clearly set “target language,” prompt the user to pick from their active language list.
   ## 6. Visual Design Guidelines

1. **Modal Layout**:
   - Clean, center-aligned.
   - Use the brand’s color scheme for the “Remix Now” button, with a secondary neutral button for “Cancel.”

2. **Icons / Buttons**:
   - **Remix Button**: A small “shuffle” or “refresh” icon next to the “Remix” text.
   - **Approve/Discard**: Use check/uncheck toggles or a “trash” icon for discarding.

3. **Animations**:
   - Loading spinner with a short descriptive label (“Generating new sentences…”).
   - Subtle fade-in for new content.

4. **Text Legibility**:
   - Ensure font sizes meet accessibility guidelines (especially for non-Latin alphabets like Korean).
   - Keep translations separated visually from the target language to avoid confusion.

5. **Responsive Design**:
   - On mobile, the modal becomes a fullscreen overlay.
   - The “Compare” panel can collapse into an accordion if screen real estate is limited.

## 8. Future Enhancements

1. **Grammar Tag Suggestions**:
   - The LLM could automatically tag the new cards with grammatical categories.
2. **Remix History Panel**:
   - Show the user a history of all remixes performed on a single card for easy reference.
3. **Vocabulary Focus**:
   - Allow the user to highlight specific words to ensure they appear in the new sentences.
4. **Reverse Remix** (e.g., from English → Korean or from Spanish → English) if multiple languages are used in the same deck.
## 9. Conclusion

By creating a **Card Remix** feature, we empower users to generate fresh, contextually relevant content for difficult grammar and vocabulary. The design focuses on simplicity, minimal user effort, and maintainable interface elements (through a modal-based approach). This feature not only boosts user engagement but also addresses a primary cause of user frustration: repeatedly failing the same difficult cards without reinforcement from varied examples.
