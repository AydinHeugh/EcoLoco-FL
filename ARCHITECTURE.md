# EcoLoco-FL Architecture

Map of the whole app: Expo screens → API client → Flask routes → services → bundled data and external APIs.

**Interactive version:** https://aydinheugh.github.io/EcoLoco-FL/ (or open
[`docs/architecture.html`](docs/architecture.html) locally; it needs internet for the React Flow CDN). Drag nodes, pan and zoom, and click any node for a side panel
explaining what that file or function does, the steps it runs, what it calls, and what calls it.

## Keeping this in sync

The graph data lives in one place: the `graph-data` JSON block in `docs/architecture.html`.
Everything between the `GENERATED` markers below is produced from it. After a significant change:

1. Edit the nodes/edges in `docs/architecture.html` (each node: file, symbol, what, how, goal).
2. Run `node docs/sync-architecture.mjs`. It fails if a node points at code that no longer
   exists, or if a screen, API-client function, route or service function has no node. It warns
   when a PLANNED node's code now exists (so you can drop the tag). Then it rewrites the sections below.
3. `node docs/sync-architecture.mjs --check` only verifies, which makes it usable in CI.

## Glossary

A scan travels Screen → API client → Flask route → Service → External API / Bundled data,
and the answer comes back the same way.

### Layers

| Color | Term | What it means | Where |
|---|---|---|---|
| green | **Screen / UI** | What the user sees and taps in the Expo app. | `frontend/screens/`, `frontend/navigation/AppNavigator.js` |
| grey | **Device** | Phone features the app borrows: camera/photo library and clipboard. | `expo-image-picker`, `expo-clipboard` |
| blue | **API client** | Small frontend functions that send requests over the internet to our backend. | `frontend/services/geminiService.js`, `plantService.js` |
| orange | **Flask route** | A backend URL that receives those requests — the front door of the Python server. | `backend/app.py` |
| purple | **Service** | Backend functions that do the real work once a route gets a request. | `backend/services/*.py` |
| teal | **Bundled data** | Data files shipped with the backend instead of fetched online. | `backend/data/*.json` (planned) |
| red | **External API** | Outside services the backend calls: OpenAI, iNaturalist, OpenStreetMap Nominatim (ZIP → location), USDA later. | — |

### Markers

| Term | What it means |
|---|---|
| **Planned** | Doesn't exist yet but is decided. Drawn dashed, with its goal. |
| **Change planned** | Exists today, but a planned change will modify it (e.g. a rename). |
| **Dead code** | Exists but does nothing useful. Drawn dotted grey. |
| **Calls it** (orange) | In the interactive page, after clicking a node: the nodes that use it. |
| **It calls** (blue) | In the interactive page, after clicking a node: the nodes it uses. |

## Planned and pending changes

<!-- GENERATED:planned -->
| Item | Status | Goal |
|---|---|---|
| `'Why it matters' line` | PLANNED | Priority 4: show the why line and its source on the Identify screen, and the 4-line "Why this matters" section on the results screen. |
| `Source receipt badge` | PLANNED | Show where each native/invasive verdict came from. The backend already returns `source` (FISC, fl_natives, USDA or unknown); only the UI is missing. |
| `identifyPlant()` (frontend/services/geminiService.js) | change planned | File becomes apiClient.js — it calls our Flask API, not Gemini. |
| `getPlantRecommendations()` (frontend/services/geminiService.js) | change planned | File becomes apiClient.js — it calls our Flask API, not Gemini. |
| `generateLetter()` (frontend/services/geminiService.js) | change planned | File becomes apiClient.js — it calls our Flask API, not Gemini. |
| `getLocalPlants()` (frontend/services/plantService.js) | DEAD | Delete plantService.js — the backend route it called has been removed. |
| `Flask app (app.py)` (backend/app.py) | change planned | Deploy to a public host before the demo (today: localhost with debug=True). |
| `get_plant_requests()` (backend/services/inat_service.py) | DEAD | Nothing calls it since the confidence nudge was removed. Repurpose it (e.g. a 'seen near you' count) or delete inat_service.py. |
| `get_status()` (backend/services/fl_plants_service.py) | change planned | Add ZIP-specific regional lists behind the same get_status(). |
| `fisc_list.json` (backend/data/fisc_list.json) | change planned | Verify the 22 curated "why" lines against FISC / UF-IFAS before the demo. |
| `fl_natives.json` (backend/data/fl_natives.json) | change planned | Verify every entry against UF/IFAS and the Atlas of Florida Plants before the demo. |
| `Multi-photo upload` | PLANNED | Let users send 1–5 photos of one plant as `images` (Priority 6). The confirm picker already shipped. |
| `AI-unavailable notice` | PLANNED | Show a short notice when a scan, recommendation list or letter has `ai_unavailable: true`. Unknown wildlife values and statuses are already labelled "Unknown". |
| `fl_recommendations.json` (backend/data/fl_recommendations.json) | change planned | A teammate checks each plant is native to Palm Beach County in the USF Atlas and sets verified: true. Only verified plants are recommended, so the plan shows no Add cards until then. |
| `getPlan()` (frontend/services/geminiService.js) | change planned | File becomes apiClient.js — it calls our Flask API, not Gemini. |
<!-- /GENERATED:planned -->

## Diagram

<!-- GENERATED:mermaid -->
```mermaid
flowchart LR
  subgraph L_ui["Screens & UI"]
    direction TB
    app["AppNavigator"]
    home["HomeScreen"]
    ident["IdentificationScreen"]
    rec["RecommendationScreen"]
    audit["AuditScreen (EcoScan)"]
    results["AuditResultsScreen"]
    ui_why["'Why it matters' line<br/>PLANNED — goal: Priority 4: show the why line and its source on the Identify screen, and the 4-line #quot;Why this matters#quot; section on the results screen."]
    ui_receipt["Source receipt badge<br/>PLANNED — goal: Show where each native/invasive verdict came from. The backend already returns `source` (FISC, fl_natives, USDA or unknown); only the UI is missing."]
    letter["LetterGenerator"]
    ui_multiphoto["Multi-photo upload<br/>PLANNED — goal: Let users send 1–5 photos of one plant as `images` (Priority 6). The confirm picker already shipped."]
    ui_ai_unknown["AI-unavailable notice<br/>PLANNED — goal: Show a short notice when a scan, recommendation list or letter has `ai_unavailable: true`. Unknown wildlife values and statuses are already labelled #quot;Unknown#quot;."]
    ui_picker["CandidatePicker + StatusBadge"]
    ui_ring["PercentRing"]
    ui_plancard["PlanCard + SourceLine"]
  end
  subgraph L_device["Device"]
    direction TB
    picker["expo-image-picker"]
    clipboard["expo-clipboard"]
  end
  subgraph L_client["API client"]
    direction TB
    c_identify["identifyPlant()"]
    c_rec["getPlantRecommendations()"]
    c_letter["generateLetter()"]
    c_local["getLocalPlants()<br/>DEAD — Delete plantService.js — the backend route it called has been removed."]
    c_plan["getPlan()"]
    c_user_message["userMessage()"]
  end
  subgraph L_route["Flask routes"]
    direction TB
    flask["Flask app (app.py)"]
    r_identify["POST /identify"]
    r_recommend["POST /recommend"]
    r_letter["POST /letter"]
    r_plan["POST /plan"]
  end
  subgraph L_svc["Services"]
    direction TB
    s_inat["get_plant_requests()<br/>DEAD — Nothing calls it since the confidence nudge was removed. Repurpose it (e.g. a 'seen near you' count) or delete inat_service.py."]
    s_identify["identify_plant()"]
    s_letter["generate_letter()"]
    s_fl["get_status()"]
    s_species["identify_species()"]
    s_plantnet["identify_with_plantnet()"]
    s_usda["florida_status()"]
    s_resolve["resolve()"]
    s_option["plant_option()"]
    s_common_name["common_name()"]
    s_summary["summarize()"]
    s_plan["build_plan()"]
    s_guard["mentions_new_names()"]
    s_letter_facts["letter_facts()"]
  end
  subgraph L_data["Bundled data"]
    direction TB
    d_fisc["fisc_list.json"]
    d_natives["fl_natives.json"]
    fisc_builder["build_fisc_list.py"]
    d_recs["fl_recommendations.json"]
    d_nwf["nwf_keystone_fl.json"]
    d_terms["nature_terms.json"]
  end
  subgraph L_ext["External APIs"]
    direction TB
    inat["iNaturalist API"]
    openai["OpenAI (gpt-4o-mini)"]
    usda["USDA PLANTS"]
    plantnet["PlantNet API"]
  end
  app -->|"tab: Home"| home
  app -->|"tab: Identify"| ident
  app -->|"tab: Recommend"| rec
  app -->|"tab: EcoScan"| audit
  app -->|"stack screen: AuditResults"| results
  home -->|"navigate('Camera')"| ident
  home -->|"navigate('Recommend')"| rec
  ident -->|"navigate('Recommend', {prefillZip})"| rec
  audit -->|"navigate('AuditResults', {plants[], zipCode})"| results
  results -->|"navigate(Main → Recommend, {prefillZip})"| rec
  results -->|"renders LetterGenerator {plan, zipCode}"| letter
  ident -->|"launchCamera / launchImageLibrary → {uri, base64}"| picker
  audit -->|"launchCamera / launchImageLibrary → {uri, base64}"| picker
  letter -->|"setStringAsync(editedLetter)"| clipboard
  ident -.->|"renders result.why"| ui_why
  rec -.->|"renders item.why"| ui_why
  ident -.->|"renders result.source"| ui_receipt
  audit -.->|"renders plant.source"| ui_receipt
  ident -->|"identifyPlant(photo.base64, zipCode)"| c_identify
  audit -->|"identifyPlant(photo.base64, zipCode) per scan"| c_identify
  rec -->|"getPlantRecommendations(zip)"| c_rec
  letter -->|"generateLetter(plan, zipCode)"| c_letter
  c_identify -->|"POST /identify {image, location}"| r_identify
  c_rec -->|"POST /recommend {location}"| r_recommend
  c_letter -->|"POST /letter {plan, zip_code}"| r_letter
  flask -->|"registers"| r_identify
  flask -->|"registers"| r_recommend
  flask -->|"registers"| r_letter
  r_identify -->|"identify_plant(image, location)"| s_identify
  r_letter -->|"generate_letter(plan, zip_code)"| s_letter
  s_inat -.->|"GET /v2/observations q=name → ≤100 points"| inat
  s_letter -->|"opening paragraph + plain-language system prompt → reworded paragraph"| openai
  s_fl -->|"match scientific_name"| d_fisc
  s_fl -->|"match scientific_name"| d_natives
  s_identify -->|"identify_species(images, location) → state, ranked options, suggested"| s_species
  s_species -->|"unsure: suggest one of PlantNet's options · PlantNet failed: identify from photos"| openai
  ident -.->|"sends images[], reads needs_confirmation"| ui_multiphoto
  audit -.->|"sends images[], reads needs_confirmation"| ui_multiphoto
  s_species -->|"identify_with_plantnet(images) → ranked species + scores"| s_plantnet
  s_plantnet -->|"POST /v2/identify/all (1–5 photos) → results[]"| plantnet
  ident -.->|"reads ai_unavailable"| ui_ai_unknown
  audit -.->|"reads ai_unavailable"| ui_ai_unknown
  s_fl -->|"florida_status(name) → native / introduced / None"| s_usda
  s_usda -->|"search → profile → FL distribution"| usda
  fisc_builder -->|"writes 179 species from the official PDF"| d_fisc
  s_identify -->|"plant_option(name, common_name, confidence, zip) per option → status, labels, why"| s_option
  s_option -->|"get_status(name, zip) → native, invasive, source, why"| s_fl
  s_option -->|"resolve(name) → one scientific name"| s_resolve
  s_fl -->|"resolve(name) before any list lookup"| s_resolve
  s_species -->|"resolve(name) to merge names of the same species"| s_resolve
  s_resolve -->|"names, synonyms, common names"| d_fisc
  s_resolve -->|"names, synonyms, common names"| d_natives
  ident -->|"unsure match → pick one or #quot;None of these#quot;"| ui_picker
  audit -->|"unsure card → pick one or #quot;None of these#quot;"| ui_picker
  s_option -->|"common_name(scientific_name) → our name for it"| s_common_name
  s_common_name -->|"resolve(name)"| s_resolve
  s_summary -->|"plant_option(name) per plant → status"| s_option
  results -->|"percent_native, percent_native_with_plan"| ui_ring
  results -->|"getPlan([{scientific_name, plant_name}], zipCode)"| c_plan
  c_plan -->|"POST /plan {plants, location}"| r_plan
  flask -->|"registers"| r_plan
  r_plan -->|"build_plan(plants)"| s_plan
  r_recommend -->|"build_plan([]) → add cards"| s_plan
  s_plan -->|"summarize(plants, added_natives)"| s_summary
  s_plan -->|"verified plants, facts, replaces"| d_recs
  s_plan -->|"genus → caterpillar count for the group"| d_nwf
  s_option -->|"helps, watch_out for known plants"| d_recs
  s_resolve -->|"names, common names"| d_recs
  s_letter -->|"letter_facts(plan, zip) → template text"| s_letter_facts
  s_letter -->|"mentions_new_names(reply, opening)"| s_guard
  s_guard -->|"animal and plant words"| d_terms
  results -->|"Remove and Add cards"| ui_plancard
  rec -->|"Add cards"| ui_plancard
  results -->|"error text"| c_user_message
  classDef ui fill:#e3f2e1,stroke:#2e7d32,color:#12301a
  classDef device fill:#eceff1,stroke:#607d8b,color:#263238
  classDef client fill:#e1effa,stroke:#1e6fb8,color:#0d2d4d
  classDef route fill:#fff1d6,stroke:#c77800,color:#4a2c00
  classDef svc fill:#f1e4f7,stroke:#7b3fa0,color:#2e0f40
  classDef data fill:#e0f4f1,stroke:#00897b,color:#00332d
  classDef ext fill:#fde4e1,stroke:#c0392b,color:#4a0f08
  classDef planned stroke-dasharray:6 4,stroke-width:2px
  classDef dead fill:#f3f3f3,stroke:#9e9e9e,color:#616161,stroke-dasharray:3 3
  class app,home,ident,rec,audit,results,ui_why,ui_receipt,letter,ui_multiphoto,ui_ai_unknown,ui_picker,ui_ring,ui_plancard ui
  class picker,clipboard device
  class c_identify,c_rec,c_letter,c_local,c_plan,c_user_message client
  class flask,r_identify,r_recommend,r_letter,r_plan route
  class s_inat,s_identify,s_letter,s_fl,s_species,s_plantnet,s_usda,s_resolve,s_option,s_common_name,s_summary,s_plan,s_guard,s_letter_facts svc
  class d_fisc,d_natives,fisc_builder,d_recs,d_nwf,d_terms data
  class inat,openai,usda,plantnet ext
  class ui_why,ui_receipt,ui_multiphoto,ui_ai_unknown planned
  class c_local,s_inat dead
```
<!-- /GENERATED:mermaid -->
