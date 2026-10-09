// Profile & goal: body details, activity level, goal picker and recommended calories.
import * as N from '../nutrition.js';
import { esc, fmt0, fmt1, kj, icon, seg, segValue, wireSegs, saving } from '../ui.js';

export function render(el, app) {
  const s = app.data.settings;
  let activity = s.activityLevel || '';
  let goal = s.goal || 'maintain';

  el.innerHTML = `
    <header class="page-head">
      <div><p class="eyebrow">Profile</p><h1>You & your goal</h1></div>
      <a class="icon-btn" href="#home" aria-label="Back to Home">${icon.left}</a>
    </header>

    <section class="card glass stack">
      <h2>About you</h2>
      ${seg('sex', [['female', 'Female'], ['male', 'Male']], s.sex || '')}
      <div class="grid-3">
        <label class="field"><span>Age</span><input class="input num" id="age" inputmode="numeric" value="${esc(s.age)}" placeholder="years"></label>
        <label class="field"><span>Height</span><input class="input num" id="height" inputmode="decimal" value="${esc(s.heightCm)}" placeholder="cm"></label>
        <label class="field"><span>Weight</span><input class="input num" id="weight" inputmode="decimal" value="${esc(s.weightKg)}" placeholder="kg"></label>
      </div>
      <label class="field"><span>Body fat % (optional — gives a more accurate BMR if known)</span>
        <input class="input num" id="bodyfat" inputmode="decimal" value="${esc(s.bodyFatPct)}" placeholder="e.g. 22"></label>
    </section>

    <section class="card glass">
      <h2>Activity level</h2>
      <p class="small muted" style="margin:-6px 0 4px">Your usual week, not counting exercise you log separately.</p>
      <div id="activity">${N.ACTIVITY_LEVELS.map((a) => `
        <button type="button" class="choice ${a.id === activity ? 'active' : ''}" data-id="${a.id}">
          <span class="grow"><b>${esc(a.label)}</b><span>${esc(a.desc)}</span></span>
          <span class="tiny num">× ${a.factor}</span></button>`).join('')}</div>
    </section>

    <section class="card glass">
      <h2>Your goal</h2>
      <p class="small muted" style="margin:-6px 0 4px">Pick a goal to see the calories recommended for it.</p>
      <div id="goals"></div>
    </section>

    <section class="card glass" id="result"></section>

    <section class="card glass stack">
      <h2>Daily target</h2>
      <label class="field"><span>Use my own target instead (kcal, optional)</span>
        <input class="input num" id="override" inputmode="numeric" value="${esc(s.calorieTarget)}" placeholder="Leave empty to use the recommendation"></label>
      <label class="toggle"><span><b>Add exercise to my allowance</b><br>
        <span class="small muted">Logged exercise calories are added to what you can eat that day. If you turn this on, choose an activity level that ignores your workouts (usually Sedentary or Lightly active) so they aren’t counted twice.</span></span>
        <span class="switch"><input type="checkbox" id="addex" ${s.addExercise === 'yes' ? 'checked' : ''}><span></span></span></label>
      <button class="btn block" id="save">Save profile</button>
    </section>

    <section class="card glass">
      <h2>Google Sheets</h2>
      <p class="small muted" style="margin:-4px 0 12px">Your data is saved in your Google Sheet. The connection details are stored on this device only.</p>
      <button class="btn ghost block small" id="disconnect">Change connection</button>
    </section>

    <section class="card glass">
      <details class="maths">
        <summary>How these numbers are calculated</summary>
        <p><b>BMR</b> (calories at rest), Mifflin–St Jeor:<br>
          <code>10 × kg + 6.25 × cm − 5 × age + 5</code> (men)<br>
          <code>10 × kg + 6.25 × cm − 5 × age − 161</code> (women)<br>
          If you enter body fat %, Katch–McArdle is used instead:<br>
          <code>370 + 21.6 × lean mass (kg)</code></p>
        <p><b>Maintenance (TDEE)</b> = BMR × activity multiplier (1.2 – 1.9).</p>
        <p><b>Goal</b>: 1 kg of body fat ≈ ${fmt0(N.KCAL_PER_KG)} kcal, so the daily change is
          <code>kg per week × 7700 ÷ 7</code> (e.g. −0.5 kg/week = −550 kcal/day).
          The recommendation never goes below ${fmt0(N.MIN_KCAL.female)} kcal (women) or ${fmt0(N.MIN_KCAL.male)} kcal (men).</p>
        <p><b>Macros</b>: protein 1.6–2.0 g per kg body weight (higher when losing), fat 25 % of calories, carbs the rest.
          Energy: protein and carbs 4 kcal/g, fat 9 kcal/g, alcohol 7 kcal/g. 1 kcal = 4.184 kJ.</p>
        <p><b>Exercise</b>: <code>(MET − 1) × kg × hours</code>. The “− 1” removes resting calories already counted in BMR.</p>
        <p>These formulas are population averages, usually within about 10 %. If your weight trend in Reports doesn’t match your goal after 2–3 weeks, adjust your target.</p>
      </details>
    </section>`;

  const $ = (id) => el.querySelector(`#${id}`);
  const profile = () => ({
    sex: segValue(el, 'sex'),
    age: N.num($('age').value),
    heightCm: N.num($('height').value),
    weightKg: N.num($('weight').value),
    bodyFatPct: N.num($('bodyfat').value),
    activityLevel: activity,
    goal,
  });

  function draw() {
    const p = profile();
    const complete = N.profileComplete(p);

    $('goals').innerHTML = N.GOALS.map((g) => {
      const rec = complete ? N.recommendCalories(p, g.id) : null;
      const rate = g.kgPerWeek === 0 ? 'Keep your weight steady' : `${g.kgPerWeek > 0 ? '+' : '−'}${Math.abs(g.kgPerWeek)} kg per week`;
      return `<button type="button" class="choice ${g.id === goal ? 'active' : ''}" data-id="${g.id}">
        <span class="grow"><b>${esc(g.label)}</b><span>${rate}</span></span>
        <span class="kcal num">${rec ? `${fmt0(rec.target)} kcal<small>per day</small>` : '<small>—</small>'}</span></button>`;
    }).join('');
    $('goals').querySelectorAll('.choice').forEach((b) => (b.onclick = () => { goal = b.dataset.id; draw(); }));

    const result = $('result');
    if (!complete) {
      result.innerHTML = '<h2>Recommendation</h2><p class="small muted" style="margin:0">Fill in sex, age, height, weight and activity level to see your numbers.</p>';
      return;
    }
    const rec = N.recommendCalories(p, goal);
    const m = N.macroTargets(rec.target, p.weightKg, goal);
    result.innerHTML = `
      <h2>Recommended for “${esc(rec.goal.label)}”</h2>
      <div class="preview">
        <div class="big num">${fmt0(rec.target)} kcal <span class="small muted" style="font-weight:500">per day</span></div>
        <div class="small muted num">${kj(rec.target)}</div>
      </div>
      ${rec.floored ? `<p class="notice" style="margin-top:10px">This goal would put you below ${fmt0(rec.floor)} kcal a day, so the recommendation is raised to that minimum. Consider a slower goal.</p>` : ''}
      <table class="table num" style="margin-top:10px">
        <tr><td>BMR (${esc(rec.formula)})</td><td>${fmt0(rec.bmr)} kcal</td></tr>
        <tr><td>Maintenance (BMR × ${N.activityFactor(activity)})</td><td>${fmt0(rec.tdee)} kcal</td></tr>
        <tr><td>Goal adjustment</td><td>${rec.adjustment > 0 ? '+' : rec.adjustment < 0 ? '−' : ''}${fmt0(Math.abs(rec.adjustment))} kcal</td></tr>
        <tr><td><b>Daily target</b></td><td><b>${fmt0(rec.target)} kcal</b></td></tr>
      </table>
      <div class="grid-3" style="margin-top:12px;text-align:center">
        <div><div class="small muted">Protein</div><b class="num">${fmt0(m.protein)} g</b></div>
        <div><div class="small muted">Carbs</div><b class="num">${fmt0(m.carbs)} g</b></div>
        <div><div class="small muted">Fat</div><b class="num">${fmt0(m.fat)} g</b></div>
      </div>`;
  }

  wireSegs(el, draw);
  ['age', 'height', 'weight', 'bodyfat'].forEach((id) => ($(id).oninput = draw));
  $('activity').querySelectorAll('.choice').forEach((b) => (b.onclick = () => {
    activity = b.dataset.id;
    $('activity').querySelectorAll('.choice').forEach((x) => x.classList.toggle('active', x === b));
    draw();
  }));
  draw();

  $('disconnect').onclick = () => {
    if (confirm('Disconnect this device from your Google Sheet? Your data stays in the sheet; you can reconnect with the URL and passcode.')) app.disconnect();
  };

  $('save').onclick = async (e) => {
    const p = profile();
    const values = {
      sex: p.sex,
      age: $('age').value.trim() ? p.age : '',
      heightCm: $('height').value.trim() ? p.heightCm : '',
      weightKg: $('weight').value.trim() ? p.weightKg : '',
      bodyFatPct: $('bodyfat').value.trim() ? p.bodyFatPct : '',
      activityLevel: activity,
      goal,
      calorieTarget: $('override').value.trim() ? N.num($('override').value) : '',
      addExercise: $('addex').checked ? 'yes' : 'no',
    };
    const latest = N.latestWeight(app.data.weights);
    const newWeight = p.weightKg > 0 && (!latest || N.num(latest.weightKg) !== p.weightKg);
    const res = await saving(e.currentTarget, async () => {
      await app.store.saveSettings(values);
      // A changed weight is also recorded in the weight log.
      if (newWeight) await app.store.saveWeight(N.dateStr(), p.weightKg);
    }, newWeight ? `Profile saved · ${fmt1(p.weightKg)} kg added to weight log` : 'Profile saved');
    if (res.ok) app.refresh();
  };
}
