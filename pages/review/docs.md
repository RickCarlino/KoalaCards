# In-Depth Explanation of `pages/review/[deckId].tsx`

## Overview

`pages/review/[deckId].tsx` is a crucial component in the Koala Cards application, serving as the entry point for the spaced repetition review system. This file implements a Next.js dynamic route page that allows users to review flashcards from a specific deck identified by the `deckId` parameter in the URL.

## Technical Architecture

### Next.js Dynamic Routing

The file leverages Next.js's dynamic routing capabilities, where `[deckId]` in the filename indicates a dynamic route parameter. This allows the application to create unique review pages for each deck in the system.

### Component Structure

The file exports a default React functional component named `Review` that serves as the page component. This component:

1. Fetches quizzes due for review from the server
2. Manages loading and error states
3. Renders the appropriate UI based on the current state
4. Wraps the content with microphone permissions handling

### Data Flow

```mermaid
graph TD
    A[User navigates to /review/[deckId]] --> B[Review component mounts]
    B --> C[useDeckID hook extracts deckId from URL]
    C --> D[fetchQuizzes function called]
    D --> E[trpc.getNextQuizzes mutation]
    E --> F[Server processes request]
    F --> G[Returns quizzes due for review]
    G --> H[Data stored in component state]
    H --> I[ReviewPage component renders with quizzes]
```

## Key Functions and Hooks

### `useDeckID()`

A custom hook that:

- Extracts the `deckId` from the URL using Next.js's `useRouter` hook
- Validates that the `deckId` exists
- Converts the `deckId` string to a number
- Throws an error if `deckId` is missing

### `fetchQuizzes()`

A function that:

- Sets a loading state flag
- Extracts the `take` parameter from the URL query string (defaulting to 21)
- Caps the maximum number of quizzes at 44
- Calls the tRPC mutation `getNextQuizzes` with the `take` and `deckId` parameters
- Updates the component state with the returned data
- Resets the loading state flag

## State Management

The component maintains two key pieces of state:

1. `data`: Contains the quizzes due for review and the total count of quizzes due
2. `isFetching`: A boolean flag indicating whether a fetch operation is in progress

## Integration with Backend

The component uses tRPC to communicate with the backend:

- `trpc.getNextQuizzes.useMutation()` creates a mutation function for fetching quizzes
- The mutation is called with parameters including the deck ID and the number of quizzes to fetch
- The backend processes this request through the `get-next-quizzes.ts` tRPC route

## Conditional Rendering

The component uses conditional rendering to display different UI states:

1. Loading state: Shows "Loading..." while initializing
2. Error state: Displays an error message if the fetch operation fails
3. Review state: Renders the `ReviewPage` component with fetched quizzes when available
4. Empty state: Shows a message with links to add more cards or return to the deck overview when no quizzes are due

## Microphone Permissions

The entire UI is wrapped with the `MicrophonePermissions` component, which ensures that the user has granted microphone access before allowing them to proceed with speaking exercises.

## Database Interaction

While this component doesn't directly interact with the database, it relies on the tRPC route `getNextQuizzes` which:

1. Queries the database for cards due for review in the specified deck
2. Retrieves cards that have failed recently
3. Fetches new cards that haven't been reviewed yet
4. Combines and processes these cards to create quiz objects
5. Returns the quizzes to the client

## Quiz Types and Spaced Repetition

The system supports multiple types of quizzes:

1. **Dictation**: For new cards, where the user listens and types/speaks what they hear
2. **Listening**: Where the user listens to audio and repeats it
3. **Speaking**: Where the user sees text in the target language and speaks it
4. **Review**: For cards that were previously failed, requiring multiple correct repetitions

## Spaced Repetition Algorithm

The application uses the FSRS (Free Spaced Repetition Scheduler) algorithm, as evidenced by the imports from `femto-fsrs`. This algorithm:

1. Calculates optimal intervals between reviews based on difficulty
2. Adjusts card scheduling based on user performance
3. Tracks metrics like stability, difficulty, lapses, and repetitions

## User Experience Flow

1. User navigates to `/review/[deckId]` with a specific deck ID
2. The page loads and fetches quizzes due for review
3. If quizzes are available, the `ReviewPage` component is rendered
4. The user progresses through each quiz, grading their performance
5. After completing all quizzes, a summary is shown
6. The user can save their progress, which updates the scheduling data for each card
7. New quizzes can be fetched by calling `onSave()`

## Integration with Other Components

This page integrates with several key components:

1. `ReviewPage` from `@/koala/review/review-page`: The main component for displaying quizzes
2. `MicrophonePermissions` from `@/koala/microphone-permissions`: Handles microphone access permissions
3. `trpc` from `@/koala/trpc-config`: Provides API communication capabilities

## Error Handling

The component includes error handling for:

1. Missing `deckId` parameter (throws an error)
2. Failed API requests (displays an error message)

## Performance Considerations

1. The component limits the number of quizzes fetched at once (maximum 44)
2. It uses state to avoid unnecessary re-fetching
3. Audio files are pre-fetched for the next quiz to ensure smooth transitions

## Accessibility

The component provides:

1. Clear loading states
2. Error messages
3. Navigation links for users who have no quizzes due

## Technical Debt and Design Decisions

1. The `take` parameter is extracted from the URL, allowing users to customize the number of cards to review
2. The maximum number of cards is capped at 44 to prevent performance issues
3. The component handles both new cards and cards due for review in a unified interface

## Conclusion

`pages/review/[deckId].tsx` serves as the entry point for the spaced repetition review system in Koala Cards. It orchestrates the fetching of quizzes, manages the review state, and provides a user interface for reviewing flashcards. The component integrates with the backend through tRPC, leverages Next.js's dynamic routing capabilities, and provides a seamless user experience for language learning through spaced repetition.
