# EcoLoco-FL

A tool for climate action, built for South Florida.

EcoLoco helps students find out which plants on their campus help local wildlife and which ones hurt it. You scan plants with your phone, and the app tells you whether each one is native or invasive, gives your schoolyard a biodiversity score from 0 to 100, suggests native plants to add, and writes a letter you can send to your principal asking to plant them.

This is our entry for the 2026 Congressional App Challenge (FL-22). It started as EcoLoco and is being reworked around real Florida plant data.

**See how it all fits together:** https://aydinheugh.github.io/EcoLoco-FL/ (interactive map of the code, opens in any browser)

## What goes in and what comes out

**You give it:**
- One to five photos of the same plant, taken with the camera or uploaded (the app sends one photo for now; picking several is coming)
- Your 5-digit ZIP code

**You get back, for each plant:**
- Its common and scientific name, and how confident the identification is
- Which service identified it, the other species it might be, and whether you should double-check it
- Whether it's native, non-native, or invasive in South Florida
- Where that verdict came from: the Florida invasive species list, our list of Florida natives, the USDA plant database, or an AI guess if none of those know the plant
- One line on why it matters (for example, coontie is the only plant the Atala butterfly can lay its eggs on)
- How much it supports wildlife (high, medium, or low)
- Two practical things you can do about it
- A note when the AI part was unavailable, in which case wildlife value and actions show as unknown but the plant and its native/invasive verdict still come back

**After you scan a whole campus (the EcoScan tab):**
- A biodiversity score from 0 to 100, plus a list of the plants helping and hurting it
- A projected score showing how much planting the top recommendations would raise it
- Native plants to add for your ZIP code
- An editable letter to your principal that you can copy and send


## What happens in between

1. **Identifying the plant.** The photos go to PlantNet, a plant identification service, which returns a ranked list of likely species with a score for each.
   - If PlantNet is sure (top score 0.80 or higher, and clearly ahead of the next one), its answer is used.
   - If it's unsure, OpenAI's image model (gpt-4o-mini) looks at the photos and picks between PlantNet's top guesses, taking your ZIP code into account. The result is marked as needing a double-check.
   - If PlantNet can't be reached or finds nothing, OpenAI identifies the plant from the photos on its own.
   - If both fail, the app gets an empty answer instead of an error.
2. **Native or invasive.** The species name is checked in this order, and the first one that knows the plant wins:
   - the full official Florida Invasive Species Council (FISC) 2026 list of 179 invasive plants, which ships with the backend;
   - our own list of 22 South Florida natives, which also ships with the backend;
   - the USDA PLANTS database online, which says whether the plant is native to Florida or was brought in from somewhere else (answers are remembered while the server runs);
   - if none of them know it, the AI's guess, marked as such.
3. **Wildlife value and actions.** OpenAI is asked how much the plant supports wildlife and what you can do about it. If it's invasive, the app always says to remove it and replace it with a native. If OpenAI is down or out of credits, the scan still returns the plant and its verdict, with wildlife value and actions marked unknown.
4. **Scoring.** The biodiversity score is worked out with fixed rules, no AI: natives with high wildlife value score highest, invasives score lowest, and there are bonuses for having lots of natives and penalties for each invasive.
5. **Recommendations and the letter.** OpenAI suggests native plants for your ZIP. Anything invasive, or that USDA says isn't native to Florida, gets filtered out. The letter is a fixed template, and OpenAI only writes one or two sentences about the plants you picked. Without OpenAI, recommendations come straight from our natives list and the letter uses each plant's "why it matters" line instead.

The invasive list is generated from the official FISC PDF by a script in `backend/scripts/`. The 22 natives and the "why it matters" lines are our own and still need checking against UF/IFAS before the demo.

## Finding your way around

| Folder | What's in it |
|---|---|
| `frontend/` | The phone app. `screens/` has one file per screen, `navigation/` sets up the tabs, `services/` has the code that sends requests to the backend, and `styles/` has the colors. |
| `backend/` | The Python server the app talks to. `app.py` lists the web addresses the app can call. `services/` does the actual work (identifying, looking up Florida status, scoring, writing the letter). `data/` holds the Florida plant lists. `scripts/` has the tool that rebuilds the invasive list from the official FISC PDF. `tests/` checks it all works. |
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

- Done: Florida plant lists drive the native/invasive verdict, every verdict comes with its source and a "why it matters" line, plants are identified by PlantNet with OpenAI as a backup, the full FISC invasive list and a USDA check are in place, scans keep working when OpenAI is down, results credit Pl@ntNet, and the backend has automated tests.
- Next: let the app send several photos and ask the user to confirm unsure identifications, show the source and "why it matters" in the app, show "unknown" wildlife value and an AI-unavailable notice properly (the scan screen currently shows unknown values as Medium), double-check the plant lists against official sources, and put the backend online so the app works away from our computers.
