# Calorie Tracker

A personal calorie tracker for iPhone with a Liquid Glass-inspired design.
Plain HTML, CSS and JavaScript: no framework, no build step, no server.
Data is stored in your own Google Sheet.

## Sections

| Section | What it does |
|---|---|
| **Home** | Today's calories eaten, calories left, macros vs targets, today's entries, quick logging of food/drinks/recipes and exercise |
| **Our Fridge** | Saved foods with nutrition per 100 g or 100 ml, optional serving size |
| **Our Bar** | Saved drinks — either with their own nutrition values, or made from ingredients (e.g. iced coffee = 200 ml milk + …) |
| **Our Cookbook** | Recipes built from Fridge/Bar items, with servings; nutrition per serving is calculated |
| **Reports** | Day, Week and Month dashboards with animated charts (calories, every macro, calorie split, running total), biggest calorie sources, weight trend, **real maintenance** worked out from your own logs, and **Awards** |
| **Meal** (on Home) | Log several Fridge/Bar items as one meal, optionally saving it as a recipe |
| **Streaks & awards** | Logging, on-target and protein streaks; serious and silly badges (a quarter of a cow 🐄, a flock of chickens 🐔 …) with confetti when unlocked |
| **Profile** (⚙ on Home) | Sex, age, height, weight, body fat %, activity level, goal picker with recommended daily calories, macro targets |

Every food and drink is marked **Label** (from the packaging) or **Estimated**. Recipes and
mixed drinks are *Estimated* if any ingredient is. Energy is shown in kcal and kJ (1 kcal = 4.184 kJ).

## The maths

All calculations are in [`js/nutrition.js`](js/nutrition.js) and covered by tests.

- **BMR** — Mifflin–St Jeor: `10 × kg + 6.25 × cm − 5 × age + 5` (men) / `− 161` (women).
  If body fat % is entered, Katch–McArdle is used: `370 + 21.6 × lean kg`.
- **Maintenance (TDEE)** — BMR × activity multiplier: 1.2 / 1.375 / 1.55 / 1.725 / 1.9.
- **Goal** — `kg per week × 7700 ÷ 7` added to maintenance (e.g. −0.5 kg/week → −550 kcal/day).
  Never recommends below 1200 kcal (women) / 1500 kcal (men).
- **Macro targets** — protein 1.6–2.0 g/kg (depending on goal), fat 25 % of calories, carbs the rest.
- **Real maintenance** — after ≥14 days between weigh-ins with most days logged:
  `average intake − (weight change per day × 7700)`; suggests a target for your goal.
- **Exercise** — `(MET − 1) × kg × hours`, MET values from the Compendium of Physical Activities.
  Optionally added to the day's allowance (Profile → "Add exercise to my allowance").
- **kcal from macros** — Atwater factors: protein 4, carbs 4, fat 9, alcohol 7 kcal/g (result marked *Estimated*).

Log entries store a snapshot of the calculated values, so editing a food later doesn't change past days.

## Running it

The app uses JavaScript modules, so it must be served over HTTP (opening `index.html` directly won't work).

```bash
# any static server works, e.g.
python3 -m http.server 8080
# or
npm start
```

Then open <http://localhost:8080>. To try it on your iPhone on the same Wi-Fi, open
`http://<your-computer's-IP>:8080`.

### Tests

```bash
npm test
```

Requires Node 18+. No dependencies to install.

### Publishing on GitHub Pages (to use it on your iPhone)

1. Merge the code into `main`.
2. On GitHub: **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)`**.
3. Open the Pages URL in Safari on your iPhone, tap **Share → Add to Home Screen**.

## Where data is stored: Google Sheets

All data lives in **your own Google Sheet**, so it persists and is the same on every device.
A small Google Apps Script ([`apps-script/Code.gs`](apps-script/Code.gs)) attached to the sheet
reads and writes it. The app talks only to that script.

- **No Google credentials or API keys** are in this repository or the app. The script runs as your Google account.
- The script is protected by a **passcode** you choose. It is stored in the script's *Script properties*
  (not in code) and typed into the app once per device.
- Every save is **read back from the sheet** before the app says it's saved. If anything fails,
  the app shows the error and does not pretend it worked.
- Past log entries keep the values they were logged with.

### Spreadsheet tabs

The script creates these tabs automatically (row 1 = column names; columns are matched by name, so you can reorder them):

| Tab | Columns |
|---|---|
| Foods / Drinks | id, name, unit (g/ml), servingSize, kcal, protein, carbs, fat (all per 100 g/ml), source (label/estimated), notes, updatedAt |
| Recipes | id, name, servings, notes, updatedAt |
| Recipe Ingredients | id, parentType (recipe/drink), parentId, itemType (food/drink), itemId, quantity, unit (g/ml/serving) |
| Daily Logs | id, date, time, type (food/drink/recipe/exercise), itemId, name, quantity, unit, kcal, protein, carbs, fat, source, createdAt |
| Weight Logs | id, date, weightKg, createdAt |
| Settings | key, value (your profile, goal and options) |

You can view and edit the sheet directly. Keep the `id` column intact.

## Connecting Google Sheets

You only do this once.

1. **Create the spreadsheet.** Go to <https://sheets.new> (signed in to Google) and give it a name, e.g. *Calorie Tracker*.
2. **Add the script.** In the spreadsheet: **Extensions → Apps Script**. Delete everything in `Code.gs`,
   paste the full contents of [`apps-script/Code.gs`](apps-script/Code.gs), and click **Save** (💾).
3. **Choose a passcode.** In the Apps Script editor: **Project Settings** (⚙ on the left) → scroll to
   **Script properties** → **Add script property**. Property: `PASSCODE`, Value: a passcode of your choice → **Save script properties**.
4. **Create the tabs.** Go back to the **Editor** (`< >` on the left), choose `setup` in the function
   drop-down at the top, and click **Run**. Google asks for permission the first time:
   **Review permissions** → choose your account → **Advanced** → **Go to (project name) (unsafe)** → **Allow**.
   (It says "unsafe" because it's your own unverified script; it only accesses this spreadsheet.)
   The seven tabs now appear in the spreadsheet.
5. **Publish it as a web app.** Click **Deploy → New deployment** → click ⚙ next to *Select type* → **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**

   Click **Deploy** and copy the **Web app URL** (ends in `/exec`).
   ("Anyone" means anyone with the URL *and* the passcode. Without the passcode every request is refused.)
6. **Connect the app.** Open the app, paste the Web app URL, enter your passcode, and tap **Connect**.
   Repeat this step on each device you use.

### Updating the script later

If `apps-script/Code.gs` changes: paste the new version into the editor, save, then
**Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**. The URL stays the same.

To change the passcode: edit the `PASSCODE` script property, then in the app go to Profile → **Change connection**.

No `.env` file is needed: the only secret (the passcode) lives in Script properties, and `.gitignore` excludes `.env` and credential files anyway.

## Project structure

```
index.html              page shell + floating tab bar
icon.svg                app icon
css/styles.css          Liquid Glass styles (light + dark mode)
js/app.js               starts the app, navigation between screens
js/store.js             talks to the Google Sheets web app
js/nutrition.js         all calorie / macro / energy maths (pure functions)
js/awards.js            streak and award rules (pure functions)
js/charts.js            animated SVG charts
js/ui.js                shared helpers: formatting, icons, bottom sheet, toast
js/screens/home.js      Home
js/screens/items.js     Our Fridge + Our Bar
js/screens/cookbook.js  Our Cookbook
js/screens/ingredients.js  ingredient editor used by recipes and drinks
js/screens/log.js       logging sheets (food/drink/recipe, exercise)
js/screens/reports.js   Reports (day, week, weight)
js/screens/profile.js   Profile, goal picker and recommended calories
js/screens/connect.js   Google Sheets connection screen
apps-script/Code.gs     Google Apps Script backend (paste into the spreadsheet)
tests/nutrition.test.js unit tests for the maths
tests/apps-script.test.js  tests for the Sheets backend (with an in-memory Apps Script stand-in)
```
