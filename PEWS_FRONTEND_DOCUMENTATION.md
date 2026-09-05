# PEWS Frontend — Design & Implementation Reference

**Scope.** This document describes the frontend as it exists in `web/` at the time of
writing. It is descriptive only: nothing here proposes changes, and every behaviour
described was read out of the source. File paths are relative to the repository root.

**Source of truth.**

| Area | Path |
|---|---|
| App shell, routing, sidebar, header | `web/src/App.tsx` |
| Entry point / providers | `web/src/main.tsx` |
| Global stylesheet | `web/src/styles.css` |
| Design tokens | `web/tailwind.config.js` |
| Reusable UI primitives | `web/src/components/ui.tsx` |
| Help/glossary popover | `web/src/components/Info.tsx` |
| Glossary content | `web/src/lib/glossary.ts` |
| Charts and visualizations | `web/src/components/charts.tsx` |
| Formatting / colour maps | `web/src/lib/format.ts` |
| Pages | `web/src/pages/*.tsx` |
| Guided tour | `web/src/tour/{steps.ts,TourProvider.tsx,TourOverlay.tsx}` |
| API client / hooks / wire types | `web/src/api/{client.ts,hooks.ts,types.ts}` |
| Offline fixture provider | `web/src/api/mock.ts`, `web/src/mocks/*.json` |

---

## 1. Frontend Overview

### Product identity

PEWS — **Project Early Warning System**. The browser tab title is
`PEWS — Infrastructure Risk Intelligence` (`web/index.html`). The header wordmark reads
`PEWS · Project Early Warning System`, subtitled
`Ministry of Statistics & Programme Implementation · Infrastructure & Project Monitoring
Division`. The npm package is `paimana-pews-web`.

The product frames itself as risk intelligence over the central-sector infrastructure
portfolio monitored under **PAIMANA**, scored from the monthly **CUF** (Comprehensive
Updation Format) returns that agencies already file. The recurring claim across the UI:
*nothing new is asked of any agency; the signal is already in what is being filed.*

### Purpose of the interface

The interface exists to move an analyst along one narrative:

1. **Where is risk concentrated?** (Portfolio)
2. **What do I look at first this month?** (Watchlist)
3. **Why is this project dangerous, and how sure is the model?** (Project detail)
4. **Would we actually have known earlier?** (Time Machine)
5. **Is the method tested or asserted?** (Evidence)
6. **Does this fit the existing monthly cycle?** (Upload & rescore)
7. **Can I interrogate the data without writing a query?** (Assistant)

### Target user

A ministry monitoring analyst — the header status rail literally states
`IPMD analyst · read-only` — plus, secondarily, a technical reviewer evaluating whether
the model is credible. The interface serves both: plain-language framing on the surface,
technical terminology reachable one click deep through the `Info` popover.

### UX philosophy as implemented

- **Density with hierarchy.** Base font is 13.5px, table rows are ~30px, numbers are
  tabular. Emphasis comes from size and colour, not from card chrome.
- **Explain, never assert.** Every technical term routes through one glossary
  (`web/src/lib/glossary.ts`) surfaced by one control (the `i` button).
- **Money and probability are separate facts.** The watchlist can rank by either; the
  forecast card renders the point estimate and the probability in deliberately different
  visual forms so they cannot be confused.
- **Honesty as a design element.** A permanent `Prototype data` provenance statement, a
  `data_quality` chip on thin projects, explicit "retrospective replay, not a live
  prediction" copy, and a Limitations panel on the Evidence page.
- **Colour never carries meaning alone.** `RiskBadge` always prints the band label
  beside its dot.

### Application structure

Single-page React app. Fixed 52px header, a collapsible left sidebar, and one scrolling
`<main>` that holds the routed page. Seven routes plus a catch-all redirect. A floating
guided-tour launcher is pinned bottom-right on every screen.

### How the frontend communicates the PEWS concept

The "early warning" claim is carried by three specific pieces of UI:

1. **The divergence chart** on Project detail — expenditure climbing while physical
   progress flattens, with the wedge between the two lines shaded. Presented as
   "the signal itself".
2. **The Time Machine** — the model re-scored at every historical month with later data
   masked, producing a *lead time*: months between the model crossing its alert threshold
   and the first official revision appearing in the record.
3. **The Evidence page** — baselines, ablation, calibration, lead-time distribution, and
   four build-breaking leakage checks, all read from the model registry.

---

## 2. Visual Design System

Tailwind CSS with a custom theme (`web/tailwind.config.js`), plus a component layer in
`web/src/styles.css`.

### Theme

Light only — `:root { color-scheme: light }`. There is no dark mode and no theme toggle.

### Colour tokens

| Token | Hex | Role |
|---|---|---|
| `ground` | `#F7F6F3` | Page background (warm neutral, deliberately not slate) |
| `surface` | `#FFFFFF` | Panels, cards, header |
| `raised` | `#FCFBF9` | Table headers, inset blocks |
| `line` | `#E4E2DC` | Default border |
| `line-strong` | `#D3D0C8` | Hover border, popover border |
| `line-faint` | `#EDEBE6` | Internal dividers, chart grid |
| `ink` | `#15181D` | Primary text |
| `ink-2` | `#495260` | Secondary text |
| `ink-3` | `#7C8492` | Labels, captions, axis text |
| `ink-4` | `#A5ABB5` | Quietest text, empty markers |
| `accent` | `#1B3F73` | Institutional navy — primary actions, model line |
| `accent-hover` | `#16345F` | Primary button hover |
| `accent-soft` | `#EEF2F8` | Active nav, selected row, highlight fills |
| `accent-line` | `#C8D5E8` | Borders on accent-tinted surfaces |

### Risk colours

Defined twice — as foreground `risk.*` and as tinted background `riskbg.*` — and mirrored
in `BAND` in `web/src/lib/format.ts` so charts (which need raw hex) and components (which
need Tailwind classes) never drift.

| Band | Foreground | Background | Label |
|---|---|---|---|
| CRITICAL | `#DC2626` | `#FCEEEE` | Critical |
| HIGH | `#EA580C` | `#FDF1EA` | High |
| WATCH | `#CA8A04` | `#FBF5E6` | Watch |
| LOW | `#16A34A` | `#EDF7F0` | Low |

Alert severities (`SEVERITY`) use a separate three-value map: HIGH `#DC2626`,
MEDIUM `#CA8A04`, LOW `#7C8492`.

### Typography

Inter Variable (`@fontsource-variable/inter`), with a custom size ramp:

| Class | Size / line-height | Typical use |
|---|---|---|
| `2xs` | 10.5 / 14, `0.06em` tracking | Eyebrows, chips, captions |
| `xs` | 11.5 / 16 | Fine print |
| `sm` | 12.5 / 18 | Buttons, dense body |
| `base` | 13.5 / 20 | Body default |
| `md` | 15 / 22 | Small metric values |
| `lg` | 17 / 24 | Tour titles |
| `xl` | 21 / 28 | Page `h1`, medium metrics |
| `2xl` | 27 / 32 | Large metrics, forecast headline |
| `3xl` | 34 / 38 | Hero metric, replay risk score |
| `4xl` | 44 / 46 | Lead-time number in the Time Machine finding |
| `5xl` | 58 / 58 | Declared in the theme; not used by any page |

Heading hierarchy: page `h1` at `text-xl` semibold with `-0.015em` tracking; section `h2`
at 13px semibold; sub-heads at 12.5px semibold. Labels use the `.eyebrow` class —
10.5px, uppercase, `0.09em` tracking, `ink-3`.

All numerals use `.num` / `table` / `input` / `time` selectors that enable
`font-variant-numeric: tabular-nums`, so figures never shimmer when they update.

### Icons

No icon library. Every glyph is an inline `<svg>` with a hand-written path string,
stroke-based at `strokeWidth` 1.6–2.4, coloured by `currentColor`. Nav icon paths live in
the `I` map in `App.tsx`; tour icon paths live in the `ICONS` map in `TourOverlay.tsx`.

### Buttons

| Class | Appearance |
|---|---|
| `.btn` | 32px tall, 12.5px semibold, 5px radius, 150ms transition, `disabled:opacity-45` |
| `.btn-primary` | Navy fill, white text, `active:scale-[0.985]` |
| `.btn-ghost` | White fill, `ink-2` text, border strengthens on hover |
| `.btn-quiet` | Transparent, tints to `line-faint` on hover |

### Tables

`.tbl` — 13px, collapsed borders. Headers are `2xs` uppercase on `raised` with a bottom
`line` border; `.n` right-aligns and forces tabular numerals. Body cells get a
`line-faint` bottom border, dropped on the last row. `.tbl-hover` adds an `accent-soft/60`
row hover, a pointer cursor, and reveals a `.row-arrow` chevron that slides in from
`-translate-x-1`. `.tbl-sticky` (named to avoid colliding with Tailwind's own `sticky`
utility) pins the header row.

### Chips, fields, spacing

`.chip` — 22px tall, `2xs` uppercase semibold, bordered. `.field` — 32px input/select,
with a data-URI chevron for selects. Radii: default 5px, `md` 6px, `lg` 8px. Shadows:
`shadow-panel` (1px hairline + faint ring) and `shadow-pop` (24px lift for popovers and
the tour card). Page padding is `px-5 pt-4 pb-16` inside a `max-w-[1600px]` column;
sections stack at `space-y-4`/`space-y-5`, panels pad at 16px.

Scrollbars are restyled globally: 9px, thumb `#cfcdc6` (`#b6b3aa` on hover), transparent
track, `scrollbar-width: thin`.

### Glow / motion

There are no decorative glows. Motion is limited to:

- `.fade-in` — 0.22s opacity + 3px rise, applied to page roots and revealed chart elements.
- `.sk` — skeleton shimmer sweep, 1.35s loop.
- `.draw` — an SVG dash-offset draw keyframe declared in CSS.
- Tour spotlight/frame/popover transitions at 460ms `cubic-bezier(0.32,0.72,0,1)`.
- A global `prefers-reduced-motion` block collapses all animation and transition durations
  to 0.01ms.

### How visual emphasis is used

- **Strongest emphasis** goes to money at portfolio scale (the 34px hero metric on
  Portfolio), the lead-time number in the Time Machine finding (44px accent), and the
  forecast headline (27px).
- **Critical risk** is communicated three ways at once: `risk-critical` red, a tinted
  `riskbg-critical` ground, and an explicit word ("Critical", "Above threshold"). On the
  trajectory chart the line itself repaints red above the alert threshold via a clip path.
- **Warnings** use amber (`risk-watch`): the data-quality chip, `ErrorCard` (styled amber,
  not red, because a failed fetch is a service condition rather than a risk finding), and
  the degraded status dot in the header.
- **Healthy/positive** states use `risk-low` green: accepted upload rows, passed leakage
  checks, negative SHAP contributions, band counts that fell after a rescore.
- **Secondary information is reduced** by dropping to `ink-3`/`ink-4` and to `2xs`, by
  using hairline `line-faint` dividers instead of boxes, and by hiding non-essential header
  items behind `md:`/`lg:` breakpoints.

---

## 3. Application Shell

`web/src/App.tsx` renders the whole shell. `web/src/main.tsx` wraps it in
`QueryClientProvider` → `BrowserRouter` → `TourProvider` → `App`, inside `StrictMode`.

```
<div class="h-full flex flex-col">
  <header 52px>   Wordmark .................... StatusRail
  <div flex-1 flex min-h-0>
     <Sidebar 52|178px>    <main overflow-y-auto>  <Routes/>  </main>
  </div>
  <TourLaunch/>            (fixed, bottom-right, z-50)
</div>
```

### Top header

Fixed 52px, `bg-surface`, bottom `line` border.

- **Wordmark** (left): a 3px navy vertical rule — explicitly *not* a logo tile — followed
  by `PEWS` in 15px bold, the expansion "Project Early Warning System" in 12.5px `ink-2`,
  and the ministry/division line in 11px `ink-3`. Truncates on narrow widths.
- **StatusRail** (right), three groups separated by 1px × 14px dividers:
  1. `Prototype data` with an `Info` button defining `synthetic_data`, `paimana`, `cuf`
     (hidden below the `md` breakpoint).
  2. A service dot + label driven by `useHealth()`. Green when healthy, and the label shows
     `model_version` (fixture value `pews-lgbm-v1.0.0`); amber when
     `isError || status === 'degraded' || models_loaded === false`, with the label
     `Scoring service offline` or `Serving cached scores`. Polls every 30s.
  3. `IPMD analyst · read-only` (hidden below `lg`).

### Main content area

`flex-1 min-w-0 overflow-y-auto`. This nested scroller — not the window — is what
scrolls; the tour's target tracking is written specifically to cope with that. Inner
wrapper is `px-5 pt-4 pb-16 max-w-[1600px]`; the bottom padding exists so the floating
tour launcher never sits on top of a page's last row.

### Page transitions

There is no route-transition system. Each page root carries `.fade-in`, so navigation
produces a 0.22s fade-and-rise of the new page. Scroll position is neither restored nor
reset between routes.

### Global controls

- **Collapse sidebar** — the rail's bottom button, or `Ctrl/Cmd-B` (bound in `App`).
- **Guided tour launcher** — `TourLaunch`, `fixed right-4 bottom-5 z-50`. A 40px navy
  disc that expands on hover to reveal `Guided tour`, or `Replay tour` once
  `useTour().seen` is true. It returns `null` while the tour is active.

---

## 4. Sidebar

Width animates between **52px collapsed** and **178px expanded**
(`transition-[width] duration-200 ease-out`). `aria-label="Sections"`.

### Groups and items

Groups are derived from the nav array, so ordering in code is ordering on screen.

| Group | Item | Route | Icon key | `data-tour` |
|---|---|---|---|---|
| Monitor | Portfolio | `/` | `portfolio` | — |
| Monitor | Watchlist | `/watchlist` | `watchlist` | `nav-watchlist` |
| Investigate | Project detail | `/project/:current` | `project` | — |
| Investigate | Time Machine | `/project/:current/replay` | `replay` | — |
| Operate | Upload & rescore | `/upload` | `upload` | `nav-upload` |
| Operate | Assistant | `/assistant` | `assistant` | — |
| Validate | Evidence | `/evidence` | `evidence` | `nav-evidence` |

### Project-scoped entries

`currentProject(pathname)` extracts the id from `/project/:id...`; when the user is not on
a project route it falls back to `HERO_PROJECT = 'PRJ-004217'`. So the two Investigate
entries follow whichever project the user last opened rather than teleporting to a fixed
demo project.

### Active state

`isActive` is computed explicitly rather than relying on `NavLink` matching:

- `/` matches only the exact path.
- `.../replay` matches any path ending in `/replay`.
- `/project/...` matches project paths that do **not** end in `/replay`.
- Everything else matches by prefix.

Active items get `data-active="true"` → `accent-soft` background, `accent` text, semibold
weight, and an accent-tinted icon.

### Hover state

`.nav-item:hover` → `line-faint` background, `ink` text; the icon lifts from `ink-4` to
`ink-2`.

### Collapsed behaviour and tooltips

Collapsed, items centre their icon (`justify-center px-0`) and the label is **not removed
from the DOM** — it becomes an absolutely positioned dark tooltip (`#15181D` ground,
11.5px, 4px radius, drop shadow) that appears to the right on `:hover`/`:focus-visible`
with a 130ms opacity + 3px slide. This preserves each item's accessible name. Group
headings cannot fit collapsed, so grouping degrades to a `border-t border-line-faint` rule
above each group after the first.

### Persistent state

Collapse state persists in `localStorage` under `pews.nav.collapsed` (`'1'`/`'0'`), read
lazily in `useCollapsed`, wrapped in try/catch so private-browsing mode simply loses the
preference. The toggle button carries `aria-expanded` and a state-dependent `aria-label`,
and its icon flips chevron direction.

---

## 5. Pages

### 5.1 Portfolio — `/` (`web/src/pages/Portfolio.tsx`)

**Purpose.** The landing screen: portfolio scale, money already lost, and where remaining
risk sits.

**User question.** *Where is risk concentrated across the monitored portfolio?*

**Layout.**

1. `Page` header — title `Infrastructure Risk Intelligence`, a lede containing the
   `cuf` term, and two filter selects in the actions slot.
2. A single headline panel split into three columns by a `divide-x` grid at ratios
   `1.12fr / 1fr / 1.4fr`.
3. A two-column row at `1.62fr / 1fr`: sector matrix left, global drivers right.
4. `ProvenanceNote` footer.

**Components.**

- Column 1 — hero `Metric` "Revised portfolio value" (`size="hero"`, split rupee value +
  unit), with a `projects · ministries · sectors` hint, then a three-row mini bar chart
  (Sanctioned `#A9BBD4`, Revised `#1B3F73`, Spent to date `#7C8492`) laid out on an
  `86px / 1fr / 84px` grid, each bar width proportional to revised cost.
- Column 2 — `Metric` "Cost overrun already incurred" (`size="lg"`) with the overrun
  percent and the phrase "recorded after the fact by the existing monitoring cycle";
  below a divider, a small "Expenditure to date" metric with percent-of-revised.
- Column 3 (`data-tour="portfolio-bands"`) — "Predicted exposure at risk"
  (`tone="critical"`, `Info` for `exposure_at_risk`/`probability`) and "Critical band"
  count side by side, above the `BandDistribution` stacked bar.
- `SectorMatrix` inside a `Panel` (`data-tour="portfolio-sectors"`), limited to 6 rows.
- `GlobalDrivers` inside a `Panel`.

**Data.** `usePortfolio({sector, ministry})` for the filtered view and a second
unfiltered `usePortfolio()` (cache-shared) purely so the dropdown option lists never
shrink when a filter is applied. Fields consumed: `kpis.*`, `bands[]`, `sectors[]`,
`ministries[]`, `drivers[]`.

**Interactions.**

- Ministry / Sector selects write to the URL query string via
  `setSearchParams(..., { replace: true })`. Ministry labels are shortened by stripping a
  leading `Ministry of ` / `Department of `.
- Any band segment or band legend entry navigates to
  `/watchlist?sector=…&ministry=…&band=…`.
- Any sector row navigates to the watchlist filtered by that sector; clicking a *segment*
  within the row's composition bar (`stopPropagation`) adds the band filter too.
- `Open watchlist →` in the section actions goes to an unfiltered watchlist.
- Four `Info` popovers: exposure/probability, risk band/score, "Reading this chart", and
  "How this is calculated" (SHAP/feature).

**Visual hierarchy.** (1) the 34px revised portfolio value; (2) the red exposure-at-risk
figure and the band distribution bar; (3) the sector matrix and driver bars.

**Terminology on the page.** CUF, exposure at risk, probability, risk band, risk score,
feature contribution (SHAP), sanctioned vs revised cost.

**Navigation out.** Watchlist (via bands, sectors, or the section action).

---

### 5.2 Watchlist — `/watchlist` (`web/src/pages/Watchlist.tsx`)

**Purpose.** The ranked work queue for the current monitoring cycle.

**User question.** *Which projects need attention this cycle — by probability, or by
rupees at stake?*

**Layout.** `Page` header (title `Analyst watchlist`, exposure toggle + Export CSV in the
actions slot) → a filter bar → a scrolling table inside a panel → a closing paragraph of
prose explaining the exposure re-ranking.

**Components.**

- `Toggle` "Weight by financial exposure", wrapped in `data-tour="watchlist-toggle"` with
  an `Info`. Its hint text changes between `Ranking by rupees at risk` and
  `Ranking by failure probability`.
- `Export CSV` button (`downloadCsv` from `lib/format.ts`, 14 columns, filename
  `pews-watchlist-{exposure|risk}-YYYY-MM-DD.csv`). Disabled when there are no rows.
- Three `Select`s (Ministry, Sector, Band) plus a conditional `Clear filters` button.
- `SegmentedControl` "Show" with 10 / 25 / 50 / 100.
- The table itself (`data-tour="watchlist-table"`), max height `calc(100vh - 252px)` with
  a sticky header.

**Columns.** `#` (rank) · Project (name + id, with `· stalled N mo` in `risk-high` when
`stalled_months > 0`) · Sector · Sanctioned · Progress (`ProgressBar`, width 48) · Risk
(`RiskBadge` with score, `size="sm"`) · Overrun (signed %) · Delay (mo) · Exposure
(rendered in `accent` when the exposure weighting is on) · Alerts (a 19px red counter
pill, or an em-dash) · a chevron column that fades in on row hover.

**Data.** `useWatchlist({ n, weight_by_exposure, sector, ministry, band })` plus
`usePortfolio()` for the filter option lists. `total_matched` and a page-level exposure sum
(`useMemo` over the rows) are printed in the section note.

**Interactions.** Every filter, the weighting toggle, and the row count live in the URL
query string, so a refresh restores the exact view. Clicking any row navigates to
`/project/:id`. While a new query is in flight the previous data is kept
(`placeholderData: (prev) => prev`) and the panel drops to `opacity-60`.

**Empty state.** When zero rows match, `EmptyState` lists the active filters and offers a
`Clear filters` primary button.

**Visual hierarchy.** (1) the table's risk badges and rank order; (2) exposure and overrun
figures; (3) the filter bar and the count note.

**Terminology.** Risk score, risk band, exposure at risk, stall, sanctioned cost.

**Navigation out.** Project detail (row click).

---

### 5.3 Project detail — `/project/:id`

Documented in full in §6.

### 5.4 Time Machine — `/project/:id/replay`

Documented in full in §11.

---

### 5.5 Upload & rescore — `/upload` (`web/src/pages/Upload.tsx`)

**Purpose.** Demonstrate that PEWS fits the existing monthly monitoring cycle.

**User question.** *What happens when next month's CUF export arrives?*

**Layout.** `Page` header (`Monthly upload and rescore`, lede containing the `cuf` term,
and a `Start over` button once anything has run) → a four-step rail → a `1fr / 320px`
two-column body.

**Stage machine.** `Stage = 'upload' | 'validate' | 'score' | 'review'`, derived as
`result ? 'review' : score.isPending ? 'score' : validation ? 'validate' : 'upload'`.

**Step rail.** Four equal cells — Upload / Validate / Rescore / Review, each with a
caption. State per cell is `done` (green filled circle with a check), `active` (navy
circle, `accent-soft` cell background) or `todo` (grey circle, `ink-3` text).

**Left column contents by stage.**

1. **Drop zone** (before validation) — a dashed panel with a 28px upload glyph. Drag-over
   turns the border `accent` and the fill `accent-soft`. Copy: "Drop the monthly CUF
   export … CSV to the PAIMANA snapshot schema — one row per project per monitoring month.
   Maximum 10 MB." Two entry points: `Choose file` (hidden
   `<input type="file" accept=".csv">` inside a label styled as a ghost button) and
   `Use sample next-month file` (primary button → `api.uploadSample()`).
2. **Validation report** — a four-cell strip (Rows read / Accepted, green / Rejected, red
   when non-zero / Snapshot month) plus an issues table (Row · Project · Field · Reason for
   rejection). Below it, the note "Rejected rows are excluded from scoring; their previous
   filing is retained" and a `Run scoring` primary button.
3. **`ScoringProgress`** — a determinate 5px bar animated 4% → 100% over 1.4s via an inline
   `@keyframes score`, with four phase labels (Rebuilding features · Scoring every project ·
   Computing explanations · Evaluating rule checks) fading in at 0.32s intervals.
4. **Band transitions table** — Project · Sector · From (`RiskBadge`) · To (`RiskBadge`) ·
   Risk change (`before → after`, red if worse, green if better) · Exposure. Rows click
   through to the project. An `Open refreshed watchlist →` action sits in the section
   header. If nothing moved band, a single centred line says so.

**Right rail.** Before a run: a "What this step does" panel listing Schema validation,
Continuity checks, Feature rebuild, Batch scoring. After a run: a highlighted accent panel
with the count of projects rescored and the duration in seconds, plus a "Band movement"
table showing `before → after` per band with a signed delta column, and a sentence counting
projects that entered and left the critical band.

**Data.** `useUpload()` (`File` → `POST /upload`, `null` → `POST /upload/sample`) and
`useScoreRun()` (`POST /score/run`), whose `onSuccess` invalidates the `portfolio` and
`watchlist` query keys so those pages reflect the rescore.

**Visual hierarchy.** (1) the step rail's active stage; (2) whichever card the stage
produced; (3) the right-rail explanation or summary.

**Navigation out.** Watchlist (after review), Project detail (transition row).

---

### 5.6 Assistant — `/assistant` (`web/src/pages/Assistant.tsx`)

**Purpose.** A deliberately narrow natural-language surface over the scored portfolio.

**User question.** *Can I ask the portfolio a question without writing a query — and trust
the answer?*

**Layout.** `Page` header (`Ask the portfolio`, with an `Info` titled "How this differs
from a chatbot") → a `1fr / 286px` grid.

**Left column.**

- A text input (`autoFocus`, placeholder "Ask about sectors, ministries, stalled projects,
  exposure or risk drivers…") and an `Ask` button, disabled while empty or pending.
- **Before the first question:** a suggestion panel listing four canned questions from
  `ASSISTANT_SUGGESTIONS`, each with a one-line description of what that query does, and a
  hover chevron.
- **After the first question:** the suggestions collapse into a row of pill buttons above
  the conversation.
- The question echoes as a navy chat bubble aligned right.
- While pending, three bouncing dots animated by an inline `@keyframes bounce`.
- The answer `Panel` contains: an intent chip (`accent` styling when understood, grey when
  not) with the raw intent code beside it; the answer prose at 13.5px; a metrics strip;
  and — always visible, never behind a disclosure — a **"How this was answered"** block
  showing applied filters as small monospace pills and the query itself in a dark `<pre>`.
- When not understood, the fallback lists the supported questions as clickable buttons.
- `Matching projects` renders result chips (name, `id · sector`, `RiskBadge`) that navigate
  to the project.

**Right rail.** A "Why this is not a chatbot" panel arguing the generative-model failure
mode, then a list of the eight answerable intents with their codes: `TOP_RISK`,
`SECTOR_SUMMARY`, `MINISTRY_SUMMARY`, `STALLED_PROJECTS`, `PROJECT_LOOKUP`,
`DRIVER_QUERY`, `COMPARE_SECTORS`, `COUNT_QUERY`.

**Data.** `useAssistant()` → `POST /assistant`. The suggestion list is imported from
`web/src/api/mock.ts` (`ASSISTANT_SUGGESTIONS`), i.e. from the fixture module rather than
from an API response.

**Visual hierarchy.** (1) the answer prose and metrics; (2) the query provenance block;
(3) matching project chips and the right-rail rationale.

---

### 5.7 Evidence — `/evidence`

Documented in full in §10.

### 5.8 Catch-all

`<Route path="*" element={<Navigate to="/" replace />} />` — any unknown path silently
replaces to Portfolio. There is no 404 page. A *known* route with an unknown project id
does produce a dedicated empty state (see §6).
