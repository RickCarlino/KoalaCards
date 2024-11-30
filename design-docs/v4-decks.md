# Decks

## Introduction

A user has many decks and decks have many cards.

Adding decks to the application is a relatively new feature. In early versions of the application, we did not have decks, and this created a number of problems. The first problem is that all cards were stored in a single namespace, so there was no way to separate things into subjects, and everything needed to be reviewed in a single session, which could result in hundreds of cards being overdue or things ending up in the back of the queue. The other problem is that it made it very unorganized for people who use the app to study more than one language. All cards would be reviewed in their due date order, and so we ended up in an awkward situation where cards from different languages would be mixed into the same session. The last problem that we had, because we didn't have any decks, is that a lot of new users would not have any content to bring into the app, and so they simply would not use the app. Essentially, they were expecting us to provide a curriculum, but there was no curriculum available. By adding a decks feature to the application, we can solve all of these problems.

## The Decks UI Flow

When the user visits the review page, they see a number of tiles on the page. Each tile represents a single deck, and the tile shows the title of the deck and the number of cards which are due for review within that deck, as well as the total number of cards in the deck. The first tile in the set is a button that allows the user to add a new deck to their account. Each deck has exactly one language assigned to it.

## Creating a Deck

When the user pushes the tile that adds a deck, they are sent to the deck creation page where they need to insert a title and select a language for the deck. When they click save, they are sent to the overview for that deck.

## The Deck Overview Page 

On the deck overview page, the user is able to edit the title of a deck and also view a list of all cards in the deck. When they click one of the cards, it takes them to the overview page for that card, which is already built.

## legacy concerns

One problem we have with the app is that there was no such thing as decks in version 3. So what we are going to do to mitigate this problem is when the user visits the review page, we will perform a gradual migration of their data at load time. We will create a new deck for each language they are studying, and it will have a generic name like My Korean Deck. After that, the user is free to create more decks later.

## First log in

When the user logs in for the first time, they will not have any decks or cards available. The only thing they will see on the review page is the create deck tile. Once they click that, the flow will be normal for all users. That's it.

## When a decks cards are exhausted

## The Koala Phrase Bank