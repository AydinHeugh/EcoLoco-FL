# EcoLoco UX review (Phase 1)

Reviewed 2026-10-17 in the web build at phone width (400 × 860), against the real backend with live PlantNet, OpenAI and USDA. No code was changed.

**How it was tested**
- ZIP 33496 (Boca Raton, Palm Beach County) unless noted.
- Photos from Wikimedia Commons:
  - coontie (*Zamia integrifolia*)
  - cardboard palm (*Zamia furfuracea*), as the look-alike
  - Brazilian pepper: a live shrub, plus dried peppercorns in a bowl as a bad photo
  - ixora (*Ixora coccinea*), as a non-native that isn't a problem
  - the coontie photo heavily blurred
  - *Welwitschia mirabilis*, a desert plant that is on none of our lists
- AI unavailable: the backend was restarted with an invalid OpenAI key passed in the environment. `.env` was not touched.
- Scores and recommendations were also called directly to compare spellings and ZIPs.

**What this review did not cover**
- A real phone (Expo Go). Layout problems found at web phone width may look different on a device.
- The camera button. Every photo was uploaded.

## Spelling test: does the name change the score?

Yes. The scoring picks points from a hash of the plant's name. Each run below sent the same audit: one native plant with high wildlife value plus Brazilian pepper. Only the native plant's name changed.

| Name sent | Score | "After actions" |
|---|---|---|
| Coontie | 48 | 72 |
| coontie | 47 | 71 |
| Zamia integrifolia | 48 | 72 |
| Florida Arrowroot | 45 | 69 |

"After actions" is always the score plus 24, whatever the plants are.

## Findings, ranked by how much each would confuse a student or judge

| # | Screen | Input | Output on screen | Problem | Fix |
|---|---|---|---|---|---|
| 1 | AuditResults | Any audit; spelling test above | "29 out of 100", "Low"; plan cards "+8 pts" each; "could raise your score from 29 → 53 (+24 pts)" | The score comes from no real fact: points come from a hash of the name, the boost is +8 per action regardless of plant, and spelling changes the result. A judge who asks "where does 29 come from?" gets no answer. | Remove the score. Show counts by status, percent native, and percent native with the plan (Phase 2 step 1). |
| 2 | Identify, EcoScan | The same coontie photo, scanned 4 times | Run 1: "Florida Arrowroot", Native. Identify: blank name, *Zamia loddigesii*, "Non-Native". EcoScan: blank name, *Zamia loddigesii*, "Native". AI down: *Zamia loddigesii*, "Status unknown". | Our flagship native gets a different answer each time, usually a Mexican species with no common name. PlantNet's raw scores: *Z. loddigesii* 0.29, *Z. integrifolia* 0.13, *Z. pumila* 0.12. The last two are both coontie (our list already treats *Z. pumila* as coontie), but PlantNet splits its score between the two names, so the Mexican cycad comes out on top and the AI tiebreaker keeps it. Common names like "Florida Arrowroot" aren't matched at all. | Merge names of the same species before ranking, and match common names too. Show a "which one is it?" picker instead of guessing, and ask for another photo of a named plant part (step 7). Add multi-photo. |
| 3 | Identify, EcoScan | Coontie and Welwitschia (on none of our lists) | Same *Zamia loddigesii*: "Non-Native" on Identify, "Native" on EcoScan. Welwitschia: "Non-Native". | When no list knows the plant, the label is the AI's guess and isn't marked as one, so it flips between runs. Separately, Identify shows any unknown status as "Non-Native". | Never guess a status. Show "Not on our Florida lists" and count the plant as unknown. Fix the Identify fallback the way EcoScan was fixed. |
| 4 | AuditResults, letter | Audit with Brazilian pepper (invasive, FISC) | Plan: plant Coontie, Firebush, Saw Palmetto. The letter asks only to add those three. | The one invasive the student found is never mentioned. The plan and the letter are the same for every campus (the same top 3 came back on every run). | Build the plan from the audit: "Remove" cards for invasives found, and "Add" cards that fill gaps (step 3). The letter lists the removals (step 8). |
| 5 | Recommend, AuditResults | ZIP 33496; ZIP 10001 (New York) | 33496 list includes Purple coneflower, Southern magnolia, Pawpaw, Eastern red cedar, Coral honeysuckle. 10001 gets Eastern redbud, Joe-Pye weed, Wild lupine. | The AI picks the plants, and the only filter is USDA's statewide "native to Florida", which can't tell north Florida from Palm Beach. Several of these are not known from South Florida (still to confirm in the USF Atlas). A New York ZIP gets New York plants. | Pick only from `fl_recommendations.json`, with entries checked against the Palm Beach County Atlas (step 2–3). |
| 6 | Identify | Brazilian pepper (live shrub) | "Brazilian peppertree", "Invasive", confidence, warning, two actions | The backend sends the source (FISC) and a "why it matters" line, but Identify shows neither. The verdict appears with no source. | Show the "why" line, with the source in small text underneath (step 4). |
| 7 | AuditResults | Ixora, cardboard palm | Listed under "Hurting your ecosystem" | Non-native plants that aren't invasive are shown as harmful. A student might rip out harmless plants. | Use three groups: native, non-native (not harmful), invasive (step 1 counts). |
| 8 | Identify, EcoScan | Blurred coontie; peppercorns in a bowl | Blur: "Great yellow cress", 4% confident. Bowl: "Kamchatka bilberry" (a Siberian plant), "High wildlife support". | A useless photo still gets a specific, confident-sounding name, plus actions and wildlife ratings. The only guidance is "consult an expert"; nothing says what to photograph instead. | Below a floor, say "We couldn't tell what this is" and name the plant part to photograph next (step 7). Never show wildlife value for a guess. |
| 9 | All | AI unavailable | Recommend cards: "PROBLEM: Picked from our list of South Florida natives while AI suggestions are unavailable." Coontie: "? Unknown Wildlife". Audit of 1 invasive + 2 unknowns: "9 out of 100", "Critical — invasive species are dominating." The 2 unknown plants vanish from "What's on campus". | No screen says the AI is down. A system message appears as a "problem", known facts show as unknown, and the score panics over one plant. | A single plain notice. Fallback cards built from our bundled data, which doesn't need the AI. List unknowns as unknown. Score removal (finding 1) also fixes the panic text. |
| 10 | Identify, EcoScan, letter | Every non-invasive scan | 5 of 6 plants got "Plant native milkweed (Asclepias spp.) nearby", including the desert Welwitschia. Coontie "is not a keystone species". The letter says the Atala is "endangered" and adds the Northern mockingbird. | Actions are generic and repeat; the AI's wording contradicts our own "why" line; the letter adds facts that aren't in our data. | Actions and letter content come from our data; OpenAI may only rephrase (step 3, 4, 8). |
| 11 | Identify, EcoScan, AuditResults | Phone width 400 px | Identify result card cuts off the name and the status pill. EcoScan cards wrap mid-word ("confide / nt"). "Biodiversity Score" title runs off both edges; "← Back" overlaps the logo. | Looks broken on a phone-sized screen. Needs checking on a real phone too. | Stack the photo above the text on narrow screens; smaller title. |
| 12 | Recommend | ZIP 33496 | Card header "PROBLEM" over "Florida Coontie helps combat soil erosion…"; subtitle "ranked by impact". Coontie wildlife: Medium (scan), High (Recommend), Unknown (AI down). | The labels don't match the content: a positive fact under "Problem", a ranking that isn't one, and the same plant rated three ways. | Cards use Helps / Where / Buying it / Watch out / Look into (step 6). |
| 13 | All | Every scan | "keystone species", "biodiversity", "propagate", "ecological benefit", "established", "Consult a botanist", "Prioritise", "personalise" | Jargon and British spellings, above a 7th-grade reading level. | Word swaps and the same rules in the AI prompts (step 4). |
| 14 | Home | First open | "…plant type, native region, growing conditions, the pollinators it attracts…"; "one native oak can support over 500 butterfly and moth species" | It promises things the app doesn't show, and the oak number has no source (the national figure isn't the South Florida one). There's no link to EcoScan, the main feature. Each card is a long paragraph. | Short cards matching what the app really does, a sourced oak number from the NWF Ecoregion 15 list, and an EcoScan link. |
| 15 | AuditResults | Plan cards | "Hold any card to preview." / "Hold to preview all 3 combined" | Press-and-hold is hidden and hard to discover in a browser. It previews the made-up score. | Goes away with the score. |
| 16 | Recommend, letter | Bad ZIP, network error, letter error | Nothing on web (pop-up errors don't appear in a browser) | Silent failures, already known from the EcoScan fix. | Inline error text, as on EcoScan. |
| 17 | Identify, EcoScan, Recommend | Normal use | Identify 4–8 s per photo with "Analyzing your plant…". Recommendations 10–14 s with a spinner. | There is feedback, but no steps, so 14 s feels stuck. | Progress steps: "Identifying… Checking Florida lists…" (step 7). |
| 18 | EcoScan | Empty audit | "No plants scanned yet"; no Finish button | Works as it should. | None. |

## Notes for Phase 2

- `backend/services/inat_service.py` already queries iNaturalist, but nothing calls it. It searches by species name, not by location, and its User-Agent contains a personal email address. The "Seen near you" work should replace it rather than build on it.
- `frontend/services/plantService.js` calls a backend address that doesn't exist. It is unused.
