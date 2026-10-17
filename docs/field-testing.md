# EcoLoco field and usability testing record

Use this record for a small, honest evaluation before the CAC submission. The proposed pilot is **20–30 independently labeled plant examples, 5–10 target users, and one school reviewer**. These are practical targets, not competition requirements or completed research. Leave unperformed work blank and retain failed cases.

## Record the tested release first

| Field | Value |
|---|---|
| Test dates and timezone | [Fill; America/New_York for the local pilot] |
| Frontend commit and any uncommitted changes | [Exact revision; describe changes if any] |
| Backend commit, catalog revision/verification date, and metric version | [Fill] |
| Public/test URL and environment | [Fill; never include API keys] |
| Device, OS, browser/app build, and network | [Fill for each platform] |
| Identification providers available; configuration/model names | [Fill; no credentials] |
| Survey area, date, and approximate extent | [Fill; do not publish sensitive location details] |
| Site/photography permission and publication limits | [Who approved what; retain private evidence separately] |
| Label reviewer, qualifications, and reference method | [Fill; botanical reference/expert independent of app output] |
| Known exclusions | [Fill before testing; e.g. outside supported area, no identifiable plant] |

Freeze the examples and expected labels before inspecting the app’s answers. Keep copies of the original observations so a later software change can be tested against the same cases. A corrected specimen label should retain the original label, reason for correction, and reviewer/date.

## Plant identification and classification

Use 20–30 **distinct plants**, ideally including familiar natives, nonnatives, invasives, and difficult lookalikes. Several photos of the same plant form one example; they are not independent successes. Include ordinary shadows, backgrounds, and young plants when representative. Record selected coverage rather than calling this a random or representative accuracy study.

For each example, take clear photos of the whole plant and useful details such as leaves, flowers, fruit, or bark. Obtain permission before entering or photographing a site. Avoid faces, student names, private addresses, and unnecessary GPS metadata in material shared publicly. Do not remove or disturb plants to complete the test; planting/removal decisions require site approval and an appropriate identification review.

Have a knowledgeable reviewer or reliable botanical reference establish the expected identity independently of the app. Use a Florida-specific source for the expected status. A PlantNet suggestion alone is not an independent reference label. Preserve varieties/subspecies where they affect the verdict. If the reviewer cannot determine a species, mark the reference unresolved and keep it out of species-accuracy calculations while retaining it as an uncertainty-handling test.

Copy this row for every example:

| Case / photo IDs | Expected taxon and Florida status | Independent reference / reviewer / date | App’s first taxon, candidates, score and status | Confirmation requested? | Final user-selected taxon and status | Correct / incorrect / unresolved; issue |
|---|---|---|---|---|---|---|
| P01 / [files] | [Species, native/nonnative/invasive] | [Source URL and review] | [Exact output] | [Yes/no] | [Output or no confirmation] | [Verdict and notes] |

Record the **first output before any confirmation**. Then separately test whether the review flow leads a user to the right result. Do not count a user-corrected result as an automatic-identification success.

| Required coverage | Why it matters | Cases / outcome |
|---|---|---|
| At least several well-supported local native species | Verify useful positive classification, including with an explanation-provider outage | [Fill] |
| Known invasive and known nonnative species | Ensure these labels are distinguished | [Fill] |
| Ambiguous/lookalike specimens | Check whether alternatives and unresolved states prevent false certainty | [Fill] |
| Firebush variety and ficus taxonomic exception, where valid reference examples exist | Check that normalization does not erase meaningful distinctions | [Fill; use labeled fixture tests if no independently labeled photograph exists] |
| A nationally native taxon without Florida-native evidence | Confirm that nationwide nativity plus Florida occurrence does not establish Florida nativity | [Fill] |
| Changed or disputed catalog entries, including tropical sage | Check that current source evidence and review dates are presented consistently | [Fill] |
| One nonplant or unidentifiable input | Check useful failure handling without fabricating a species | [Fill; not part of plant accuracy denominator] |

Report these metrics together so “unverified for everything” cannot look like a good result:

| Metric | Calculation | Result |
|---|---|---|
| First-output species accuracy | Correct first proposed species / independently species-labeled plant examples | [x/n] |
| Automatic decision coverage | Examples accepted without user confirmation / independently labeled plant examples | [x/n] |
| Accuracy among automatic decisions | Correct automatically accepted species / automatically accepted labeled examples | [x/n; undefined if no automatic decisions] |
| Florida-status accuracy on correct identifications | Correct sourced status / correctly identified examples with independent status labels | [x/n] |
| Verified status coverage | Examples with sourced, verified Florida status / correctly identified examples with independent status labels | [x/n] |
| End-to-end usable result | Correct final identity and status / independently labeled plant examples | [x/n; report user corrections separately] |
| Unresolved rate | Examples still unresolved after the prescribed workflow / all plant examples | [x/n; split provider failure, ambiguity, missing evidence] |
| Consequential errors | Wrong labels leading to an unsuitable recommendation or proposed removal | [Count, cases, corrective action] |
| Response time | Median and slowest recorded time, plus failed/time-out requests | [Actual measurements] |

Report all denominators and the small, selected sample limitation. A model score is not a measured accuracy percentage. Investigate wrong confident results and blanket unresolved results; improve the evidence/candidate flow rather than changing thresholds merely to improve a headline number. Re-run the frozen set after a fix and retain both versions’ results.

## Survey calculations and recovery

Run these checks with controlled fixtures as well as a real survey. A fixture test proves the rule works for that input, not that real photographs are identified accurately.

| Case | Expected behavior | Actual result / version / evidence |
|---|---|---|
| Change common-name capitalization or use a known scientific synonym | Same canonical species count and native share | [Fill] |
| Add a second photograph of the same species | Observation count can increase; unique species and native share stay unchanged | [Fill] |
| Four native of seven verified species; two unresolved observations | Display 4/7 (about 57%), plus two unresolved; no whole-campus rating | [Fill] |
| Add two distinct verified native species to that fixture | Projection becomes 6/9 (about 67%); rebuilding that inventory produces the same counts | [Fill] |
| Add an already represented species | No new species or percentage change | [Fill] |
| Only unresolved observations | No percentage or invented ecological rating; clear next step | [Fill] |
| Change sun/moisture/space or current inventory | Suggestions respond to supported constraints and disclose unknown site requirements | [Fill] |
| Refresh/restart after an audit and an edited proposal | Observations, site details, and exact draft edits are recoverable | [Fill] |
| Cancel/reset | Cancel preserves content; confirmed reset clears the intended audit | [Fill] |
| Invalid ZIP, unavailable provider, slow request, and disconnected network | Visible useful error/recovery; bounded loading; saved work preserved | [Fill] |
| Replace a photo while its identification is pending | Old response cannot become the new photo’s identification | [Fill] |
| Sample mode then a real survey | Sample remains labeled and does not silently merge into real evidence | [Fill] |
| iOS and Android camera/photo permissions | Allow, deny, cancel, and retry on actual devices; record what was not tested | [Fill] |

## Target-user tasks

Recruit 5–10 people who resemble the intended student audience. Explain the test and obtain the appropriate participation/recording permissions. Use participant codes in shared notes. Observe the first attempt without coaching; if help is needed, record it. Start timing when the task is given and stop at completion or abandonment.

Give each participant this goal: **“Survey these plants, identify anything needing review, choose a suitable addition for this site, and prepare a proposal someone at school could review.”** Provide the same plant examples and site facts. Then ask them to explain the metric, identify its unresolved items, find a source, recover their draft after refresh, and say what approval is still needed.

| Participant / device | Completed without help? | Time | Help/errors/blocker | Correctly explained fraction and uncertainty? | Suggested improvement |
|---|---|---|---|---|---|
| U01 / [device] | [Yes/no/partial] | [Measured] | [Observed] | [Their explanation] | [Fill] |

Report completion as `x/n`, show how many required help, and state precisely what counted as completion. Keep opinions separate from observed behavior. Use the most common demonstrated obstacle to choose the next repair.

| Observed issue and affected users | Change | Retest release and method | Actual result |
|---|---|---|---|
| [Issue; x/n] | [Change] | [Version; same/new users] | [Result; mention practice effects for repeat users] |

## School review and later outcomes

Ask one teacher, facilities representative, or environmental-club adviser to review the actual proposal. Record their role, date, permission to quote, and response. Ask whether the location, quantity, source evidence, costs, maintenance ownership, and approval process are sufficiently clear. A useful draft is not planting approval.

| Review item | Reviewer’s actual feedback | Required change / owner |
|---|---|---|
| Site and plant suitability | [Fill] | [Fill] |
| Quantity, budget, maintenance, and responsible person | [Fill] | [Fill] |
| Evidence and unresolved identifications | [Fill] | [Fill] |
| Permission needed and next decision | [Fill] | [Fill] |

If planting occurs later, keep these outcomes separate from app usability and projected species share:

| Outcome | Baseline / follow-up date | Method and denominator | Actual result |
|---|---|---|---|
| Plants installed and distinct species | [Dates] | Inventory; distinguish individuals from species | [Fill] |
| Area planted/maintained | [Dates] | Measured area and units | [Fill] |
| Plant survival | [Dates] | Living planted individuals / planted individuals checked | [Fill] |
| Wildlife observations | [Dates] | Same location, duration, time/weather notes, and identification method | [Fill; observations do not by themselves establish causation] |

NWF host-species figures describe documented relationships at their stated taxonomic and regional scope; they do not count wildlife at your site. Do not sum host counts across plants or multiply them by tree count, because host species overlap. Keep those source-based relationships separate from observed outcomes. See [NWF’s method](https://nativeplantfinder.nwf.org/about).

## Evidence packet

Keep a short versioned packet: this completed record, permitted test photos, independent labels and sources, raw first outputs, failures, regression results, one before/after usability change, the reviewed proposal, and known limitations. Redact participant contact details, private locations, and credentials. Do not publish photos, quotations, or school approval claims beyond the permission given. Link the exact tested release and distinguish automated tests, simulated failures, live-provider checks, and physical-device checks.
