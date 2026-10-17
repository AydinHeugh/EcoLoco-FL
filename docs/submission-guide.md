# EcoLoco submission working guide

Prepared October 17, 2026 for the FL-22 entry. This is a working draft, not a submitted application. No field-study results, personal motivations, or student learning are supplied here. Replace brackets with facts the team can substantiate and check each feature against the release used in the video.

## Position the app around one completed task

**Purpose draft:** “EcoLoco helps South Florida students survey campus plants, review their Florida status using cited sources, and prepare a site-specific native-plant proposal for their school.”

The strongest demonstration follows one survey through to an editable proposal. Identification alone is only the first step. Show the difference between identifying a photographed plant, checking the named species in a source, and deciding whether it fits a planting site.

Use **native share of verified species scanned**, not a campus biodiversity score. It describes the surveyed species mix, not abundance, campus coverage, or measured wildlife benefit. Show unresolved observations beside the metric. Explain a projection as a recalculation of selected species additions/removals, not a prediction that wildlife will arrive.

## Application response drafts

These paragraphs describe the intended release. Before copying them, complete the demonstration checklist below and remove anything the recorded build cannot do. Follow the live application’s word limits.

| Field | Ready-to-adapt text |
|---|---|
| Purpose and audience | EcoLoco helps students turn a campus plant survey into a practical proposal for their school. Students photograph plants, review identification alternatives and cited Florida status, record the site’s conditions, and select suitable native additions. The audit shows the share of verified species that are native alongside unresolved observations. An editable proposal brings the survey facts, plant choices, sources, maintenance plan, and budget together for school review. |
| Inspiration | At [actual place and time], we noticed [specific observation]. We wanted to help [actual intended users] with [specific difficulty]. [A real conversation, observation, or earlier project] led us to focus on the step between identifying a plant and making a school planting proposal. **The team must supply this account; do not invent an encounter or interview.** |
| Technical challenge | A reliable plant survey requires separate decisions: what species appears in a photo, whether that taxon is native to Florida, and what the audit can legitimately measure. The earlier scoring method changed with display names and repeated observations. The revised approach uses canonical species identities, independently sourced status, and a transparent native-species fraction. Duplicate photos do not add species. Unresolved identifications stay visible, and proposed additions are recalculated with the same rules. [Add a regression test you personally understand and its actual result.] |
| Implementation | The interface uses JavaScript and React Native with Expo; a Python Flask server handles identification, source lookup, survey calculations, and proposal creation. PlantNet provides identification candidates, with an additional image-model path when needed. Florida status and planting eligibility are checked separately against cited data. [Explain one component you worked on, the decision you made, and how you tested it.] |
| Evidence of usefulness | On [date], [n] students attempted [defined task] without coaching. [x/n] completed it, with [measured time or recurring difficulty]. After [specific change], [actual retest result]. [Role of school reviewer] reviewed [proposal] and said [accurate paraphrase with permission]. **Omit this paragraph until these activities occur; sample audits and automated tests are not pilot evidence.** |
| Learning | I learned [specific lesson] when [actual difficulty]. I initially expected [your real expectation], but [evidence] changed my approach. I changed [specific implementation or process] and checked it by [method]. **Each student should write and be able to explain their own account.** |
| Next version | We would add repeated surveys and planting follow-ups so students can track plant survival, maintained area, and consistently collected wildlife observations. We would expand the verified regional catalog through source review and field validation. These are future features, not results demonstrated by the current audit. |

Describe the earlier EcoLoco version and this entry’s changes separately. Fill the application’s external-tool and third-party-credit fields accurately; distinguish services the app calls from tools used during development. Credit data, libraries, images, and PlantNet as applicable. Do not claim a student contribution or authorship history that the team cannot support.

| Teammate | Specific contribution and relevant files | Decision they can explain | Test or demonstration they can reproduce |
|---|---|---|---|
| [Name] | [Actual work] | [Decision] | [Evidence] |
| [Name] | [Actual work] | [Decision] | [Evidence] |
| [Name] | [Actual work] | [Decision] | [Evidence] |

## A 2:50 demonstration

Record the frozen release. Keep the cursor and text readable. If a clip is shortened or uses prepared data, label it. Use a real survey if available; otherwise keep **Sample audit — demonstration data** visible and say so aloud. Do not stage sample data as a school result.

| Time | Screen action | Narration guide |
|---|---|---|
| 0:00–0:20 | Team names, app title, and a permitted campus image; open the audit entry point. | “We are [names]. EcoLoco helps South Florida students turn a campus plant survey into a source-backed planting proposal.” Give one real example of the user problem. |
| 0:20–0:45 | Photograph/upload a plant; show the species, alternatives, confirmation state, and source. | “Identification suggests a species. The source check answers a different question: what is known about that species in Florida?” Do not describe a model’s score as a guaranteed probability of correctness. |
| 0:45–1:05 | Open the survey summary; show verified species and unresolved observations. | Explain the displayed numerator and denominator. “Repeated photographs do not increase the species count. This describes our sample, not the whole campus.” |
| 1:05–1:25 | Set real site conditions; select an appropriate new species and show the changed projection. | Explain why this choice fits the site. Identify the projection as species arithmetic, not a measured ecological improvement. |
| 1:25–1:45 | Open and edit the proposal; show sources, budget, maintenance, and saved state. | “The proposal gives school staff the survey evidence and practical details they need to review it.” Do not imply approval has already been granted. |
| 1:45–2:10 | Show a brief architecture view and one meaningful test; demonstrate a recoverable error or an uncertain observation. | Explain the concrete coding challenge, the implemented solution, and the relevant JavaScript/Python, Expo/Flask, and identification services. Name the actual behavior preserved during a failure. |
| 2:10–2:30 | Show a small, legible table of actual field/user-test results, or a clearly labeled test plan if no pilot exists. | State real counts and limitations. If there is no pilot: “The working flow is demonstrated here; campus and user validation are our next step.” |
| 2:30–2:50 | Return to the completed proposal and team. | Each speaker gives an authentic contribution or learning point. Close with the specific next step, such as a school review, without claiming future outcomes. |

## Demonstration and claim check

Use [field-testing.md](field-testing.md) to record the evidence. A passing unit test does not establish live plant-identification accuracy or device-camera behavior.

| Claim or action | Evidence needed before recording | Release status / evidence link |
|---|---|---|
| A native, a nonnative, and an invasive plant receive meaningful classifications | Independently labeled real examples; status sources inspected | [Fill] |
| Ambiguous identification can be reviewed | Alternatives/confirmation and source refresh demonstrated | [Fill] |
| Species fraction and selected projection are correct | Duplicate/synonym and changed-inventory regression checks | [Fill] |
| Recommendations fit inventory and site | Different site conditions or inventories visibly change choices | [Fill] |
| Audit and edited proposal survive restart | Refresh/restart the target device and recover the same content | [Fill] |
| A recoverable failure preserves work | Timeout/outage exercise with a visible retry path | [Fill] |
| Public demo works for a judge | Signed-out test on another device/network; no local-only server dependency | [Fill] |
| Student understanding is demonstrable | Each teammate explains a component, a limitation, and one test | [Fill] |

## Submission logistics

Official information checked October 17, 2026:

- The [2026 rules](https://www.congressionalappchallenge.us/wp-content/uploads/2026/05/2026-CAC-Rules.pdf) require a 1–3 minute demonstration with participants, purpose, audience, tools/languages, and working functionality; the video must be public on YouTube or Vimeo. Judges can request app/source access. Districts control judging; no FL-22 weighting is established here.
- The rules list October 26 at **noon EDT**, but the [registration page](https://www.congressionalappchallenge.us/students/student-registration/) lists **9 p.m. ET**. Target **October 24**, leaving time to resolve access or application problems.
- Check eligibility for every teammate: the rules permit up to four students, with at least half living or attending school in the entered district. For an earlier app’s new version, highlight the new eligible work. Complete the required disclosures accurately. [Official rules](https://www.congressionalappchallenge.us/wp-content/uploads/2026/05/2026-CAC-Rules.pdf)

| Target | Team action | Owner / done |
|---|---|---|
| October 21 | Freeze features; record the version; complete survey and independent label review | [Fill] |
| October 21–22 | Run target-user tasks and school review; repair demonstrated blockers | [Fill] |
| October 23 | Record the video; finalize truthful answers and third-party credits | [Fill] |
| October 24 | Submit; test public links signed out; retain confirmation and exact release/video links | [Fill] |

The team must conduct the real survey, obtain site/photography and school-review permission, recruit participants, supply personal accounts, record narration, verify eligibility, and submit. Real planting and wildlife outcomes require later observation. This guide does not contact people, publish the app/video, or submit the entry.
