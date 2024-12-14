# Decks Feature Overview

## Introduction

Decks are a new addition to the application, introduced to address significant shortcomings of earlier versions. Previously, all cards were stored in a single namespace, which caused several issues:

1. **No Categorization by Subject**: Cards couldn't be grouped by topic, so users had to review everything in one overwhelming session. This often resulted in hundreds of overdue cards or items being deprioritized indefinitely.
2. **Disorganized Multi-Language Learning**: Users studying multiple languages faced a chaotic experience as cards were reviewed strictly in due-date order, mixing languages in the same session.
3. **Lack of Starter Content**: New users had no initial structure or curriculum, leaving them with an empty experience.

By introducing decks, we solve these issues, enabling better organization, subject-based categorization, and a more user-friendly entry point for beginners.

## Data Model Overview

- **Users**: Can own multiple decks.
- **Decks**: Contain many cards and are associated with a specific language.

## UI Flow and Experience

### Review Page

When users visit the review page, they see a series of tiles, one for each deck. Each tile shows:

- The deck's title.
- The number of cards due for review.
- The total number of cards in the deck.

The first tile serves as an "Add Deck" button, allowing users to create new decks.

### Adding a Deck

1. Clicking the "Add Deck" tile directs users to a deck creation page.
2. Users provide a title and select a language for the deck.
3. After saving, they are redirected to the deck’s overview page.

### Deck Overview Page

On the deck overview page, users can:

- Edit the deck's title.
- View a list of all cards in the deck.
- Click on any card to navigate to the existing card overview page.

## Legacy Data Handling

### Migration for Existing Users

For users upgrading from version 3 (where decks did not exist), we will automatically migrate their data upon visiting the review page. The migration process:

1. Creates a new deck for each language they are studying.
2. Assigns cards to their respective language-based decks.
3. Uses generic names for these decks, e.g., "My Korean Deck."

Users can rename these decks or create additional ones as needed.

### First-Time Login Experience

When a new user logs in for the first time:

- They see only the "Create Deck" tile on the review page.
- After creating their first deck, the experience aligns with that of returning users.

## Additional Scenarios

### Exhausted Decks

When all cards in a deck have been reviewed:

- The deck remains visible but displays "0 cards due."
- Users are encouraged to create or add new cards to keep progressing.

## Future Work: The Koala Phrase Bank

(This section is intentionally left incomplete and requires further definition.)

This document provides a roadmap for implementing the decks feature, addressing legacy concerns, and improving both the new user experience and long-term organization for all users.
