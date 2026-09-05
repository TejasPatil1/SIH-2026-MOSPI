# PEWS — Judge-Impact Audit and Implementation Brief

**Basis.** Read from `PEWS_FRONTEND_DOCUMENTATION.md` (571 lines, §1–5). Every finding
cites the documented behaviour it comes from. Sections §6 (Project detail), §10 (Evidence)
and §11 (Time Machine) are referenced by the document but not present in it, so those three
screens are audited only where §1–5 describes them from the outside.

**Status.** This is a specification, not a diff. The `web/` source tree was not available,
so nothing has been edited. Each item below is written to be implemented directly against
the file paths the documentation names.

---

## Verdict first

The prototype's core problem is not visual quality. The design system is genuinely good and
should be defended: warm neutral ground rather than the default slate, no decorative glow,
tabular numerals everywhere, risk colour never carrying meaning alone, a single glossary
behind a single control, `prefers-reduced-motion` honoured globally. That restraint is worth
more to a judge than any amount of added polish, because it is the thing that makes the app
read as an instrument rather than a student dashboard.

The problem is that **the product's best idea is the hardest thing in the app to reach.**

PEWS's claim is lead time — the gap between the model crossing its alert threshold and the
first official revision appearing in the record. The documentation confirms this is rendered
as a 44px accent number, the largest type size actually used anywhere in the application.
It sits inside the Time Machine, on one project, at `/project/:id/replay` — behind a landing
page, a table, a detail screen, and a sub-route.

Meanwhile the landing screen's 34px hero metric is **Revised portfolio value**: a fact about
how big the portfolio is, not about what PEWS does. A judge who spends ninety seconds in the
app and never opens the replay will leave believing PEWS is a risk-scoring dashboard. Every
P0 below exists to close that gap.

---

## P0 — fix before the next demo

### P0-1 · Lead time is the product; put it on the landing screen

**Change.** Add a single claim band above the existing three-column headline panel on
Portfolio (`web/src/pages/Portfolio.tsx`): one sentence of plain language, the median
lead-time figure beside it, and one action that jumps straight to the hero project's replay.

Not a new page, not a marketing hero — one row, roughly 96px, reusing `Panel` and the
existing `Metric` component at `size="lg"`.

Draft copy, to be adjusted to whatever the registry actually reports:

> Across the replayed portfolio, PEWS crossed its alert threshold a median of **N months**
> before the first official cost or date revision was filed.
> `[ Replay the case → ]`

The number must come from the same lead-time distribution the Evidence page already reads
out of the model registry. If that value is not exposed on the portfolio endpoint, surface it
rather than hard-coding it — a hard-coded headline number is exactly the thing a technical
judge will ask about.

**Why it matters.** It converts the landing screen from "here is a portfolio" to "here is a
claim, and here is where to check it." It also gives the demo a cold open that survives a
judge who never clicks the tour launcher.

**Judge impact.** High. This is the difference between remembering PEWS as *the one that saw
it coming months early* and remembering it as *another risk dashboard*.

**Risk.** Low. Additive layout, existing components, existing data. The only real risk is
overclaiming, which is controlled entirely by the wording — keep "median", keep "replayed",
keep it a measured statement.

---

### P0-2 · Separate what already happened from what is predicted

**Change.** The Watchlist table (`web/src/pages/Watchlist.tsx`) currently interleaves
lagging and leading indicators in one flat header row: Progress, **Risk**, **Overrun**,
**Delay**, **Exposure**, Alerts.

Overrun and delay are recorded history — the existing monitoring cycle already knows them.
Risk score and exposure are the model's forward-looking output. Presenting them as peer
columns quietly undercuts the entire early-warning claim, because a judge reading left to
right sees a table of projects that are *already* late and over budget and reasonably
concludes the model is describing the present.

Add a grouped header row above the existing one, spanning the relevant columns:

```
|  #  | Project | Sector | Sanctioned |   Already recorded    |      PEWS predicts      | Alerts |
|     |         |        |            | Progress Overrun Delay | Risk  Driver  Exposure |        |
```

Style the group row with the existing `2xs` uppercase `raised` treatment already used by
`.tbl` headers, and separate the two groups with a single `line` vertical rule. No new
colour, no new component.

**Why it matters.** It makes the leading/lagging distinction structural instead of verbal.
Your brief asked for a clearer split between risk and exposure; this is the more damaging
confusion and it costs one header row to fix.

**Judge impact.** High, and it pays off silently — the judge never has to be told.

**Risk.** Low. `colSpan` on a second `<thead>` row; `.tbl-sticky` must be verified to pin
both rows.

---

### P0-3 · Say why each project is on the list

**Change.** Add a **Top driver** column to the Watchlist, between Risk and Exposure, showing
the single highest-contributing feature in plain language — "Expenditure outrunning progress",
"Stalled 7 months", "Revision history" — with the `Info` control routing to the existing
`feature contribution` glossary entry.

The data exists: the documentation confirms per-project SHAP contributions drive the Project
detail explanation, and portfolio-level `drivers[]` already render on Portfolio. This is a
projection of data the app already has, not a new capability.

**Why it matters.** A ranked list with no reasons is a scoreboard. A ranked list where every
row states its own cause is a work queue. It also front-loads explainability: the judge meets
the "why" before they ask for it, which changes the tone of the whole review.

**Judge impact.** High. This is the cheapest credibility gain available in the app.

**Risk.** Low–medium. Needs a stable plain-language label map for feature names; do not print
raw feature identifiers. If the top-1 SHAP value is not already on the watchlist payload,
this becomes a backend change and drops to P1.

---

### P0-4 · Reset scroll on navigation

**Change.** The documentation states plainly: *"Scroll position is neither restored nor reset
between routes."* The scrolling element is the nested `<main>`, not the window.

Add a scroll-reset effect in `App.tsx` keyed on `useLocation().pathname`, targeting the
`<main>` ref rather than `window.scrollTo`.

**Why it matters.** In a live demo the judge scrolls to rank 30 of the watchlist, clicks a
row, and lands halfway down Project detail with the header off-screen. It reads as a broken
build. This is the single highest embarrassment-per-line-of-code defect in the app.

**Judge impact.** Invisible when fixed, disproportionately damaging when not.

**Risk.** Very low. Consider preserving position for back-navigation only.

---

### P0-5 · The guided tour stops at the door of all three hero screens

**Change.** Re-cut `web/src/tour/steps.ts`.

The documented `data-tour` anchors are: `nav-watchlist`, `nav-upload`, `nav-evidence`,
`portfolio-bands`, `portfolio-sectors`, `watchlist-toggle`, `watchlist-table`. Three point at
sidebar links. Four point at Portfolio and Watchlist. **There is not one anchor on Project
detail, Time Machine, or Evidence content.** The tour teaches the navigation and then stops
exactly where the product's argument begins.

Replace with six steps following an investigation, not a floor plan:

| # | Step | Anchor | What the judge learns |
|---|---|---|---|
| 1 | Where risk sits | `portfolio-bands` | Exposure is concentrated, not spread |
| 2 | What to open first | `watchlist-table` | The queue is ranked and each row states its cause |
| 3 | The signal itself | divergence chart on Project detail | Spend climbing while progress flattens |
| 4 | What the model expects | forecast card | Point estimate and probability are different facts |
| 5 | How early we knew | lead-time figure in Time Machine | The threshold crossing precedes the official revision |
| 6 | Why believe it | one Evidence panel — baselines or leakage checks | The method was tested, not asserted |

Steps 3–6 require new `data-tour` attributes on Project detail, Time Machine and Evidence.
Keep the existing spotlight mechanic and the 460ms `cubic-bezier(0.32,0.72,0,1)` transition —
those are already good. Raise tour body copy from `text-base` to `text-md` (15/22); titles are
already `text-lg`. Six steps, one sentence each, always skippable.

**Why it matters.** A tutorial that ends before the argument starts is worse than no tutorial,
because it consumes the judge's patience and spends it on the sidebar.

**Judge impact.** High.

**Risk.** Medium — the tour must now drive routing between four pages. The overlay's target
tracking already copes with the nested scroller, which is the hard part. Handle the case where
a tour step's target has not mounted yet.

---

### P0-6 · Make the scoring progress bar honest

**Change.** `ScoringProgress` on the Upload page animates a determinate bar from 4% to 100%
over a fixed 1.4s, with four phase labels fading in at 0.32s intervals — independent of the
actual `useScoreRun()` request.

Bind it to real state: indeterminate while pending, complete on resolve, and only advance a
phase label when there is something real to advance on. If the request finishes in 200ms, let
it finish in 200ms and print the true duration, which the right rail already does.

**Why it matters.** "Honesty as a design element" is this product's stated principle, and the
app is otherwise unusually disciplined about it — the prototype-data chip, the data-quality
chip, the explicit "retrospective replay, not a live prediction" copy. A theatrical progress
bar is the one place the interface contradicts its own argument, and it is the kind of detail
a technical judge notices and then generalises from.

**Judge impact.** Medium, asymmetric — small gain if right, real loss if caught.

**Risk.** Low.

---

## P1 — high impact

### P1-1 · Qualify "Predicted exposure at risk" inline

The scariest number on the landing screen is rendered large, in `tone="critical"` red, with
its definition behind an `Info` click. A judge will read "₹X crore at risk" as "₹X crore will
be lost."

Put the arithmetic in the sub-label, in six words, always visible — for example *"revised cost,
weighted by failure probability"* — and keep the full glossary entry behind the `i`. This is
the one term in the app where progressive disclosure is the wrong default, because the
misreading is more alarming than the truth.

### P1-2 · Annotate the portfolio bar chart

Three bars — Sanctioned `#A9BBD4`, Revised `#1B3F73`, Spent `#7C8492` — proportional to
revised cost. The insight is the gap between bars one and two, and the reader is currently
left to compute it. Draw the delta: a thin bracket between the sanctioned and revised bar
ends with the overrun figure printed on it. Your brief's §17 test — *"what am I supposed to
notice?"* — currently has no answer on this chart.

### P1-3 · Route Project detail into Time Machine with a claim, not a link

From Portfolio and Watchlist there is no path to the replay at all; the only routes in are the
project-scoped sidebar entry and whatever Project detail offers (undocumented). Replace or
supplement any generic link with a statement carrying the project's own number:

> PEWS crossed its alert threshold **7 months** before this project's first official revision.
> `[ Replay the reconstruction → ]`

Navigation phrased as a finding gets clicked; navigation phrased as a menu item does not.

### P1-4 · Show the sector matrix's truncation

`SectorMatrix` is limited to 6 rows with no documented count or overflow affordance, which
makes a partial view look complete. Print "6 of N sectors" and a "View all →" action.

### P1-5 · Reduce the Assistant's blast radius

Eight intents, suggestions imported from the fixture module, and a fallback for anything
unrecognised. The right-rail "why this is not a chatbot" argument is good defensive design and
should stay. But in a judged demo the Assistant is the one surface that invites an
unconstrained question and can fail publicly.

Two changes: move it below Evidence in the sidebar order so Validate is encountered first, and
make the not-understood state lead with the clickable supported questions rather than a grey
intent chip — an empty result should be an invitation to act, not a report of failure. Do not
remove the feature; the visible query-provenance block is one of the most credible things in
the app.

### P1-6 · Make offline mode look deliberate

`useHealth()` polls every 30s and flips the header to amber with "Scoring service offline" on
error. If the demo runs on fixtures or the laptop drops off the network, the header turns
amber mid-pitch and the judge reads it as a broken system. Add an explicit offline-fixture
state that presents as a neutral, intentional condition alongside the existing "Prototype
data" chip, and reserve amber for genuine degradation.

### P1-7 · Add a real not-found state

`<Route path="*">` silently replaces to Portfolio. A stale or mistyped URL teleports the judge
with no explanation. A small panel — what happened, and two links — costs almost nothing.

---

## P2 — only if time is free

- Larger hit targets on band-distribution legend entries; they are navigation, not decoration.
- Restore scroll position on back-navigation once P0-4 lands.
- The `5xl` (58px) type token is declared but unused. Either use it for the lead-time figure
  or delete it from `tailwind.config.js`.

---

## Two recommendations against the brief

**Do not add multicolour glowing borders.** Your §19 invites them. I would decline. This
product's credibility comes from looking like an instrument a ministry analyst would be issued,
and the documented system — no decorative glow, hairline dividers, emphasis by size and colour
rather than card chrome — is already achieving that. Glow would move PEWS toward the visual
register of every other hackathon submission, which is the opposite of memorable. Spend the
boldness in one place instead: the lead-time number. Let that be the thing that glows,
figuratively, and keep everything around it quiet.

**Verify the two introductory tutor moments actually exist.** Your brief §8 says they should
remain conceptually. The documentation describes no such screens — the only onboarding
surface documented is the floating tour launcher pinned bottom-right, which returns `null`
during the tour and otherwise shows "Guided tour" on hover. Either they were never built, or
the documentation predates them. Check before assuming they are there to preserve, because if
they are missing, P0-1 becomes the only thing standing between a cold judge and a rupee figure.

---

## What I could not audit

§6, §10 and §11 are the three screens your brief calls the hero, the credibility engine and
the signature feature, and none of them is in the uploaded document. From §1–5 I can see only
their outlines: the divergence chart with the shaded wedge, the forecast card that renders
point estimate and probability in deliberately different visual forms, the 44px lead-time
figure, and the Evidence page's baselines / ablation / calibration / lead-time distribution /
four leakage checks.

That outline is promising — the forecast card in particular sounds like it already solves the
prediction-versus-probability problem your §12 raises. But the questions that matter most
about those screens (Does the divergence chart annotate its own wedge? Is the prediction
interval legible to a non-technical reader? Does Evidence lead with limitations or bury them?
Does Time Machine make the threshold crossing and the official revision visually comparable on
one axis?) cannot be answered from what is here.

Send those sections, or the `web/src/pages/` tree, and this audit can be completed.
