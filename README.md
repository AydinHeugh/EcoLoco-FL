# EcoLoco-FL

EcoLoco helps students turn a campus plant survey into a practical planting proposal. Identify plants, review their Florida status and sources, record site conditions, choose native additions, and prepare an editable request for school review.

This is the 2026 Congressional App Challenge entry for FL-22. The current pilot accepts five-digit ZIP codes beginning **330–334**. That defines the supported region; a ZIP does not establish an individual site's growing conditions.

## What goes in and comes out

Use **Scan a plant** on the home screen for identification, **EcoScan** for a campus survey, or **Explore a sample audit** to try the workflow. The sample is labeled as fictional and saved separately from a real survey.

**For a plant:** provide one to five JPEG/PNG photos of the same plant and the site's ZIP. The first photo gets a large preview, with additional photos below it. Results lead with the name and Florida status; **Review match** opens uncertain identification choices, and **Details & sources** opens the supporting records. You can retake photos, choose a supported alternative, or select a known species from the catalog. **Scan another plant** clears the current result and photos while keeping the ZIP. A photo identification and a source's classification of the named species are different kinds of evidence.

**For a survey:** EcoScan opens with ZIP and photo controls. Add plants, then open **Site details** for the area, date, sunlight, moisture, available space, and maintenance capacity. Four compact selectors use dropdowns on web and selection dialogs on phones. Unknown conditions can stay unset. **Finish audit** opens the required area/date fields if either needs attention. Each saved plant has expandable evidence and a field note. The report shows:

- Native, nonnative, and invasive counts for unique verified taxa, with unresolved observations kept visible outside the denominator. A taxon means a species or a separately documented variety/subspecies with a different status.
- **Native share of verified taxa**: native taxa divided by all verified taxa in the sample. Synonyms and repeated photographs count once. This is not a campus biodiversity score, plant-abundance measure, or wildlife-population estimate.
- Source-backed native additions that fit the recorded conditions and are absent from the verified inventory. The first three appear initially; expand the list for more, or a plant's details for growing guidance and sources. Unknown conditions remain explicit. Options are alphabetical, not ranked by invented impact points.
- A selected-species scenario recalculated from the proposed inventory. Planting another individual of a species already present does not change this metric.
- An editable school proposal containing the survey facts, source links, chosen plants, location, quantities, budget, maintenance responsibility, and permission request. **Personalize letter** opens optional planning and recipient fields; blank fields become placeholders. Changes to the underlying survey mark an existing draft as needing review.
- A text report to download on web or open in the native share sheet, plus a copyable proposal.

The report keeps survey evidence under **Sources & survey details**. When selected plants change, the previous scenario stays labeled while recalculating; complete-report export waits for a result matching the current selections.

Audits and draft edits save on the current device. There is one real audit and one separate sample audit; starting a new scan replaces that slot after confirmation. Export before replacing work you want to keep. There is no account or cloud synchronization.

## How the evidence works

1. **Identify the photograph.** PlantNet returns candidate species. An unambiguous top result with a score of at least 0.80 and a lead greater than 0.15 is accepted without an extra identification step. Close results can be reviewed by an image model and still require user confirmation. If PlantNet is unavailable, the image-model fallback can provide candidates. If neither service succeeds, the observation remains unresolved and the manual catalog is available. Model scores are not measured accuracy rates.
2. **Check Florida status.** Bundled, source-linked nonnative records and taxonomic exceptions are checked first, then the FISC invasive list, then the native catalog. Matching preserves important varieties, subspecies, hybrids, and synonyms. Known natives, nonnatives, and invasives retain their supported classifications even when explanation services are unavailable. Unsupported names may receive a separately labeled automated hypothesis; it does not become verified evidence.
3. **Keep local status separate from national occurrence.** USDA occurrence and lower-48 nativity do not establish Florida nativity. The optional USDA helper is retained for distribution research; the active classification and recommendation flow does not depend on it.
4. **Calculate from source records.** The server looks up each scientific name again; it does not trust submitted native/invasive labels. Only resolved identifications with sourced Florida status enter the fraction. Ambiguous broad firebush/ficus names still need the relevant taxon choice. Additions and removals use the same calculation; a projected removal means that taxon is no longer present in the surveyed area.
5. **Build an actionable proposal.** Recommendations come from verified native catalog entries, filtered by inventory and site requirements. Proposal generation rechecks selected plants and uses a fixed factual template. Catalog lookup, survey calculation, recommendations, and proposals do not require paid model services. A running backend is still needed.

The catalog includes Florida status sources, wildlife relationship sources, growing guidance, and verification dates. Its descriptive wildlife categories do not establish measured wildlife at a campus. FISC categories describe documented invasive effects and distribution; the FISC list is not itself a regulatory list. The app does not establish permission to remove vegetation or approve a planting.

## Photos, saved work, and request limits

Prepared photos are sent through the backend to identification providers when you request identification. The backend decodes and checks JPEG/PNG data, strips metadata, resizes photos, and rejects remote image URLs. Each prepared upload is limited to 4 MB, with at most five photos and a 30 MB request limit. The picker accepts originals under 12 MB and prepares smaller copies before upload.

Saved audits contain observations, notes, site details, and proposal text; photo payloads and photo URIs are excluded from persisted audit records. This local storage is not an encrypted vault. Exported reports contain the survey information and names you enter. Use school-approved photos, avoid unnecessary personal details, and clear or export an audit appropriately on shared devices.

The client has deadlines, cancellation, inline errors, and retry controls. A recovery screen can reopen the app after a rendering failure without clearing saved audits; unsaved edits or staged photos may need to be added again. The backend returns JSON errors and has per-client and shared identification limits. These limits are held in one server process and reset when it restarts; a public deployment needs shared gateway limits if it uses several workers or instances. Aborted client requests may already have reached a provider.

## Run locally

Use Node.js 20.19 or newer and Python 3.11 or newer. The checked-in app uses Expo SDK 54 and its matching dependencies; reading the required [SDK 56 reference](https://docs.expo.dev/versions/v56.0.0/) does not migrate the project. Use a compatible Expo client or development build when checking a phone.

**Backend**, from the `backend` folder:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-dev.txt
cp .env.example .env
.venv/bin/python app.py
```

On Windows, use `py` in place of `python3` and `.venv\Scripts\python` in place of `.venv/bin/python`. Copy the example file using your shell or file manager.

Fill in the backend's provider keys for live photo identification. Obtain a PlantNet key from [PlantNet](https://my.plantnet.org/); the image-model fallback uses an OpenAI key. Never put provider keys in frontend configuration. Without provider keys, the manual catalog and the survey-to-proposal workflow still work. Keep development debug mode off for demonstrations and public hosting.

The local server listens on `127.0.0.1:5000` by default. For a physical phone on the same trusted Wi-Fi, use a server bound to the computer's LAN interface and point the phone at that address. For example, from `backend`:

```sh
.venv/bin/python -m flask --app app run --host=0.0.0.0 --port=5000
```

**Frontend**, from the repository root:

```sh
npm ci
cp .env.example .env
npx expo start
```

Set `EXPO_PUBLIC_API_URL` in the root `.env` to the backend address, such as `http://127.0.0.1:5000` for a browser on this computer or `http://YOUR-LAN-IP:5000` for a phone. Restart Expo with `npx expo start --clear` after changing it, and clear the export cache when rebuilding. Press `w` for web. The public API URL is configuration, not a secret.

## Before public hosting

Use the backend's production requirements and HTTPS. The supplied Gunicorn configuration runs one worker with four threads and a 60-second worker timeout, keeping the in-process quota state shared within that server. From `backend` on a supported production host:

```sh
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/gunicorn --config gunicorn.conf.py app:app
```

Set the server's `BIND` environment variable if the host requires a different listening interface or port. Configure the exact frontend origins allowed by the backend and rebuild the frontend with the public HTTPS API address. Keep provider credentials on the server, set provider budget limits, and configure identification quotas for the expected demo traffic. The built-in quotas are intended for a single-process pilot; put shared limits at the gateway before scaling to multiple workers. Do not blindly trust forwarded client-IP headers.

Check the health endpoint, then test the app from a signed-out browser on another device/network. The repository does not provision hosting accounts or a public URL. Deployment still requires choosing a host and supplying credentials. Backend `.env.example` documents the supported settings.

## Checks and validation

From `backend`, run the tests without live provider calls:

```sh
.venv/bin/python -m pytest -q
```

From the repository root:

```sh
node --test frontend/tests/*.test.mjs
npx expo install --check
npx expo export --platform web --clear
node docs/sync-architecture.mjs --check
```

GitHub Actions is configured to repeat the tests, dependency alignment, architecture check, and web/iOS/Android exports on pushes and pull requests. The workflow itself has not run on GitHub until this branch is pushed.

Compatible dependency patches were applied. The current Expo/React Native dependency tree still reports 36 npm advisories (23 high and 13 moderate), largely in development/build tooling. Resolving the rest needs a separately tested framework/dependency update; forced changes would cross the current SDK compatibility boundary.

Automated tests cover source matching, taxonomic exceptions, calculation invariants, selection/proposal rules, input bounds, failure handling, and frontend state/evidence logic. They do not measure live identification accuracy or establish real user or ecological outcomes. Camera permissions and upload behavior also need checks on actual iOS and Android devices. Record manual and field results in [the field-testing guide](docs/field-testing.md).

To rebuild the FISC data from an official PDF, use `backend/scripts/build_fisc_list.py` with the development requirements installed. Review source metadata and catalog exceptions after regenerating it; do not replace a reviewed catalog without checking the resulting changes.

## Find your way around

| Location | Purpose |
|---|---|
| `frontend/screens/` | Home, identification, campus audit, report/proposal, and planting options. |
| `frontend/components/` | Shared photo picker, evidence cards, site controls, and accessible audit controls. |
| `frontend/services/` | Bounded server requests, local audit storage, and text-report creation. |
| `frontend/utils/` and `frontend/tests/` | Photo/evidence rules and frontend regression checks. |
| `backend/app.py` | Validated API routes, JSON errors, request limits, and health checks. |
| `backend/services/` | Identification, Florida evidence, native-share calculations, site filtering, and proposals. |
| `backend/data/` | Native records, nonnative exceptions, and the FISC list with source provenance. |
| `backend/tests/` | Backend regression checks with mocked external services. |
| `docs/implementation-plan.md` | Scope, shared contracts, acceptance checks, and work requiring the team. |
| `docs/submission-guide.md` | Adaptable application answers and the 2:50 video plan; not a submitted application. |
| `docs/field-testing.md` | Independent plant labels, accuracy/coverage metrics, user tasks, and school review records. |

`App.js`, `index.js`, and `app.json` start and configure the app. `AGENTS.md` and `CLAUDE.md` contain repository instructions.

The [interactive architecture map](docs/architecture.html) is the branch-local source of truth; it needs internet for its visualization libraries. [The hosted map](https://aydinheugh.github.io/EcoLoco-FL/) may show a different revision until this branch is published. After a structural change, update the map and run `node docs/sync-architecture.mjs` to check it and regenerate [ARCHITECTURE.md](ARCHITECTURE.md).

## Work still requiring the team

Run a permitted campus survey, obtain independent plant labels, test with target users, and have school staff review a proposal. Supply authentic personal motivation, student contributions, and learning. Record the demonstration, complete accurate application disclosures, verify eligibility, and submit. Plant survival and wildlife outcomes require later observation. The sample audit, automated checks, and document templates are not evidence that these activities have occurred.
