This is the design doc folder, a place where I put future and current designs in writing. This serves as:

 * Documentation for humans
 * Prompt data for coding LLMs such as Aider/ChatGPT.

# Koala.Cards v4

Koala.Cards is a spaced repetition language learning application that quizzes users on a variety of language learning tasks (listening, speaking, response writing, comprehension). It is a web application written in React.JS, Typescript, Next.js, and tRPC.

The application is centered around the following concepts:

- **"cards"**: Key/value pairs of terms and definitions. These can be individual words, full sentences, reading passages, or other types of information pairs.
- **"decks"**: A collection of cards.
- **"quizzes"**: A specific review drill for a particular card, such as translating English to a target language.
- **"reviews"**: During a review session, the app quizzes users on a particular skill, such as their ability to translate a phrase into the target language or write a short comprehension answer. It uses a spaced repetition algorithm to schedule the next review time.

Reviews for cards are scheduled using the FSRS spaced repetition algorithm.

# Table of Contents

 * [./v4-decks.md](Understanding how decks work)
 * [./v4-reviews.md](Understanding the review session)
