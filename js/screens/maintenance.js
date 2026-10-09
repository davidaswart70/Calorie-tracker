// "Your real maintenance" card: maintenance calories worked out from your own logs and weigh-ins.
import * as N from '../nutrition.js';
import { fmt0, fmt1, kj, saveInBackground } from '../ui.js';

export function maintenanceCard(app) {
  const r = N.realMaintenance(app.data.logs, app.data.weights, app.data.settings);
  const head = '<h2>Your real maintenance</h2>';

  if (!r.ready) {
    const need = r.reason === 'weights'
      ? `Log your weight at least ${N.ADAPTIVE.minSpanDays} days apart (now ${fmt0(r.span)} day${r.span === 1 ? '' : 's'}).`
      : `Log your food on most days between weigh-ins (${r.loggedDays} of ${r.periodDays} days so far; need ${N.ADAPTIVE.minLoggedDays}+ and at least 70%).`;
    const pct = r.reason === 'weights' ? r.span / N.ADAPTIVE.minSpanDays : r.loggedDays / Math.max(N.ADAPTIVE.minLoggedDays, r.periodDays * N.ADAPTIVE.minLoggedShare);
    return `<section class="card glass">${head}
      <p class="small muted" style="margin:-4px 0 10px">After about two weeks of logging and weighing in, the app works out what <i>your</i> body actually burns, from real data instead of a formula.</p>
      <div class="share-bar anim"><i style="--w:${Math.min(100, pct * 100).toFixed(0)}%"></i></div>
      <p class="small" style="margin:8px 0 0">${need}</p></section>`;
  }

  const diff = r.formula ? r.maintenance - r.formula : null;
  const change = r.suggested - r.current;
  return `<section class="card glass">${head}
    <div class="tiles">
      <div class="tile"><span>From your data</span><b class="num">${fmt0(N.roundTo(r.maintenance, 10))}</b><small class="num">kcal a day · ${kj(r.maintenance)}</small></div>
      <div class="tile"><span>Formula estimate</span><b class="num">${r.formula ? fmt0(N.roundTo(r.formula, 10)) : '—'}</b><small class="num">${diff === null ? 'complete your profile' : `${diff >= 0 ? 'you burn ' + fmt0(Math.abs(diff)) + ' more' : 'you burn ' + fmt0(Math.abs(diff)) + ' less'}`}</small></div>
    </div>
    <p class="small muted" style="margin:10px 0">Based on the last ${r.periodDays} days: you ate ${fmt0(r.avgIntake)} kcal a day on average and your weight changed ${r.rate > 0 ? '+' : r.rate < 0 ? '−' : ''}${fmt1(Math.abs(r.rate))} kg a week.
      It assumes you log everything; missed snacks make this number look lower than it really is.</p>
    <div class="preview">
      <div class="small muted">Suggested target for “${r.goal.label}”</div>
      <div class="big num">${fmt0(r.suggested)} kcal</div>
      <div class="small muted num">${change === 0 ? 'Same as your current target' : `${change > 0 ? '+' : '−'}${fmt0(Math.abs(change))} kcal vs your current ${fmt0(r.current)} kcal`}${r.floored ? ' · raised to the safe minimum' : ''}</div>
    </div>
    ${change !== 0 ? `<button class="btn block" id="use-real" data-kcal="${r.suggested}" style="margin-top:12px">Use ${fmt0(r.suggested)} kcal as my target</button>` : ''}
  </section>`;
}

export function wireMaintenanceCard(el, app) {
  const b = el.querySelector('#use-real');
  if (!b) return;
  b.onclick = () => {
    const kcal = Number(b.dataset.kcal);
    if (!confirm(`Set your daily target to ${fmt0(kcal)} kcal? You can change it back in your profile.`)) return;
    saveInBackground(app, () => app.store.saveSettings({ calorieTarget: kcal }), `Target set to ${fmt0(kcal)} kcal`);
  };
}
