# KoalaSRS 🐨

<p align="center">
  <img width="33%" src="./logo.png" alt="The KoalaSRS Logo (for now)"/>
</p>

Hey there! Welcome to KoalaSRS, a fun and friendly Korean-only [spaced repetition system](https://en.wikipedia.org/wiki/Spaced_repetition) that's all about listening and speaking skills. Koala teaches vocabulary using fully-formed sentences, rather than boring word/definition pairs. KoalaSRS captures your voice input using speech-to-text and uses the super-smart GPT-4 for human-like test assessments and corrections. This has two advantages over traditional spaced repetition systems:

1. There is no self-grading of quizzes. Results are recorded objectively.
2. Your quizzes will not be marked incorrect for small variations in word choice. "Close enough" answers that match the meaning of the target sentence will always be accepted.

The app also gives feedback about _why_ you were wrong. 🧠

## Demo

<p align="center">
  <img src="./screenshot.png" alt="The KoalaSRS Logo (for now)"/>
</p>

[Watch a short YouTube demo of the app as of 2023-09-16 (older v1.1 release- new video coming soon).](https://www.youtube.com/watch?v=0H2MufXrYl8)

## ~~ALPHA~~ Beta Software

The app is now stable enough to be used for serious studying, but there are still stability issues and many features are still pending. If you want to use the app but are hitting stability issues, please reach out.

I am also privately hosting an instance of KoalaSRS. Please [fill out this Google form](https://forms.gle/GFcpqvt1Hkfo4mWq5) if you are interested in trying it out or want to help with alpha testing. There is no free public instance at the moment due to hosting/API costs. I have also set up a [Patreon](https://www.patreon.com/rickcarlino) to help offset hosting costs.

Lastly, there is a [group on Club House](https://www.clubhouse.com/c/join/B2Tyn13w) to discuss KoalaSRS development in an informal manner. Feel free to drop in and say "hi" or suggest new ideas.

## Table of Contents 📑

- [Demo](#Demo)
- [Features](#features)
- [Why Another SRS?](#why-another-srs)
- [Developer Setup](#developer-setup)
- [Contribution Guidelines](#contribution-guidelines)
- [Project Status and Limitations](#project-status-and-limitations)
- [Help Needed](#help-needed)

## Features 💡

KoalaSRS rocks a minimal GUI because the focus is on what you can _hear_, not what you can see. 🎧

Here's how the app works:

1. Korean sentences with English translations are loaded into a SQLite database (I use `seeds.ts` for now but an editor is in the works).
1. The app creates a queue of sentences, sorted by scheduling need, which is calculated via a cards age and difficulty.
1. The app asks the user to take one of three quizzes. All quizzes involve listening to Korean speech or speaking Korean sentences into the microphone. 🎤
1. The user must pass a quiz to move on to the next card.
1. Once the quiz is complete, the sentence is played back in Korean and English. The user's audio is also played back to help with pronunciation.
1. The process goes on until the queue is empty.

The app has three types of quizzes:

- **Dictation quiz:** You read a Korean phrase aloud, and the app transcribes it using speech-to-text technology. GPT-3 grades your answer. This quiz is the easiest one and focuses on pronunciation and memorization. 🗣️
- **Listening quiz:** You listen to a Korean phrase and then translate it to English. This quiz comes after the dictation phase. 🎶
- **Speaking quiz:** You get an English text and are asked to say it in Korean. The program transcribes your phrase via speech-to-text, and GPT-3 grades your answer. 📣

Please note that this app is not ready for non-technical users just yet. If you want to try the app, you'll need to clone this repo and build it on your local machine (or ask nicely for an invitation to a private instance). There's no public demo available, but we'd love your feedback! 😊

The program also comes with helper functions for formatting prompts, grading responses, and inspecting results.

## Why Another SRS? 🤔

I studied Korean at university and did self-study for many years before that. I saw lots of flaws in existing solutions but couldn't build alternatives because software tools weren't ready yet. I've been dreaming about building this spaced repetition system for over a decade! Finally, in 2023, it's possible thanks to large language models (LLMs) like GPT and affordable, high-quality text-to-speech and speech-to-text APIs. 🎉

Check out the [whitepaper](https://github.com/RickCarlino/gpt-language-learning-experiments) I wrote that explains the main idea. I also wrote a [blog article back in 2019](https://rickcarlino.com/2019/problems-and-solutions-for-spaced-repetition-software.html) about some problems and solutions with SRS systems.

## Developer Setup 🛠️

**Prerequisites:** NodeJS is required. I've tested it on v20 of node.

The project is in a semi-public alpha phase. If you don't understand the instructions below, you might want to wait for the project to mature before proceeding. **These instructions may be out of date. Please raise an issue if things don't work!**

1. Install NodeJS if you have not done so already.
1. Clone this repo and `cd` in.
1. Create an [OpenAI API key](https://platform.openai.com/account/api-keys).
1. Create a [Google Cloud Service Account JSON credentials file](https://developers.google.com/workspace/guides/create-credentials)
1. Make sure the Google Cloud service account can access Cloud Speech API and Cloud Text-to-Speech APIs.
1. Copy `example.env` to `.env`.
1. Fill out the ENV vars to match your OpenAI / GCS credentials.
1. Run `npm reset`.
1. Run `npm start`.

## Contribution Guidelines 🤝

The source code is permissively licensed and open for review by software developers. The project is in a very early state and not ready for the general public. Got questions? Raise an issue! You can also reach me via DM on Reddit for general discussion (GitHub and Reddit usernames are the same).

## Project Status and Limitations ⚠️

- I use the app every day, multiple times per day for studying. It is stable, but the documentation is not great. If you want to use this app, consider DMing me on Reddit/LinkedIn/ClubHouse for help.
- By design, the app won't quiz on reading or writing. This is a speaking/listening app and there are better ways to practice writing and reading.
- The target user is English speakers trying to learn Korean. I can add other language pairs later, but the main focus right now is EN/KO.

## Help Needed 📛

The project could use help in the following areas:

1. I picked this name in a snap because it starts with the letter "K" just like "Korean." Maybe we can think of something better?
1. I'd like to create a large library of example sentences that are appropriate for use with the app. For this, I'd need the help of a Korean native speaker who can curate and moderate a large corpus of AI-generated phrases containing target grammar/vocab.
1. UI/UX needs an overall and has not been a priority due to time constraints.
1. Would love to hear input from folks with a background in linguistics or Korean language education. Please reach out.
1. The app relies heavily on Google Cloud and OpenAI for text-to-speech and AI features. I would be interested in exploring other options, such as Bark TTS or custom Llama models.