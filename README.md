# EcoLoco-FL

A tool for climate action, built for South Florida.

EcoLoco helps students find out which plants on their campus help local wildlife and which ones hurt it. You scan plants with your phone, and the app tells you whether each one is native or invasive, gives your schoolyard a biodiversity score from 0 to 100, suggests native plants to add, and writes a letter you can send to your principal asking to plant them.

This is our entry for the 2026 Congressional App Challenge (FL-22). It started as EcoLoco and is being reworked around real Florida plant data.

**See how it all fits together:** https://aydinheugh.github.io/EcoLoco-FL/ (interactive map of the code, opens in any browser)

## What goes in and what comes out

**You give it:**
- A photo of a plant, taken with the camera or uploaded
- Your 5-digit ZIP code

**You get back, for each plant:**
- Its common and scientific name, and how confident the identification is
- Whether it's native, non-native, or invasive in South Florida
- Where that verdict came from: the Florida invasive species list, our list of Florida natives, or an AI guess if the plant isn't on either list
- One line on why it matters (for example, coontie is the only plant the Atala butterfly can lay its eggs on)
- How much it supports wildlife (high, medium, or low)
- Two practical things you can do about it

**After you scan a whole campus (the EcoScan tab):**
- A biodiversity score from 0 to 100, plus a list of the plants helping and hurting it
- A projected score showing how much planting the top recommendations would raise it
- Native plants to add for your ZIP code
- An editable letter to your principal that you can copy and send

The backend already sends where each verdict came from and why it matters, but the app screens don't show them yet. That's next on the list.

## What happens in between

1. **Identifying the plant.** The photo goes to OpenAI's image model (gpt-4o-mini), which returns the species name, a confidence level, and a few other species it might be. This step is kept separate so it can later be swapped for a plant-specific service like PlantNet.
2. **Native or invasive.** The species name is looked up in two lists that ship with the backend: South Florida invasives from the Florida Invasive Species Council (FISC), and South Florida natives. If the plant is on either list, that answer is final. If not, the app falls back to the AI's guess and says so.
3. **Wildlife value and actions.** OpenAI is asked how much the plant supports wildlife and what you can do about it. If it's invasive, the app always says to remove it and replace it with a native.
4. **Scoring.** The biodiversity score is worked out with fixed rules, no AI: natives with high wildlife value score highest, invasives score lowest, and there are bonuses for having lots of natives and penalties for each invasive.
5. **Recommendations and the letter.** OpenAI suggests native plants for your ZIP. Anything on the invasive list gets filtered out. The letter is a fixed template, and OpenAI only writes one or two sentences about the plants you picked.

The plant lists are a starting set of 22 invasives and 22 natives. They still need to be checked against the official FISC and UF/IFAS lists before the demo.

## Finding your way around

| Folder | What's in it |
|---|---|
| `frontend/` | The phone app. `screens/` has one file per screen, `navigation/` sets up the tabs, `services/` has the code that sends requests to the backend, and `styles/` has the colors. |
| `backend/` | The Python server the app talks to. `app.py` lists the web addresses the app can call. `services/` does the actual work (identifying, looking up Florida status, scoring, writing the letter). `data/` holds the Florida plant lists. `tests/` checks it all works. |
| `assets/` | Images used in the app, plus the app icon and splash screen. |
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

You'll need Node.js, Python 3, and an OpenAI API key.

**Backend** (from the `backend` folder):
1. Create a file called `.env` containing `OPENAI_API_KEY=your-key-here`
2. Set up Python and install what it needs:
   ```
   py -m venv venv
   venv\Scripts\python -m pip install Flask flask-cors openai python-dotenv requests pytest
   ```
   On Mac or Linux, use `python3` instead of `py` and `venv/bin/python` instead of `venv\Scripts\python`.
3. Start the server: `venv\Scripts\python app.py`. It runs on port 5000.

**App** (from the top folder):
1. Create a file called `.env` containing `EXPO_PUBLIC_API_URL=http://YOUR-COMPUTER-IP:5000`. If you're testing on a phone, use your computer's local network address, not `localhost`.
2. Run `npm install`, then `npx expo start`.
3. Scan the QR code with the Expo Go app, or press `w` to open it in a web browser.

**Tests** (from the `backend` folder): `venv\Scripts\python -m pytest -v`. The tests don't need an API key and don't call OpenAI.

## Where things stand

- Done: Florida plant lists drive the native/invasive verdict, every verdict comes with its source and a "why it matters" line, and the backend has automated tests.
- Next: show the source and "why it matters" in the app, double-check the plant lists against official sources, and put the backend online so the app works away from our computers.
