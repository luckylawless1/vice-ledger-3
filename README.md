# VICE LEDGER 3 — GTA VI Trophy Guide & Platinum Tracker

[![make.fun · gta6-trophy-guide-01](https://make.fun/badge/gta6-trophy-guide-01.svg)](https://make.fun/bounty/gta6-trophy-guide-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)
[![rank](https://make.fun/badge/gta6-trophy-guide-01/luckylawless1/vice-ledger-3/rank.svg)](https://make.fun/bounty/gta6-trophy-guide-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)
[![reward](https://make.fun/badge/gta6-trophy-guide-01/luckylawless1/vice-ledger-3/reward.svg)](https://make.fun/bounty/gta6-trophy-guide-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)

An offline guide and tracker for all **55 PlayStation 5 trophies of Grand Theft Auto VI** — 1 platinum, 2 gold, 6 silver, 46 bronze, 28 of them hidden until earned. Every trophy carries its official name, description and grade exactly as PlayStation publishes them, plus a guide written for this entry in numbered steps, **every step cited by number** to one of 8 published sources (PowerPyx, PSNProfiles, Exophase, PlayStationTrophies.org, TrueTrophies, GTABase, KeenGamer, OutputLag — read 20 Nov 2026).

VICE LEDGER 3 is the third edition of VICE LEDGER: the same evidence standard, re-benchmarked against the current leaderboard's top 10, with richer per-step guidance where the sources support it — ordered routes, step-level time estimates and step-level failure warnings — and **two views neither the earlier editions nor any top-10 sheet has**: a **100% Completion Planner** and a **Tonight's Session** route builder.

## What it does

- **Checklist + guide pane + source rail.** Tick trophies off in the list; the selected trophy's guide opens beside it with its official description, time and difficulty ratings, numbered cited steps — some carrying a route note, a step estimate or a failure warning, each cited like everything else — and a right-hand rail showing exactly which sources back that guide and how widely each is used.
- **Evidence audit strip.** Every headline number — 55 official trophies, cited steps, missable / watch / unknown-trigger counts, step failure warnings, routed trophies — is recomputed from the data at runtime, never hard-coded.
- **Missable & watch flags everywhere.** 5 missable and 4 watch trophies are flagged in the list, in the guide pane, in a warning banner, and in a dedicated Missables view. The one Chapter 1 trap (Lucia's balcony meditation) is called out with the save to keep.
- **Sources disagree — both versions shown.** Where the guides conflict (the balcony meditation's status; the 200 h vs 250 h platinum), both readings are printed with their sources. Where a trigger is genuinely unknown, the guide says OPEN instead of inventing one.
- **Roadmap.** A 7-stage route to the platinum with per-stage progress and per-stage hour budgets, mirrored in a stage strip above the tabs.
- **Next Up planner & route sort.** Remaining trophies in roadmap order with cumulative time-to-platinum, missables pulled forward in their stage; or sort the checklist by difficulty/time for an easiest-first route.
- **100% Completion Planner (new in v3).** The cited per-trophy time estimates become a plan: a per-roadmap-stage hour budget, a total hours-to-platinum figure, and a live projection that syncs with your checklist — earned trophies move their hours from "left" to "done", the remaining hours re-flow per stage, and the page shows hours done / hours left / your pace per trophy / a projected finish date at your chosen hours-per-week.
- **Tonight's Session (new in v3).** Tell it how long you have tonight and it builds one sitting's route: trophies in roadmap order with missables pulled forward, packed whole into your time budget from the planner's hour data, with a running total and an honest note of what was held back for a longer session. Earn something and tonight's route re-builds itself.
- **Per-trophy counters.** The 14 counted trophies (250 stunts, 18 meditations, $250,000 laundered…) carry a your-count tracker stored with your progress.
- **Spoiler shield.** Hides the names and descriptions of unearned story and hidden trophies until you earn them.
- **Filters & search.** Kind chips (including a Missable & watch chip), grade filter, live search across names, descriptions and guide text, hide-earned.
- **Journey log.** Earned trophies listed in the order you earned them, with dates.
- **Sources view & 55 × 8 Source Matrix.** Every source, what it backs, and per-trophy confidence flags: OK / 1 SRC / DIFFER / OPEN.
- **Platinum Forecast.** The header sums the time estimates of everything you have left, so the remaining run is always one glance away.
- **Progress that stays yours.** Saved in `localStorage`, with Export / Import / Reset as a JSON file. Personal per-trophy notes are stored the same way.
- **Platinum Card.** A summary card of your run — earned count, grade split, per-kind completion bars, next trophies on your route, estimated time left — rendered in the browser and downloadable as PNG or SVG. Nothing is uploaded; the card is drawn locally from your saved progress.

## Running it

The app is plain static files with no build step. Serve the `app/` folder with any static file server and open `index.html` — or, from the repository root:

```
node serve.ts        # then open http://localhost:8080
```

It works fully offline: the app loads nothing over the network at runtime. Source links in the guides open only when you follow them.

## Handing it in

`main.ts` (Node 22, standard library only) copies `app/` and `screenshots/` into the output directory and writes `dossier.json` with the vendored make.fun library:

```
MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Data & honesty notes

- `app/data/trophies.json` holds the official list and the guides. Official names/descriptions/grades are reproduced as published; all guide wording is original to this entry.
- Read date for all sources: **20 Nov 2026**. Estimates that differ between sources are shown as ranges or disputes, never silently merged.
- Extra per-step depth (routes, step estimates, failure warnings) is included only where a cited source supports it; trophies whose sources state no route or timing stay at standard depth rather than being padded.
- No Rockstar Games logo, artwork or game screenshots are used anywhere; the look is this entry's own.

## License

MIT — see `LICENSE`.
