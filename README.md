# KoalaCards 🐨

<p align="center">
  <img width="33%" src="./logo.png" alt="The KoalaCards Logo"/>
</p>

<p align="center">
  <a href="https://www.youtube.com/watch?v=OWjfC7ia1c8">
  <img width="33%" src="https://img.youtube.com/vi/OWjfC7ia1c8/0.jpg"/>
  </a>
</p>

<p align="center">
  <a href="https://codeclimate.com/github/RickCarlino/KoalaCards/maintainability"><img src="https://api.codeclimate.com/v1/badges/b7666624c14bf8dcfb9b/maintainability" /></a>
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT"/>
</p>


<p align="center">
  <a href="https://youtu.be/OWjfC7ia1c8">
    Watch a short YouTube demo of the app (as of June 2025)
    <br/>
    <img src="./screenshot.png" alt="KoalaCards UI screenshot"/>
  </a>
</p>

KoalaCards is a [spaced repetition system (SRS)](https://en.wikipedia.org/wiki/Spaced_repetition) designed to help English speakers learn **Korean**, with a strong focus on **listening and speaking skills**. It leverages modern technologies like speech-to-text and large language models (LLMs) for objective, human-like assessment of user responses.

Unlike traditional SRS apps that often rely on self-grading, KoalaCards provides:

1.  **Objective Grading:** Machine-assisted grading ensures consistent and unbiased evaluation of listening and speaking skills.
2.  **Flexible Assessment:** Accepts "close enough" answers that convey the correct meaning, mirroring the flexibility of human tutors while maintaining objectivity.

## Table of Contents 📑

- [Demo / Screenshots](#demo--screenshots)
- [Features](#features-)
- [Supported Languages](#supported-languages)
- [Technology Stack](#technology-stack-)
- [Developer Setup](#developer-setup-%EF%B8%8F)
- [Authentication](#authentication-)
- [Project Status and Limitations](#project-status-and-limitations-%EF%B8%8F)
- [Contributing](#contributing-)
- [License](#license-)

## Features 💡

- **Spaced Repetition:** Utilizes the [FSRS scheduling algorithm](https://github.com/open-spaced-repetition/fsrs4anki) for efficient review scheduling.
- **Quiz Types:**
  - **Speaking Quiz:** Read an English prompt and speak the translation in the target language. Responses are transcribed and graded by an LLM (e.g., GPT). 🎤
- **Card Management:**
  - Create cards manually, from text input, CSV files, or word lists.
  - Bulk card creation and import capabilities.
  - Edit and delete individual cards.
  - Pause specific cards from review.
  - Associate AI-generated images with cards.
- **Deck Management:**
  - Organize cards into decks.
  - Create, copy, update, and delete decks.
  - Share and report decks.
- **AI-Powered Features:**
  - Text-to-Speech (TTS) for listening practice. 🗣️
  - Speech-to-Text (STT) for transcribing spoken answers.
  - LLM-based grading for speaking quizzes.
  - Grammar correction and explanation.
  - Auto-define of unknown words.
  - Generation of writing prompts for writing practice exercises.
- **User Experience:**
  - User settings customization.
  - Review history and progress tracking.
  - Keyboard hotkeys for efficient review.
  - Microphone permission handling.
- **Admin & Infrastructure:**
  - Admin panel for user management (implied).
  - Docker support for easy deployment.
  - tRPC for type-safe API routes.
  - Prisma for database interaction.

## Language

- **Target Language:** Korean (for English speakers)

Note: The app was previously multi‑lingual; it is now intentionally focused on Korean.

## Technology Stack 💻

- **Framework:** Next.js (React)
- **Language:** TypeScript
- **API:** tRPC
- **Database ORM:** Prisma
- **Database:** PostgreSQL (implied)
- **Styling:** MantineJS
- **Testing:** Jest
- **Linting/Formatting:** ESLint, Prettier
- **Containerization:** Docker
- **External Services:**
  - OpenAI (GPT for grading, potentially TTS/STT)
  - Google Cloud (Cloud Storage for audio/images, potentially TTS/STT)
  - Authentication Providers (e.g., Google)

## Developer Setup 🛠️

Detailed setup instructions can be found in [SETUP.md](SETUP.md).

A Docker setup is available via `docker-compose.yml` for easier environment configuration.

## Authentication 🔑

KoalaCards supports multiple authentication methods:

1.  **Email Magic Links (Self-hosted):** Default method sending a login link via email.
2.  **Google Sign-In:** Allows users to sign in using their Google accounts.

Configuration details for Google Sign-In can be found in the `.env.example` file and require setting up OAuth credentials in the Google Cloud Console. Both methods can be enabled simultaneously.

## Project Status and Limitations ⚠️

- The application is actively used but may have areas with limited documentation.
- The app is now single‑language (Korean). Other languages are not supported.

## Contributing 🤝

Contributions are welcome! The source code is open source under the MIT license.

- **Bug Reports & Feature Requests:** Please open an issue on GitHub.
- **Code Contributions:** Fork the repository, make your changes, and submit a pull request.
- **Questions/Discussion:** Use GitHub Issues or contact the maintainer (if contact info is provided elsewhere).

## License 📄

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.
