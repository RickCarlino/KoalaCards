# KoalaSRS 🐨

Hey there! Welcome to KoalaSRS, a fun and friendly Korean-only [spaced repetition system](https://en.wikipedia.org/wiki/Spaced_repetition) that's all about listening and speaking skills. We teach vocabulary using fully-formed sentences, not just boring word/definition pairs. KoalaSRS captures your voice input using speech-to-text and uses the super-smart GPT-3 for human-like test assessments and corrections. That means that the app is clever enough to mark your answers as "close enough" and can even give you optional feedback about _why_ you were wrong ("coaching"). It can explain sentences that don't make sense or have unknown vocabulary. 🧠

## Table of Contents 📑

- [Features](#features)
- [Why Another SRS?](#why-another-srs)
- [Better Name Needed](#better-name-needed)
- [Developer Setup](#developer-setup)
- [Contribution Guidelines](#contribution-guidelines)
- [Project Status and Limitations](#project-status-and-limitations)
- [Costs (April 2023)](#costs-april-2023)

## Features 💡

KoalaSRS rocks a minimal GUI because the focus is on what you can _hear_, not what you can see. 🎧

Here's how the app works:

1. Korean sentences with English translations are loaded into a SQLite database (check out `seeds.ts`).
1. The app creates a queue of sentences, sorted by difficulty. Difficulty comes from past quiz fails. More on quizzes soon.
1. The app asks the user to take one of three quizzes. All quizzes involve listening to Korean speech or speaking Korean sentences into the microphone. 🎤
1. If the user doesn't pass a quiz, they can ask for "coaching" on unknown grammar or vocabulary.
1. The user has to pass a quiz to move on.
1. Once the quiz is complete, the sentence is played back in Korean and English. The user's audio is also played back to help with pronunciation.
1. The process goes on until the queue is empty or the user quits the program.

The app has three types of quizzes:

- **Dictation quiz:** You read a Korean phrase aloud, and the app transcribes it using speech-to-text technology. GPT-3 grades your answer. This quiz is the easiest one and focuses on pronunciation and memorization. 🗣️
- **Listening quiz:** You listen to a Korean phrase and then translate it to English. This quiz comes after the dictation phase. 🎶
- **Speaking quiz:** You get an English text and are asked to say it in Korean. The program transcribes your phrase via speech-to-text, and GPT-3 grades your answer. 📣

The app also has a **coaching** feature where you can ask GPT for guidance on unknown words and grammar after a failed quiz. While coaching is mostly effective, remember that language models like GPT can ["hallucinate"](<https://en.wikipedia.org/wiki/Hallucination_(artificial_intelligence)>), so double-check all lessons learned via coaching. 🔍

Please note that this app is not ready for non-technical users just yet. If you want to try the app, you'll need to clone this repo and build it on your local machine (Linux only). There's no public demo available, but we'd love your feedback! 😊

The program also comes with helper functions for formatting prompts, grading responses, and inspecting results.

## Why Another SRS? 🤔

I studied Korean at university and did self-study for many years before that. I saw lots of flaws in existing solutions but couldn't build alternatives because software tools weren't ready yet. I've been dreaming about building this spaced repetition system for over a decade! Finally, in 2023, it's possible thanks to large language models (LLMs) like GPT and affordable, high-quality text-to-speech and speech-to-text APIs. 🎉

Check out the [whitepaper](https://github.com/RickCarlino/gpt-language-learning-experiments) I wrote that explains the main idea. I also wrote a [blog article back in 2019](https://rickcarlino.com/2019/problems-and-solutions-for-spaced-repetition-software.html) about some problems and solutions with SRS systems.

## Better Name Needed 📛

I picked this name in a snap because it starts with the letter "K" just like "Korean." Maybe we can think of something better? Oh, and if you're a graphic designer, I really need a logo. I can pay you with Taco Bell gift cards. 🌮

## Developer Setup 🛠️

**Prerequisites:** This app only works on Linux (tested on a recent Xubuntu version). The app needs access to a soundcard, so keep that in mind if you want to run it in a virtualized environment like Docker or WSL. NodeJS is required. I've tested it on v18 of node, and newer versions will probably work too.

The project is in a semi-public alpha phase. If you don't understand the instructions below, you might want to wait for the project to mature before proceeding. Please only contact me for help if you're a professional software developer.

1. Ensure your Linux desktop has access to `node`, `play`, `rec` and `sox`. If you don't have these installed, check Google for help. You can find out if you have them installed by running `which <app_name>`.
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

- I use the app every day for studying, but the documentation is, well, not great. If you really want to use this app, consider DMing me on Reddit for help.
- The app currently runs only on Linux because I needed a quick solution for audio playback.
- By design, the app won't quiz on reading or writing. This is a speaking/listening app.
- The target user is English speakers trying to learn Korean. I can add other language pairs later, but the main focus right now is EN/KO.

## Costs (April 2023) 💰

The app uses Google Cloud and OpenAI APIs, and neither of these services is free. I can review about 2.5 phrases/minute, and a 15-minute session costs roughly $0.11. That means reviewing a single sentence on the app costs less than half a cent USD.
