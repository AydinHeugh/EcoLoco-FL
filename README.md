# EcoLoco-FL

A tool for climate action, built for South Florida.

EcoLoco helps students find out which plants on their campus help local wildlife and which ones hurt it. You scan plants with your phone, and the app tells you whether each one is native or invasive, shows what share of your schoolyard's plants are native to Florida, suggests native plants to add, and writes a letter you can send to your principal asking to plant them.

This is our entry for the 2026 Congressional App Challenge (FL-22). It started as EcoLoco and is being reworked around real Florida plant data.

**See how it all fits together:** https://aydinheugh.github.io/EcoLoco-FL/ (interactive map of the code, opens in any browser)

## What goes in and what comes out

**You give it:**
- One to five photos of the same plant, taken with the camera or uploaded (the app sends one photo for now; picking several is coming)
- Your 5-digit ZIP code

**You get back, for each plant:**
- Its name and how sure PlantNet is about the match
- When the app isn't sure, a short list of close matches to pick from ("Which one is it?"), each with its Florida status, plus a "None of these" button
- When the photo is too unclear to match anything, "Couldn't identify this. Try a close-up of one leaf, or a flower" instead of a guess
- Whether it's Native, Non-native, Invasive, or "Unknown: not on Florida lists"
- Where that verdict came from: the Florida invasive species list, our list of Florida natives, or the USDA plant database. The AI never decides this; if none of them know the plant, it stays unknown
- One line on why it matters (for example, coontie is the only plant the Atala butterfly can lay its eggs on)
- How much it supports wildlife (high, medium, or low)
- Two practical things you can do about it
- A note when the AI part was unavailable, in which case wildlife value and actions show as unknown but the plant and its native/invasive verdict still come back

**After you scan a whole campus (the EcoScan tab):**
- Every plant you scan stays in the list. Ones the app isn't sure about show the same "Which one is it?" list, and any card can be removed with ✕.
- Plants are grouped as native, non-native (not harmful), invasive, and unknown. Only invasive plants count as hurting wildlife.
- How many plants are native, non-native, invasive, or unknown, and what percent of the identified ones are native
- What that percent would be if the invasive plants were replaced with natives
- Plants the app couldn't identify are still listed, but they aren't counted in the percent
- Native plants to add for your ZIP code
- An editable letter to your principal, with the percent native now and with the plan, that you can copy and send


## What happens in between

1. **Identifying the plant.** The photos go to PlantNet, a plant identification service, which returns a ranked list of likely species with a score for each.
   - Different names for the same plant (for example "Zamia pumila" and "Zamia integrifolia", both coontie) are merged first, and their scores added together.
   - If PlantNet's top score is under 0.20, or it finds no plant at all, the app says it couldn't identify the photo.
   - If PlantNet is sure (top score 0.80 or higher, and clearly ahead of the next one), its answer is used.
   - In between, you pick from the close matches. OpenAI's image model (gpt-4o-mini) only marks its best guess in that list; it doesn't change the scores.
   - If PlantNet can't be reached, OpenAI identifies the plant from the photos on its own, using the same rules.
2. **Native or invasive.** Any name for the plant (scientific name, older name, or common name like "Florida arrowroot") is turned into one species first, so every spelling gets the same answer. Then it's checked in this order, and the first one that knows the plant wins:
   - the full official Florida Invasive Species Council (FISC) 2026 list of 179 invasive plants, which ships with the backend;
   - our own list of 22 South Florida natives, which also ships with the backend;
   - the USDA PLANTS database online, which says whether the plant is native to Florida or was brought in from somewhere else (answers are remembered while the server runs);
   - if none of them know it, the plant is shown as unknown.
3. **Wildlife value and actions.** OpenAI is asked how much the plant supports wildlife and what you can do about it. If it's invasive, the app always says to remove it and replace it with a native. If OpenAI is down or out of credits, the scan still returns the plant and its verdict, with wildlife value and actions marked unknown.
4. **Counting.** The app counts how many scanned plants are in each group and divides the natives by the plants it could identify. No AI is involved, and the name a plant was scanned under doesn't change the result: "Coontie", "coontie" and "Zamia integrifolia" all count the same. Replacing each invasive plant with a native gives the "with the plan" percent.
5. **Recommendations and the letter.** OpenAI suggests native plants for your ZIP. Anything invasive, or that USDA says isn't native to Florida, gets filtered out. The letter is a fixed template, and OpenAI only writes one or two sentences about the plants you picked. Without OpenAI, recommendations come straight from our natives list and the letter uses each plant's "why it matters" line instead.

The invasive list is generated from the official FISC PDF by a script in `backend/scripts/`. The 22 natives and the "why it matters" lines are our own and still need checking against UF/IFAS before the demo.

## Finding your way around

| Folder | What's in it |
|---|---|
| `frontend/` | The phone app. `screens/` has one file per screen, `components/` has pieces shared between screens, `navigation/` sets up the tabs, and `services/` has the code that sends requests to the backend. All colors and fonts are in `theme.js`, so a new look only needs that one file. |
| `backend/` | The Python server the app talks to. `app.py` lists the web addresses the app can call. `services/` does the actual work (identifying, looking up Florida status, counting, writing the letter). `data/` holds the Florida plant lists. `scripts/` has the tool that rebuilds the invasive list from the official FISC PDF. `tests/` checks it all works. |
| `assets/` | Images used in the app, the app icon and splash screen, and the official "Powered by Pl@ntNet" logo shown under identification results. |
| `docs/` | The interactive architecture map (`architecture.html`), the script that keeps it matched to the code, and our written plans (`superpowers/plans/`). |

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
   venv\Scripts\python -m pip install Flask flask-cors openai python-dotenv requests pytest
   ```
   On Mac or Linux, use `python3` instead of `py` and `venv/bin/python` instead of `venv\Scripts\python`.
3. Start the server: `venv\Scripts\python app.py`. It runs on port 5000. Debug mode is off by default; while developing, add `ECOLOCO_DEV=1` to `.env` to get automatic reloading and detailed error pages. Never turn it on for a demo or a public server.

**App** (from the top folder):
1. Create a file called `.env` containing `EXPO_PUBLIC_API_URL=http://YOUR-COMPUTER-IP:5000`. If you're testing on a phone, use your computer's local network address, not `localhost`.
2. Run `npm install`, then `npx expo start`.
3. Scan the QR code with the Expo Go app, or press `w` to open it in a web browser.

**Tests** (from the `backend` folder): `venv\Scripts\python -m pytest -v`. The tests don't need any API keys and never call OpenAI, PlantNet or USDA.

**Rebuilding the invasive list** (from the `backend` folder, after `venv\Scripts\python -m pip install -r requirements-dev.txt`): `venv\Scripts\python scripts/build_fisc_list.py <link to the FISC PDF> data/fisc_list.json`.

## Where things stand

- Done: Florida plant lists drive the native/invasive verdict, every verdict comes with its source and a "why it matters" line, plants are identified by PlantNet with OpenAI as a backup, the full FISC invasive list and a USDA check are in place, scans keep working when OpenAI is down, unsure matches are confirmed by the user instead of guessed, results credit Pl@ntNet, and the backend has automated tests.
- Next: let the app send several photos of one plant, show the source and "why it matters" in the app, show a notice when the AI part was unavailable, replace the remaining pop-up error messages that don't appear in the web version, double-check the plant lists against official sources, and put the backend online so the app works away from our computers.
