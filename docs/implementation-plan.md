# Campus audit reliability implementation plan

Base: `origin/master` at `89be52fe`, October 17, 2026. All implementation is on `Kian-Lee`.

## Scope and sequence

1. Verify and enrich the Florida catalog; preserve taxonomic exceptions; separate local nativity from national distribution. Confident, supported matches remain classified. Unsupported inference is visibly tentative rather than silently presented as fact.
2. Replace the arbitrary biodiversity score with native share of verified unique species, separate invasive and unresolved counts, and actual selected additions/removals recalculated with the same rules.
3. Recommend positively verified natives using the observed inventory and site conditions. Produce one consistent card schema and a factual, editable proposal with source links and explicit site/maintenance/budget fields.
4. Show evidence and identification alternatives. Support confirmation through a fresh server lookup, multi-photo identification, safe retries and useful provider-outage states.
5. Persist audits and proposal edits; provide resume, explicit reset, sample audit and a portable report. Lead the homepage into this complete workflow.
6. Validate and bound API requests, uploads, service calls and paid endpoint use. Reject remote image URLs. Provide health checks, deployment instructions and predictable JSON errors.
7. Run backend regression tests, frontend logic tests, Expo dependency/build checks, and browser scenarios including failure, refresh/recovery, uncertainty and end-to-end sample proposal. Synchronize architecture and README.
8. Prepare submission and field-testing materials without inventing participation, ecological outcomes, personal motivation or learning.

## Shared API contract

All routes return `{result: ...}` or a JSON `{error, code}` with an appropriate HTTP status. Supported pilot ZIP codes begin 330–334; disclose this geographic scope rather than inferring arbitrary ZIP suitability.

- `POST /identify`: `{images: [base64 or image data URL], location}`; legacy single `image` accepted. One to five bounded JPEG/PNG images. Identification result retains existing plant fields and adds canonical `taxon_id`, `source_url`, `verified_on`, `status_verified`, `status_scope`, `needs_confirmation`, `user_confirmed`, `id_source`, `ai_unavailable`, and explicit unknowns. High-confidence unambiguous identifiers and authoritative status evidence do not require extra confirmation.
- `POST /confirm`: `{scientific_name, location}`; resolve the selected species again and return a complete plant result with `user_confirmed: true`. Confirmation establishes the user's identification choice, not new botanical evidence. No synthetic confidence percentage.
- `POST /catalog`: `{location}`; return source-backed catalog entries suitable for manual identification selection, including native and non-native entries.
- `POST /score`: `{plants, location, additions?: [scientific_name], removals?: [scientific_name]}`. Result: `metric_version`, `native_count`, `non_native_count`, `invasive_count`, `verified_species_count`, `unresolved_count`, `observation_count`, `native_share` (number or null), `species`, `unresolved`, `summary`, `limitations`, and `projected` containing the same counts/share plus `added_species` and `removed_species`. Species identity, authoritative status, and confirmation determine inclusion. Display names, duplicate photos, provider availability and arbitrary bonuses do not change the result.
- `POST /recommend`: `{location, plants?: [], site?: {sun, moisture, space, maintenance}}`; result is a consistently shaped array with `plant_name`, `scientific_name`, `taxon_id`, `wildlife_support`, `why`, `source`, `source_url`, `verified_on`, `problem`, `action`, `impact`, `benefit`, suitability explanation, and site requirements. Site enums: sun full/part/shade/unknown; moisture dry/average/wet/unknown; space small/medium/large/unknown; maintenance low/moderate/unknown. Unknown site conditions must be disclosed; do not assume suitability. Every returned plant is a positively verified native. Avoid already-recorded species when recommending species diversity additions.
- `POST /letter`: `{plants, plant_names: [scientific_name], zip_code, site, site_name, survey_date, is_sample?: boolean, proposal: {location, quantity, budget, maintenance, student_name, school_name, principal_name}}`. Revalidate selections against the catalog; compute survey facts from observations; return a source-linked proposal without claims of measured biodiversity or guaranteed wildlife outcomes. An old numeric score must never be treated as evidence.

Frontend API exports: `identifyPlant(images, location, {signal}?)`, `confirmPlant(scientificName, location, {signal}?)`, `getCatalog(location, {signal}?)`, `getScore(plants, location, {additions, removals, signal}?)`, `getPlantRecommendations(location, {plants, site, signal}?)`, `generateLetter(payload, {signal}?)`. Use the shared client for bounded requests and readable failures.

## Evidence contract

Catalog entries retain `scientific_name`, `common_name`, `synonyms`, `why`. Add `taxon_id`, `source_url`, `why_source_url`, `verified_on`, `native`, `invasive`, `recommendable`, `sun` (array), `moisture` (array), `min_space` (small/medium/large), `maintenance` (low/moderate), `wildlife_support`, and optional management/suitability notes. Keep known nonnative taxa and important taxonomic exceptions in a separate sourced catalog. Do not infer native Florida status from L48 native status plus occurrence.

Status lookups retain existing `native`, `invasive`, `source`, `why` fields and add provenance/canonical identity. Known author suffixes may be normalized, but varieties, subspecies and hybrids must not be collapsed through a consequential status distinction. FISC category and known distribution zones are metadata, not regulations or proof that a plant is safe outside a zone.

## Acceptance checks

- Name casing, synonyms and duplicate observations leave species metrics unchanged. Unknown-only audits produce no ecological rating. Selected projections match a recalculation of the same changed inventory.
- Representative native, invasive and nonnative plants remain correctly classified offline. Glabra firebush, exempt ficus, tropical sage and national-native/local-introduced cases do not receive false labels.
- Recommendations contain no imaginary, malformed, invasive or unsupported native entries; promoted/filtered cards remain complete; site filters and inventory alter the plan.
- Provider failures cannot turn missing data into medium wildlife value or nonnative status. Confirmation changes the selected taxon and refreshes its evidence.
- Refresh/restart preserves observations, site information and edited proposals. Sample data stays labeled. Reset, invalid input, low-confidence decisions and retries work on web.
- Invalid bodies/images return JSON errors before providers run. Remote URLs and oversized requests are rejected. Requests have bounded deadlines; rate limits protect paid routes.
- The app exports for web and native bundles. Automated tests do not call paid services. Browser checks cover primary controls, keyboard semantics and sample survey-to-report flow.

## Work requiring the team

Physical campus survey and independent plant labels; target-user participation; teacher/facilities review and permission; real planting/survival/wildlife outcomes; authentic personal motivation and learning; team narration/video and final competition submission; camera/permissions on actual iOS/Android devices; deployment account selection and credentials. Prepare templates and checklists, never fabricate those results.

## Implementation verification — October 17, 2026

- 379 backend tests passed with no live provider calls, including a fresh virtual environment install with no broken requirements.
- 29 frontend regression tests passed, including persistence, sample isolation, cancellation, upload bounds, malformed metadata, and canonical synonym lookup.
- Expo dependency alignment passed. Web, iOS and Android exports passed; these are bundle checks, not physical-device tests.
- Architecture sync/check passed with 92 nodes and 149 connections; diff whitespace checks passed.
- Chrome extension testing exercised the configured local backend: sample observations → 66.7% native share → select frogfruit → recalculated 75% → factual sample proposal → edit → reload/reopen → retained edit and selection → downloaded report. Confirmed separate empty real audit, synonym selection (Zamia floridana → Zamia integrifolia), positive native classification, saved observation, and reset confirmation using disposable QA data.
- Separate browser checks covered two-photo upload/normalization, max-five enforcement, missing-photo/invalid-ZIP messages, service configuration errors, and accessible site radios.
- Independently reviewed request validation and frontend integration; fixed discovered image-metadata type mismatch, real/sample transition leak, oversized numeric input error, and synonym-search omission.
- Known plants remain classified from 209 sourced taxon records (22 native, 179 invasive, 8 other nonnative). The native catalog supplies 19 conditional planting options. Every FISC name/category/distribution tuple was compared against the official PDF; its hash and check date are stored.
- Applied compatible npm dependency patches, removing the reported critical advisory. Remaining report: 36 advisories (23 high, 13 moderate), chiefly Expo/React Native build dependencies; do not claim the dependency tree is vulnerability-free.

Still unverified: live provider accuracy on independently labeled field photos, physical-device cameras/permissions, real drag-and-drop gestures, hosted-network availability/load, actual student pilots, school approval and ecological outcomes. GitHub Actions is configured but has not run remotely before branch publication. Native exports do not constitute signed app-store builds. The API supports explicit removal scenarios; this iteration's proposal UI selects additions and asks staff to review invasive management separately.
