# EcoLoco-FL

A tool for climate action, built for South Florida.

EcoLoco helps students find out which plants on their campus help local wildlife and which ones hurt it. You scan plants with your phone, and the app tells you whether each one is native or invasive, shows what share of your schoolyard's plants are native to Florida, suggests native plants to add, and writes a letter you can send to your principal asking to plant them.

This is our entry for the 2026 Congressional App Challenge (FL-22). It started as EcoLoco and is being reworked around real Florida plant data.

**See how it all fits together:** https://aydinheugh.github.io/EcoLoco-FL/ (interactive map of the code, opens in any browser)

## What goes in and what comes out

**You give it:**
- One to five photos of the same plant (a leaf, a flower, the bark), taken with the camera or uploaded, up to 10 MB each. More photos give a surer match.
- Your school's location: press "Use my location", or type an address or ZIP code. The app rounds your location to about 1 km before it leaves the phone and never saves it. Only Florida locations work; anywhere else gets a message saying so. Scanning and invasive checks work anywhere in Florida, but plants to add are only suggested in Palm Beach County, the one county our plant list was checked for. Elsewhere the app says "Planting recommendations are only checked for Palm Beach County so far."

**You get back, for each plant:**
- Its name and how sure PlantNet is about the match
- When the app isn't sure, a short list of close matches to pick from ("Which one is it?"), each with its Florida status, a small chart of how PlantNet scored each one, OpenAI's pick with how sure it is, plus a "None of these" button. Guesses PlantNet scored under 5% are left out
- When every close match has the same status (for example two native tickseeds), the app shows that status and "It's one of these:" with the names, instead of asking. You can still pick the exact one
- When the photo is too unclear to match anything, "Couldn't identify this. Try a close-up of one leaf, or a flower" instead of a guess
- Whether it's Native, Non-native, Invasive, or "Unknown: not on Florida lists"
- Where that verdict came from: the Florida invasive species list, our list of Florida natives, or the USDA plant database. The AI never decides this; if none of them know the plant, it stays unknown
- One line on why it matters (for example, coontie is the only plant the Atala butterfly can lay its eggs on), with where that line came from in small text underneath
- For plants in our data: which animals it helps and what to watch out for (for example, coontie seeds are poisonous to pets), each with its source, and a "See where it grows" button that opens that plant's USF Atlas page inside the app
- For invasive plants: how to remove them safely (Brazilian pepper is in the poison ivy family, so an adult should do the cutting)
- If the AI part is down, a small notice says "Extra descriptions are offline. Plant names and Florida status still work."

**After you scan a whole campus (the EcoScan tab):**
- The screen reminds you to only scan real plants growing outdoors. Press "Add plant" for each plant, give it up to 5 photos of that one plant (take them one at a time or upload several at once), then press "Scan all" to scan every plant together, or scan one card at a time. Ones the app isn't sure about show the same "Which one is it?" list, and any card can be removed with ✕.
- On the results screen, each plant has a Remove button for mistakes like a fake or potted plant. Removing one updates the counts, the percent, the charts, the plan and the letter.
- Plants are grouped as native, non-native (not invasive), invasive, and unknown. Only invasive plants count as hurting wildlife.
- How many plants are native, non-native, invasive, or unknown, and what percent of the identified ones are native
- What that percent would be with the plan: only invasive plants that have a ready replacement, and the native plants the plan adds, are counted
- Plants the app couldn't identify are still listed, but they aren't counted in the percent
- A plan: a "Remove" card for each invasive plant found, with a safety note and a native plant to replace it, and "Add" cards for native plants that fill gaps on your campus. Each card shows what the plant helps, where it grows, what to ask for at the nursery (and look-alikes to avoid), what to watch out for, and questions to look into, each fact with its source, plus a "See where it grows" button. Outside Palm Beach County you still get the Remove cards, but no Add cards
- A link to plantrealflorida.org to find a native plant nursery
- Two simple charts: plants by status now and with the plan, and how many kinds of caterpillars each plant's group feeds (from the National Wildlife Federation)
- "Seen near you": the five plants people have photographed most within about 5 km of your school (from iNaturalist), each marked native, non-native, invasive or unknown
- A short "Why this matters" section: four facts about native plants, birds, water and flooding, each with its source
- An "In my letter" checkbox on each plant to add. Untick one to leave it out of the letter and the "with the plan" numbers
- An editable letter to your principal listing the plants to remove and add, how to buy them, safety notes, the percent native now and with the plan, and sources


## What happens in between

1. **Identifying the plant.** The photos go to PlantNet, a plant identification service, which returns a ranked list of likely species with a score for each.
   - Different names for the same plant (for example "Zamia pumila" and "Zamia integrifolia", both coontie) are merged first, and their scores added together.
   - If PlantNet's top score is under 0.20, or it finds no plant at all, the app says it couldn't identify the photo.
   - If PlantNet is sure (top score 0.80 or higher, and clearly ahead of the next one), its answer is used.
   - In between, you pick from the close matches. OpenAI's image model (gpt-4o-mini) marks its pick in that list and says how sure it is; it doesn't change PlantNet's scores. Guesses PlantNet scored under 5% are dropped first.
   - If PlantNet can't be reached, OpenAI identifies the plant from the photos on its own, using the same rules.
2. **Native or invasive.** Any name for the plant (scientific name, older name, or common name like "Florida arrowroot") is turned into one species first, so every spelling gets the same answer. Then it's checked in this order, and the first one that knows the plant wins:
   - the full official Florida Invasive Species Council (FISC) 2026 list of 179 invasive plants, which ships with the backend;
   - our own list of 21 South Florida natives, which also ships with the backend;
   - a short list of plants the USF Atlas says are not native to Florida (for now, tropical sage);
   - the USDA PLANTS database online, which says whether the plant is native to Florida or was brought in from somewhere else (answers are remembered while the server runs);
   - if none of them know it, the plant is shown as unknown.
3. **Facts about the plant.** Everything shown about a plant comes from our own data files, each fact with a link to where it came from (the Institute for Regional Conservation's Natives for Your Neighborhood, UF/IFAS, the ASPCA, or the FISC list). The AI doesn't write facts about plants. If we don't have facts for a plant, the app says so.
4. **Counting.** The app counts how many scanned plants are in each group and divides the natives by the plants it could identify. No AI is involved, and the name a plant was scanned under doesn't change the result: "Coontie", "coontie" and "Zamia integrifolia" all count the same. The "with the plan" percent only counts changes the plan really makes: invasive plants that have a ready replacement, and the native plants it adds.
5. **The plan.** Plants to add come only from our list of about 30 South Florida natives. Each invasive plant found gets a replacement. The other picks fill gaps on campus: none of the plant groups that feed the most caterpillars here (from the National Wildlife Federation), nothing caterpillars eat, no fruit for birds, or months with nothing blooming. The first three picks include at most one tree and at least one easy plant. Plant-group counts like "Oaks feed 395 kinds of caterpillars here" are always for the whole group, and are never added together.
6. **Your location.** A typed address or ZIP, or your rounded location, is turned into a ZIP code using OpenStreetMap's free Nominatim service (no more than one request a second, as its rules ask). The ZIP's county comes from a table of every Florida ZIP code built from the 2020 Census; a ZIP the table doesn't know (like a PO box) is treated as outside Palm Beach County. The same rounded location is used to ask iNaturalist which plants have been seen nearby. Neither is stored.
7. **The letter.** The letter is built from the plan. OpenAI may only reword the opening paragraph, and its version is thrown away if it adds a plant or animal name, or changes a number. Without OpenAI, the letter still works.

The invasive list is generated from the official FISC PDF by a script in `backend/scripts/`. The 21 natives and the "why it matters" lines are our own and still need checking against UF/IFAS before the demo.

**Before a plant can be recommended,** a teammate checks it in the USF Atlas of Florida Plants (https://florida.plantatlas.usf.edu) to make sure it's native to Palm Beach County, checks its facts and its "replaces" pairing, then changes `"verified": false` to `true` for that plant in `backend/data/fl_recommendations.json`, adding who checked it and when. All 30 plants have been checked this way (see `docs/plant-checklist.md`). Tropical sage was taken off the list after its Atlas page showed it isn't native.

## Finding your way around

| Folder | What's in it |
|---|---|
| `frontend/` | The phone app. `screens/` has one file per screen, `components/` has pieces shared between screens, `navigation/` sets up the tabs, and `services/` has the code that sends requests to the backend. All colors and fonts are in `theme.js`, so a new look only needs that one file. |
| `backend/` | The Python server the app talks to. `app.py` lists the web addresses the app can call. `services/` does the actual work (identifying, looking up Florida status, counting, building the plan, writing the letter). `data/` holds the Florida plant lists: the invasive list, our natives list, the plants we recommend with their sources, the National Wildlife Federation's list of the plant groups that feed the most caterpillars, and which county each Florida ZIP code is in. `scripts/` has the tools that rebuild the invasive list from the official FISC PDF and the ZIP-to-county table from the Census file. `tests/` checks it all works. |
| `assets/` | Images used in the app, the app icon and splash screen, and the official "Powered by Pl@ntNet" logo shown under identification results. |
| `docs/` | The interactive architecture map (`architecture.html`), the script that keeps it matched to the code, our written plans (`superpowers/plans/`), and the plant checklist (`plant-checklist.md`, plus `plant-checklist.xlsx` to fill in with Excel and `plant-checklist.csv` for other spreadsheet apps) for checking each recommended plant before the app can suggest it. |

Files in the top folder:
- `App.js` and `index.js` start the app. `app.json` holds app settings like the name, icon, and camera permission text.
- `package.json` lists what the app needs installed.
- `ARCHITECTURE.md` is the written version of the architecture map, with a glossary and a list of planned changes.
- `CLAUDE.md` and `AGENTS.md` are instructions for the AI coding assistants we use on this project.

### Opening the architecture map

- **Online:** go to https://aydinheugh.github.io/EcoLoco-FL/
- **From a copy of the repo:** double-click `docs/architecture.html` to open it in your browser. It needs an internet connection.

Click any box to see what that part of the code does, step by step, and which parts it connects to. The **Glossary** button explains the colors. Dashed boxes are things we've planned but haven't built yet.

## Running it yourself

You'll need Node.js, Python 3, an OpenAI API key, and a free PlantNet API key from https://my.plantnet.org (without it, identification falls back to OpenAI only).

**Backend** (from the `backend` folder):
1. Create a file called `.env` with one key per line:
   ```
   OPENAI_API_KEY=your-openai-key
   PLANTNET_API_KEY=your-plantnet-key
   ```
2. Set up Python and install what it needs:
   ```
   py -m venv venv
   venv\Scripts\python -m pip install -r requirements-dev.txt
   ```
   On Mac or Linux, use `python3` instead of `py` and `venv/bin/python` instead of `venv\Scripts\python`.
3. Start the server: `venv\Scripts\python app.py`. It runs on port 5000. Debug mode is off by default; while developing, add `ECOLOCO_DEV=1` to `.env` to get automatic reloading and detailed error pages. Never turn it on for a demo or a public server.

**App** (from the top folder):
1. Create a file called `.env` containing `EXPO_PUBLIC_API_URL=http://YOUR-COMPUTER-IP:5000`. If you're testing on a phone, use your computer's local network address, not `localhost`.
2. Run `npm install`, then `npx expo start`.
3. Scan the QR code with the Expo Go app, or press `w` to open it in a web browser.

**Tests** (from the `backend` folder): `venv\Scripts\python -m pytest -v`. The tests don't need any API keys and never call OpenAI, PlantNet or USDA.

**Rebuilding the invasive list** (from the `backend` folder, after `venv\Scripts\python -m pip install -r requirements-dev.txt`): `venv\Scripts\python scripts/build_fisc_list.py <link to the FISC PDF> data/fisc_list.json`.

**Rebuilding the ZIP-to-county table** (from the `backend` folder): `venv\Scripts\python scripts/build_zip_counties.py https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_county20_natl.txt data/fl_zip_counties.json`.

## Where things stand

- Done: Florida plant lists drive the native/invasive verdict, every verdict comes with its source and a "why it matters" line, plants are identified by PlantNet with OpenAI as a backup, the full FISC invasive list and a USDA check are in place, scans keep working when OpenAI is down, unsure matches are confirmed by the user instead of guessed, every fact in the app shows its source, all text is written in plain language and fits a phone screen, results credit Pl@ntNet, and the backend has automated tests.
- Next: double-check the plant lists against official sources, and put the backend online so the app works away from our computers.
