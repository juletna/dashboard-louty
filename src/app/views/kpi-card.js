// Carte « chiffre clé » unique du tableau de bord : en-tête (icône, libellé, aide), valeur,
// écart, lignes de contexte et lien d'action. Présentation seule : les montants arrivent déjà formatés.

const svg = inner => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

export const KPI_ICONS = {
  salary: svg('<path d="M3 7h15a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h11"/><circle cx="16.5" cy="12.5" r="1.1"/>'),
  result: svg('<polyline points="3 17 9 11 13 15 21 7"/><polyline points="15 7 21 7 21 13"/>'),
  margin: svg('<line x1="19" y1="5" x2="5" y2="19"/><circle cx="7" cy="7" r="2"/><circle cx="17" cy="17" r="2"/>'),
  revenue: svg('<circle cx="12" cy="12" r="9"/><path d="M15.5 9.5a4 4 0 1 0 0 5"/><line x1="8" y1="11" x2="13" y2="11"/><line x1="8" y1="13.5" x2="13" y2="13.5"/>'),
  costs: svg('<circle cx="9" cy="20" r="1.3"/><circle cx="18" cy="20" r="1.3"/><path d="M2 3h3l2.4 12.1a1.6 1.6 0 0 0 1.6 1.3h8.5a1.6 1.6 0 0 0 1.6-1.3L22 7H6"/>'),
  receipt: svg('<path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/><path d="M9 7h6M9 11h6"/>'),
  reserve: svg('<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/>'),
  debt: svg('<circle cx="12" cy="12" r="9"/><line x1="8" y1="12" x2="16" y2="12"/>'),
  waiting: svg('<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/>'),
  validation: svg('<circle cx="12" cy="12" r="9"/><polyline points="8 12.5 11 15.5 16 9"/>'),
  review: svg('<circle cx="11" cy="11" r="6.5"/><line x1="20" y1="20" x2="15.8" y2="15.8"/>')
};

const TONES = ['violet', 'blue', 'amber', 'green', 'red'];
const DELTA_TONES = ['good', 'warn', 'bad', 'none'];
const PILL_TONES = ['up', 'down'];

// Chaque texte est échappé ici ; `value`, `unit`, `label` et les lignes `meta` sont du texte brut.
// - tone : teinte de l'icône · variant : 'empty' (carte en pointillés, non cliquable)
// - help : { html, label } → pastille ? avec infobulle · pill : { tone:'up'|'down', text }
// - delta : { tone:'good'|'warn'|'bad'|'none', text } · meta : texte ou [libellé, valeur en gras]
// - action : { label, attrs, className } · classes/attrs/valueClass : crochets pour tests et délégations
export function renderKpiCard({ tag = 'div', icon, tone = 'violet', label, help, value, unit, pill, delta, meta = [], action,
  variant, classes = '', attrs = {}, valueClass = '' }, { escape: esc }) {
  const attributes = Object.entries(attrs).map(([name, content]) => ` ${name}="${esc(content)}"`).join('');
  const helpHtml = help ? `<span class="sp-help" data-tip-html="${esc(help.html)}" tabindex="0" role="button" aria-label="${esc(help.label)}">?</span>` : '';
  const pillHtml = pill ? `<span class="kpi-pill ${PILL_TONES.includes(pill.tone) ? pill.tone : 'up'}"><span class="tri">${pill.tone === 'down' ? '▼' : '▲'}</span>${esc(pill.text)}</span>` : '';
  const deltaHtml = delta ? `<span class="kpi-card-delta is-${DELTA_TONES.includes(delta.tone) ? delta.tone : 'none'}">${esc(delta.text)}</span>` : '';
  const metaHtml = meta.filter(Boolean).map(line => Array.isArray(line)
    ? `<span class="kpi-card-meta">${esc(line[0])} <b>${esc(line[1])}</b></span>`
    : `<span class="kpi-card-meta">${esc(line)}</span>`).join('');
  const actionHtml = action
    ? `<button type="button" class="kpi-card-action${action.className ? ' ' + action.className : ''}"${Object.entries(action.attrs || {}).map(([name, content]) => ` ${name}="${esc(content)}"`).join('')}>${esc(action.label)} →</button>` : '';
  const unitHtml = unit ? ` <span class="kpi-card-unit">${esc(unit)}</span>` : '';
  const classNames = ['kpi-card', `tone-${TONES.includes(tone) ? tone : 'violet'}`, classes, variant === 'empty' ? 'is-empty' : ''].filter(Boolean).join(' ');
  return `<${tag} class="${classNames}"${attributes}>
    <div class="kpi-card-head"><span class="kpi-card-icon">${icon || ''}</span><h4 class="kpi-card-label">${esc(label)}</h4>${helpHtml}</div>
    <div class="kpi-card-main"><strong class="kpi-card-value${valueClass ? ' ' + valueClass : ''}">${esc(value)}${unitHtml}</strong>${pillHtml}</div>
    ${deltaHtml}${metaHtml}${actionHtml}</${tag}>`;
}
