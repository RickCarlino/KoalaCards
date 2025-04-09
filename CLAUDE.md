# KoalaCards: A Listening & Speaking Flashcard App

KoalaCards is a modern spaced repetition system designed specifically for language learners who want to improve their listening and speaking abilities. Unlike traditional flashcard apps that require manual self-assessment, KoalaCards leverages automated, machine-assisted grading to deliver objective results, making the learning process both efficient and engaging.

---

## Overview

- **Purpose:**  
  KoalaCards helps users learn a target language by practicing and reinforcing phrases and vocabulary through listening and speaking quizzes. It is primarily tailored for English speakers learning Korean, while also offering beta support for Spanish, French, and Italian.

- **Core Innovations:**  
  - **Objective Grading:** Instead of relying on self-assessment, the app uses speech-to-text technology combined with large language models (such as GPT-3) to evaluate spoken answers objectively.
  - **Spaced Repetition:** Utilizes the FSRS scheduling algorithm to optimize review intervals based on individual performance metrics including stability, difficulty, and repetition count.
  - **Dual Quiz Modalities:**  
    - **Listening Quiz:** Users listen to a spoken target phrase and then translate it into English.  
    - **Speaking Quiz:** Users are prompted with an English sentence and must speak the corresponding phrase in the target language. The app records, transcribes, and grades the spoken response.

---

## Application Architecture

### Frontend (Pages & Components)

- **Next.js Framework:**  
  The project organizes its UI around Next.js’ file-based routing (all TSX files are located in the `pages/` directory). Key pages include:
  - **Home and Dashboard:** Entry points like `index.tsx` and `user.tsx` that provide overviews and user-specific information.
  - **Quiz Interfaces:** Dedicated pages such as `review.tsx`, `train.tsx`, and specialized card views in subdirectories (e.g., `pages/cards/[card_id].tsx`) present quizzes and manage interactive review sessions.
  - **Authentication:** Pages under `pages/auth/` (e.g., `email.tsx`) handle email magic link and Google Sign-In authentication flows.

- **Reusable Components:**  
  The app employs a series of React components (often located in the `koala/components/` directory) for functionalities including:
  - Audio features: Components for recording (e.g., `record-button.tsx`), playback (`play-audio.tsx`, `play-fx.tsx`), and microphone permissions.
  - UI Enhancements: Elements like remix buttons and error reporting tools enhance the user interface and experience.
  - Dynamic deck and quiz management to seamlessly integrate user input, review queues, and interactive learning sessions.

### Backend & Data Model

- **Prisma ORM & PostgreSQL:**  
  The data layer relies on Prisma, as defined in the `prisma/schema.prisma` file, with models for:
  - **User Management:**  
    - `User`, `Account`, `Session`, and `VerificationToken` manage user credentials, sessions, and authentication.
    - `UserSettings` allows customization of learning parameters (e.g., audio playback speed, maximum cards per day).

  - **Flashcards & Decks:**  
    - `Card` and `Deck` models store flashcard content including the target language phrase (term), its English translation (definition), and additional metadata such as language codes and flags for tracking review status.
    - Unique constraints ensure that each user cannot have duplicate cards for the same term.

  - **Quiz Scheduling & Performance:**  
    - The `Quiz` model records details on quiz attempts, tracking metrics like stability, difficulty, last and next review timestamps, and performance statistics. This data feeds into the FSRS algorithm for scheduling optimal review intervals.
  
  - **Feedback & Training Data:**  
    - `TrainingData` collects user interactions and quiz performance data, which could be used to further refine grading models.
    - `SpeakingCorrection` logs detailed corrections for speaking quizzes to support continuous improvement in automated grading.

---

## Key Features & Workflow

1. **Creating Flashcards:**  
   Users input sentences in the target language along with their English translations to create flashcards. Cards can be organized into decks for structured learning.

2. **Dynamic Scheduling:**  
   The FSRS scheduling algorithm queues cards based on past performance, ensuring that users review content at optimal intervals.

3. **Interactive Quizzes:**  
   - In **Listening Quizzes**, users hear a target phrase and must provide its correct translation.
   - In **Speaking Quizzes**, users are given an English sentence and must verbally produce the target language equivalent. The response is recorded and objectively graded.

4. **Automated Grading:**  
   Integration with speech-to-text technology and GPT-3 allows the system to evaluate user responses with a degree of flexibility, recognizing “close enough” answers that appropriately capture the meaning.

5. **User Authentication:**  
   Supports email-based magic links and Google Sign-In, ensuring secure yet flexible access for users.

6. **Personalization:**  
   Through the `UserSettings` model, learners can adjust parameters such as playback speed and study intensity, tailoring the app’s operation to their individual needs.

---

## Developer & Deployment Insights

- **Open Source & Contributions:**  
  The project is open for contributions, with clear guidelines and a permissive license. Developer setup instructions are detailed in the `SETUP.md` file.

- **Demo & Production Usage:**  
  A live demo is hosted at [KoalaCards Demo](https://app.koala.cards/user). Note that the server might be temporarily turned off during peak usage to manage hosting costs.

- **Extensibility:**  
  Future directions include expanding supported languages, additional quiz types (such as reading comprehension), and further refining AI-driven grading mechanisms.

---

## Conclusion

KoalaCards redefines traditional flashcards by merging the benefits of spaced repetition with cutting-edge speech recognition and language model capabilities. Its objective grading system and focused approach on listening and speaking practice make it a powerful tool for language learners aiming to develop real-world communication skills.

This comprehensive blend of modern web technologies, robust data modeling, and innovative learning techniques positions KoalaCards as a state-of-the-art language learning application.
