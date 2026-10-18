# EcoScan plant cards, choose by name, and site filters

Status: approved by Aydin on 2026-10-18. Submission is Oct 25. Build in the order below and commit after each part.

## Why

- Picking several photos at once is ambiguous: they could be five angles of one plant or five different plants. The app treats them as one plant and doesn't say so.
- The camera button takes one photo per plant. There's no way to add a second photo of a plant you already scanned.
- PlantNet splits its belief across lookalikes, so two native tickseeds show as 45% and 39%. The "Which one is it?" question appears even when every close match is native, and it can list guesses PlantNet scored near 0%.
- OpenAI's part is hidden. It only adds "Best guess", and its own confidence is thrown away.
- The letter always includes every Add card. You can't choose which plants to ask for.

## Part 1: plan items 1–4

### 1. Plant cards with "Scan all"

1. **Add plant** creates an empty card.
2. Each card holds up to 5 photos of the same plant, added by camera one at a time or by uploading several at once. The card says "Photos of this one plant: 3 of 5".
3. Add as many cards as needed.
4. **Scan all** identifies every unscanned card at once. Each card fills in with its result. A card can also be scanned on its own.
5. Cards can be removed, and photos can be removed from a card before it's scanned.

Each card is one PlantNet request however many photos it has. PlantNet's free key allows about 500 a day.

### 2. Status first when the matches agree

- Count only guesses at 5% or more.
- If those guesses all share a Florida status (all native, all non-native, or all invasive), show the status and "It's one of these:" with the names, so it's clear we aren't sure which species. The species can still be picked from the card.
- If they disagree (for example wild sage vs lantana, or Carolina wild petunia vs Mexican petunia), keep asking "Which one is it?".

### 3. Clearer "Which one is it?" list

- Drop guesses under 5%, so no option shows 0%.
- Show OpenAI's pick with its own confidence: "PlantNet: 45% · OpenAI's pick (78% sure)".
- Add a small bar chart above the list: one bar per guess for PlantNet's score, with OpenAI's pick highlighted and each bar colored by status.

### 4. Choose plants for the letter

- Each Add card gets a checkbox, on by default.
- The letter includes only the checked plants. The "with the plan" percent uses only those too.

## Part 2: choose a plant by name

- A type-to-search box (not a scroll list) over every plant recorded in Florida, natives and non-natives, with common and scientific names, built from the USDA PLANTS Florida state checklist.
- The search list shows names only, never a status.
- Picking a plant runs the same status check as a scan (the FISC list, then our natives lists, then USDA), so the verdict still comes only from those sources.
- The result says "Chosen by name" instead of a photo match percentage.

## Part 3: Light / Moisture / Space / Care filters

- Only on our checked recommended plants (30 since tropical sage was removed). Kian's 41-plant list is not used.
- Light and Space come from the sun and size we already have.
- Moisture and Care are new fields on each plant, each with a source link, marked unverified. A CSV checklist (opens in Google Sheets) covers just those two fields.
- Until a plant's new fields are checked, the filters treat them as unknown and never hide the plant.

## Out of scope

- Styling. Kian owns colors and fonts, which stay in `frontend/theme.js`. This work changes motion, loading states, content and layout only, using only packages that ship in Expo Go.
- Merging Kian's branch. That's a separate decision.
