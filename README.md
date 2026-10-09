# Calorie Tracker

A personal calorie tracker for iPhone with a Liquid Glass-inspired design.
Plain HTML, CSS and JavaScript: no framework, no build step, no server.

## Sections

| Section | What it does |
|---|---|
| **Home** | Today's calories eaten, calories left, macros vs targets, today's entries, quick logging of food/drinks/recipes and exercise |
| **Our Fridge** | Saved foods with nutrition per 100 g or 100 ml, optional serving size |
| **Our Bar** | Saved drinks — either with their own nutrition values, or made from ingredients (e.g. iced coffee = 200 ml milk + …) |
| **Our Cookbook** | Recipes built from Fridge/Bar items, with servings; nutrition per serving is calculated |
| **Reports** | Daily view, weekly chart and averages, biggest calorie sources of the week, weight log and trend |
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

## Where data is stored (for now)

Currently all data is saved in **this browser's local storage** on the device you use.
It survives closing the app, but it is not shared between devices, and is lost if you clear
Safari's website data. Safari can also clear storage for websites that haven't been opened in a
while, so add the app to your Home Screen.

The next step is moving storage to **Google Sheets**. All reads and writes go through
[`js/store.js`](js/store.js), whose tables already match the planned sheet tabs
(Foods, Drinks, Recipes, Recipe Ingredients, Daily Logs, Weight Logs, Settings), so only that file needs to change.

No secrets are used yet, so there is no `.env` file. `.gitignore` already excludes `.env` and credential files.

## Project structure

```
index.html              page shell + floating tab bar
icon.svg                app icon
css/styles.css          Liquid Glass styles (light + dark mode)
js/app.js               starts the app, navigation between screens
js/store.js             data storage (localStorage now, Google Sheets later)
js/nutrition.js         all calorie / macro / energy maths (pure functions)
js/ui.js                shared helpers: formatting, icons, bottom sheet, toast
js/screens/home.js      Home
js/screens/items.js     Our Fridge + Our Bar
js/screens/cookbook.js  Our Cookbook
js/screens/ingredients.js  ingredient editor used by recipes and drinks
js/screens/log.js       logging sheets (food/drink/recipe, exercise)
js/screens/reports.js   Reports (day, week, weight)
js/screens/profile.js   Profile, goal picker and recommended calories
tests/nutrition.test.js unit tests for the maths
```
