# Math Practice

An installable, offline math practice app for elementary students, hosted on GitHub Pages.

- **Math facts:** + − × ÷ with configurable ranges (e.g. pick which times tables).
- **Multi-digit:** addition and subtraction with or without regrouping, multiplication up to 3×2 digits, long division with or without remainders.
- **Fractions:** equivalent fractions, simplifying, comparing, mixed numbers, adding/subtracting with like or unlike denominators, multiplying, fractions ↔ decimals.
- **Decimals:** comparing, adding/subtracting, multiplying, dividing.

## Round types

| Type | What it does |
|---|---|
| Question set | A set number of questions. Every answer is timed. Missed problems can repeat at the end. |
| Timed sprint | Answer as many as possible in 30 seconds to 5 minutes. |
| Mastery | Picks what needs practice most (new, missed, and slow facts) and brings missed problems back a few questions later until they're right. |

Built-in presets cover grades 1–5. Use **Build** to make your own and save it for one-tap practice.

## Stats

Every answer is recorded: the problem, the answer given, whether it was right, and how long it took. The **Stats** tab shows:

- totals, accuracy, speed, and daily streaks for any time range
- daily trend charts for accuracy, speed, and questions answered
- fact-mastery grids for ×, ÷, +, and − (new, needs work, learning, mastered)
- trouble spots, with a button to practice them
- a breakdown by kind of problem, and personal bests
- the full history of rounds; tap one to see every question

A fact counts as **mastered** when the last 3 tries were right and each was answered within the fluency goal (3 seconds by default, adjustable in Settings).

## Your data

All data stays in the browser on the device (IndexedDB). No accounts, and nothing is sent anywhere.

- **Back up** in Settings → *Save backup file*. Restoring a backup merges it with what's there, so restoring twice is harmless. Use this to move stats to a new device.
- **iPad / iPhone:** add the app to the Home Screen (Share → *Add to Home Screen*). Safari can clear website data after a few weeks without use, but installed apps are kept.

## Installing on a device

Open the site, then:

- **iPad / iPhone (Safari):** Share → *Add to Home Screen*
- **Android (Chrome):** menu → *Install app*
- **Chromebook / desktop Chrome or Edge:** the install icon in the address bar

After the first visit it works fully offline. When a new version is deployed, the app shows an **Update** button.

## Deploying to GitHub Pages

1. In the repo, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
2. Push to `main`. The workflow in `.github/workflows/pages.yml` runs the tests, builds `_site/`, and deploys it.

The site will be at `https://<user>.github.io/kids-math-facts/`.

## Development

No dependencies are needed, just Node 20+.

```sh
npm test              # unit tests (node --test)
npm run serve         # serve app/ directly at http://localhost:3000 (service worker in network-first dev mode)
npm run serve:build   # build _site/ like CI does and serve it
```

### Layout

```
app/                    the site (plain HTML/CSS/ES modules, no build step needed)
  js/skills/            problem generators: facts, multidigit, fractions, decimals
  js/engine/            answer checking, round state machine, mastery model, presets
  js/stats/             pure stats functions (streaks, daily series, bests)
  js/data/              IndexedDB storage, backup/restore
  js/ui/                screens, keypad, charts, heatmap
  sw.js                 offline service worker (stamped by the build)
scripts/build.mjs       copies app/ → _site/, stamps version + precache list
tests/                  unit tests
```

### Adding a new kind of problem

Add a skill object to one of the files in `app/js/skills/` (or a new file registered in `skills/index.js`). A skill has:

- `id`, `label`, `category`, `grade`
- `options`: the schema that drives the setup screen
- `keys(options)`: the fact keys or problem types it can produce
- `generate(options, rng, key?)`: returns `{ factKey, display, answerType, answer, slots }`
- `keyLabel(key)`: a readable name for stats

`tests/skills.test.js` will check its answers against the displayed problem automatically.
