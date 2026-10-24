(function () {
  var root = document.getElementById('root');
  if (!window.React || !window.ReactDOM || !window.Motion || !window.htm || !window.tailwind) {
    root.textContent = 'RigThermal could not load its libraries. Check your connection and reload the page.';
    return;
  }
/* ===== RigThermal UI, part 1: primitives, header, calculator ===== */
const { useState, useEffect, useLayoutEffect, useMemo, useRef } = React;
const { motion: M, AnimatePresence, animate, MotionConfig } = Motion;
const html = htm.bind(React.createElement);

const API = '/.netlify/functions/builds';
const LS_RIGS = 'rigthermal.rigs.v1';
const LS_SESSION = 'rigthermal.session.v1';

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const rise = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 140, damping: 20 } },
};

const TABS = [
  { id: 'calc', label: 'Calculator', icon: 'Calculator' },
  { id: 'psu', label: 'PSU & Cost', icon: 'Plug' },
  { id: 'rigs', label: 'Saved Rigs', icon: 'HardDrive' },
  { id: 'privacy', label: 'Privacy Policy', icon: 'ShieldCheck' },
];

function Icon({ n, size = 16, ...rest }) {
  const C = window.LucideReact && window.LucideReact[n];
  return C ? React.createElement(C, Object.assign({ size: size, 'aria-hidden': true }, rest)) : null;
}

/* Number that springs to its new value. Text is written straight to the node. */
function Counter({ value, decimals = 0, prefix = '', suffix = '', className = '' }) {
  const ref = useRef(null);
  const shown = useRef(value * 0.75);
  useLayoutEffect(() => {
    if (ref.current) ref.current.textContent = prefix + nf(shown.current, decimals) + suffix;
  }, []);
  useEffect(() => {
    const ctrl = animate(shown.current, value, {
      type: 'spring', stiffness: 110, damping: 22, restDelta: 0.001,
      onUpdate: (v) => {
        shown.current = v;
        if (ref.current) ref.current.textContent = prefix + nf(v, decimals) + suffix;
      },
    });
    return () => ctrl.stop();
  }, [value, decimals, prefix, suffix]);
  return html`<span ref=${ref} className=${'tabular ' + className}></span>`;
}

function Card({ title, icon, chip, children, className = '' }) {
  return html`
    <${M.section} variants=${rise} className=${'panel p-4 sm:p-5 min-w-0 ' + className}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="label flex items-center gap-2"><${Icon} n=${icon} size=${15} />${title}</h3>
        ${chip != null && html`<span className="chip tabular">${chip}</span>`}
      </div>
      ${children}
    <//>`;
}

function SelectField({ id, label, value, options, onChange }) {
  const opt = options.find((o) => o.id === value) || options[0];
  return html`
    <div>
      <label htmlFor=${id} className="text-sm font-medium">${label}</label>
      <div className="mt-1.5 flex items-center gap-2">
        <select id=${id} className="field flex-1" value=${value} onChange=${(e) => onChange(e.target.value)}>
          ${options.map((o) => html`<option key=${o.id} value=${o.id}>${o.name}</option>`)}
        </select>
        <span className="chip tabular shrink-0">${opt.w} W</span>
      </div>
    </div>`;
}

function Segmented({ id, label, value, options, onChange }) {
  return html`
    <div role="group" aria-label=${label} className="seg">
      ${options.map((o) => html`
        <button key=${o.id} type="button" className="seg-btn" aria-pressed=${value === o.id} onClick=${() => onChange(o.id)}>
          ${value === o.id && html`<${M.span} layoutId=${'seg-' + id} className="seg-pill" transition=${{ type: 'spring', stiffness: 420, damping: 34 }} />`}
          <span>${o.label}</span>
        </button>`)}
    </div>`;
}

function Stepper({ id, label, hint, value, min, max, unitW, onChange }) {
  return html`
    <div className="flex items-center justify-between gap-3 border-t border-white/5 py-2.5 first:border-t-0">
      <div className="min-w-0">
        <div id=${id + '-l'} className="text-sm font-medium">${label}</div>
        <div className="mono text-[11px] text-mute">${hint}</div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="mono tabular w-14 text-right text-[11px] text-mute">${value * unitW} W</span>
        <div className="stepper" role="group" aria-labelledby=${id + '-l'}>
          <button type="button" aria-label=${'Decrease ' + label} disabled=${value <= min} onClick=${() => onChange(Math.max(min, value - 1))}><${Icon} n="Minus" size=${14} /></button>
          <output aria-live="polite">${value}</output>
          <button type="button" aria-label=${'Increase ' + label} disabled=${value >= max} onClick=${() => onChange(Math.min(max, value + 1))}><${Icon} n="Plus" size=${14} /></button>
        </div>
      </div>
    </div>`;
}

function Header({ tab, setTab, rigCount, net }) {
  const view = {
    checking: ['Checking Neon', 'var(--warn)', 'Looking for the Neon sync function'],
    neon: ['Neon connected', 'var(--ok)', 'The sync function answered'],
    local: ['Local mode', 'var(--cool)', 'Neon is not reachable here, rigs stay in this browser'],
  }[net];
  return html`
    <header className="glass rounded-[26px] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="mark" aria-hidden="true"><${Icon} n="Flame" size=${22} /></div>
          <div className="min-w-0">
            <h1 className="title-glow text-[1.75rem] leading-none sm:text-[2.4rem]">RigThermal</h1>
            <p className="mt-2 text-sm text-mute">Custom PC power budget and thermal calculator</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2" role="status">
          <span className="chip" title="Results update on every change"><span className="dot"></span>Live</span>
          <span className="chip" title=${view[2]}><span className="dot" style=${{ '--c': view[1] }}></span>${view[0]}</span>
        </div>
      </div>
      <nav className="-mx-1 mt-4 overflow-x-auto pb-1" aria-label="Sections">
        <div role="tablist" className="flex w-max min-w-full gap-1 px-1">
          ${TABS.map((t) => html`
            <button key=${t.id} id=${'tab-' + t.id} type="button" role="tab" className="tab" aria-selected=${tab === t.id} aria-controls="panel" onClick=${() => setTab(t.id)}>
              ${tab === t.id && html`<${M.span} layoutId="tabpill" className="tab-pill" transition=${{ type: 'spring', stiffness: 400, damping: 32 }} />`}
              <span className="tab-in">
                <${Icon} n=${t.icon} size=${15} />${t.label}
                ${t.id === 'rigs' && rigCount > 0 ? html`<span className="chip-count tabular">${rigCount}</span>` : null}
              </span>
            </button>`)}
        </div>
      </nav>
    </header>`;
}

function Meter({ label, value, max, display, ticks }) {
  const pct = Math.min(1, value / max);
  return html`
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="label">${label}</span>
        <span className="mono tabular text-sm">${display}</span>
      </div>
      <div className="meter mt-2" role="img" aria-label=${label + ': ' + display}>
        <div className="meter-heat"></div>
        <${M.div} className="meter-cover" initial=${{ width: '100%' }} animate=${{ width: ((1 - pct) * 100) + '%' }} transition=${{ type: 'spring', stiffness: 80, damping: 18 }} />
      </div>
      <div className="mono tabular mt-1.5 flex justify-between text-[10px] text-mute">
        ${ticks.map((t) => html`<span key=${t}>${nf(t)}</span>`)}
      </div>
      ${value > max && html`<p className="mt-1 text-xs" style=${{ color: 'rgb(var(--warn))' }}>Beyond the scale of this meter.</p>`}
    </div>`;
}

function StatTile({ label, icon, value, unit, formula, decimals = 0, children }) {
  return html`
    <${M.div} variants=${rise} whileHover=${{ y: -3 }} className="panel relative min-w-0 overflow-hidden p-4">
      <span className="label flex items-center gap-2"><${Icon} n=${icon} size=${14} />${label}</span>
      <div className="mt-2.5 flex flex-wrap items-baseline gap-x-2">
        <${Counter} value=${value} decimals=${decimals} className="stat-num" />
        <span className="mono text-sm text-mute">${unit}</span>
      </div>
      <p className="mono mt-1.5 text-[11px] leading-snug text-mute">${formula}</p>
      ${children}
    <//>`;
}

function Breakdown({ calc }) {
  const total = Math.max(1, calc.base);
  return html`
    <${Card} title="Where the watts go" icon="Layers" chip=${nf(calc.base) + ' W'}>
      <div className="stack" role="img" aria-label="Share of base wattage by component">
        ${calc.parts.map((p) => html`
          <${M.div} key=${p.key} initial=${{ width: '0%' }} animate=${{ width: ((p.w / total) * 100) + '%' }} transition=${{ type: 'spring', stiffness: 90, damping: 18 }} style=${{ background: PART_COLORS[p.key] }} />`)}
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
        ${calc.parts.map((p) => html`
          <li key=${p.key} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex min-w-0 items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-sm" style=${{ background: PART_COLORS[p.key] }}></span>${p.label}</span>
            <span className="mono tabular text-xs text-mute">${p.w} W · ${nf((p.w / total) * 100)}%</span>
          </li>`)}
      </ul>
    <//>`;
}

function CalcTab({ cfg, setField, calc }) {
  const parts = Object.fromEntries(calc.parts.map((p) => [p.key, p.w]));
  const heaterPct = (calc.btu / HEATER_BTU) * 100;
  const tons = calc.btu / BTU_PER_TON;
  return html`
    <${M.div} className="grid gap-4 lg:grid-cols-12" variants=${stagger} initial="hidden" animate="show">
      <div className="grid min-w-0 content-start gap-4 lg:col-span-7">
        <${Card} title="Compute" icon="Cpu" chip=${(parts.cpu + parts.gpu) + ' W'}>
          <div className="grid gap-4">
            <${SelectField} id="cpu" label="Processor (TDP)" value=${cfg.cpu} options=${CPUS} onChange=${(v) => setField('cpu', v)} />
            <${SelectField} id="gpu" label="Graphics card (TGP)" value=${cfg.gpu} options=${GPUS} onChange=${(v) => setField('gpu', v)} />
          </div>
        <//>
        <${Card} title="Board and memory" icon="Server" chip=${(parts.board + parts.ram) + ' W'}>
          <div className="grid gap-4">
            <${SelectField} id="board" label="Motherboard and chipset" value=${cfg.board} options=${BOARDS} onChange=${(v) => setField('board', v)} />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">Memory type</div>
                <div className="mono text-[11px] text-mute">${calc.ramType.w} W per stick</div>
              </div>
              <${Segmented} id="ram" label="Memory type" value=${cfg.ramType} options=${RAM_TYPES.map((r) => ({ id: r.id, label: r.name }))} onChange=${(v) => setField('ramType', v)} />
            </div>
            <${Stepper} id="ramc" label="RAM sticks" hint="1 to 8 modules" value=${cfg.ramCount} min=${LIMITS.ramCount[0]} max=${LIMITS.ramCount[1]} unitW=${calc.ramType.w} onChange=${(v) => setField('ramCount', v)} />
          </div>
        <//>
        <div className="grid gap-4 sm:grid-cols-2">
          <${Card} title="Storage" icon="HardDrive" chip=${parts.storage + ' W'}>
            <${Stepper} id="nvme" label="NVMe SSD" hint="7 W each" value=${cfg.nvme} min=${0} max=${LIMITS.nvme[1]} unitW=${STORAGE_W.nvme} onChange=${(v) => setField('nvme', v)} />
            <${Stepper} id="ssd" label="SATA SSD" hint="3 W each" value=${cfg.ssd} min=${0} max=${LIMITS.ssd[1]} unitW=${STORAGE_W.ssd} onChange=${(v) => setField('ssd', v)} />
            <${Stepper} id="hdd" label="SATA HDD" hint="9 W each" value=${cfg.hdd} min=${0} max=${LIMITS.hdd[1]} unitW=${STORAGE_W.hdd} onChange=${(v) => setField('hdd', v)} />
          <//>
          <${Card} title="Fans and cooling" icon="Fan" chip=${parts.cooling + ' W'}>
            <${Stepper} id="aio" label="Liquid AIO" hint="15 W pump and fans" value=${cfg.aio} min=${0} max=${LIMITS.aio[1]} unitW=${COOLING_W.aio} onChange=${(v) => setField('aio', v)} />
            <${Stepper} id="fans" label="Case fans" hint="3 W each" value=${cfg.fans} min=${0} max=${LIMITS.fans[1]} unitW=${COOLING_W.fans} onChange=${(v) => setField('fans', v)} />
          <//>
        </div>
      </div>

      <div className="grid min-w-0 content-start gap-4 lg:col-span-5">
        <div className="grid grid-cols-2 gap-4">
          <${StatTile} label="Base TDP" icon="Zap" value=${calc.base} unit="W" formula="Sum of parts" />
          <${StatTile} label="Recommended PSU" icon="Plug" value=${calc.rec} unit="W" formula="Base × 1.20">
            <p className="mt-2 text-xs text-mute">${calc.psu ? 'Buy a ' + calc.psu + ' W unit' : 'Above 1,600 W, look at workstation units'}</p>
          <//>
        </div>
        <${StatTile} label="Thermal output" icon="Flame" value=${calc.btu} unit="BTU/hr" formula=${'PSU W × 3.41214 = ' + nf(calc.rec, 1) + ' × 3.41214'}>
          <p className="mt-2 text-xs text-mute">About ${nf(heaterPct)}% of a 1,500 W room heater, or ${nf(tons, 2)} tons of cooling load.</p>
        <//>
        <${Card} title="Live meters" icon="Gauge">
          <div className="grid gap-5">
            <${Meter} label="System draw" value=${calc.base} max=${WATT_SCALE} display=${nf(calc.base) + ' W'} ticks=${[0, 250, 500, 750, 1000]} />
            <${Meter} label="Heat dissipation" value=${calc.btu} max=${BTU_SCALE} display=${nf(calc.btu) + ' BTU/hr'} ticks=${[0, 1050, 2100, 3150, 4200]} />
          </div>
        <//>
        <${Breakdown} calc=${calc} />
        <p className="px-1 text-xs leading-relaxed text-mute">TDP is a rating, not peak draw. Boost clocks and GPU spikes can exceed it, which is what the 20% headroom covers. Motherboard and chipset are counted as a component.</p>
      </div>
    <//>`;
}

/* ===== RigThermal UI, part 2: PSU and cost, rigs, setup guide, policy, app ===== */

function Ring({ value, sub }) {
  const v = Math.min(1, Math.max(0, value));
  return html`
    <svg viewBox="0 0 140 140" className="w-full max-w-[210px]" role="img" aria-label=${'PSU load ' + Math.round(v * 100) + ' percent'}>
      <defs>
        <linearGradient id="ringHeat" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#3B1E8F" />
          <stop offset="0.35" stopColor="#B5179E" />
          <stop offset="0.7" stopColor="#FF5A36" />
          <stop offset="1" stopColor="#FFC24B" />
        </linearGradient>
      </defs>
      <circle cx="70" cy="70" r="52" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="11" />
      <g transform="rotate(-90 70 70)">
        <${M.circle} cx="70" cy="70" r="52" fill="none" stroke="url(#ringHeat)" strokeWidth="11" strokeLinecap="round"
          initial=${{ pathLength: 0 }} animate=${{ pathLength: v }} transition=${{ type: 'spring', stiffness: 55, damping: 16 }} />
      </g>
      <text x="70" y="68" textAnchor="middle" fontSize="26" fontWeight="600" fill="rgb(231,235,244)" fontFamily="JetBrains Mono, monospace">${Math.round(v * 100)}%</text>
      <text x="70" y="88" textAnchor="middle" fontSize="9.5" fill="rgb(139,151,176)" fontFamily="JetBrains Mono, monospace">${sub}</text>
    </svg>`;
}

function PsuTab({ calc, u, ctl }) {
  const { tier, why } = u.tierPick;
  const sav = u.saving;
  const band = loadBand(calc.load);
  const sym = CURRENCIES[u.currency].sym;
  return html`
    <${M.div} className="grid gap-4 lg:grid-cols-12" variants=${stagger} initial="hidden" animate="show">
      <${Card} title="Usage and rate" icon="Clock" className="lg:col-span-5">
        <div className="grid gap-5">
          <div>
            <div className="flex items-baseline justify-between">
              <label htmlFor="hours" className="text-sm font-medium">Daily usage hours</label>
              <span className="mono tabular text-xs text-mute">${nf(u.hours, u.hours % 1 ? 1 : 0)} h / day</span>
            </div>
            <input id="hoursRange" aria-label="Daily usage hours slider" type="range" min="0" max="24" step="0.5" className="mt-3" value=${u.hours} onChange=${(e) => ctl.setHoursStr(e.target.value)} />
            <input id="hours" type="number" inputMode="decimal" min="0" max="24" step="0.5" className="field mono mt-2" value=${ctl.hoursStr} onChange=${(e) => ctl.setHoursStr(e.target.value)} />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <label htmlFor="rate" className="text-sm font-medium">Electricity rate per kWh</label>
              <${Segmented} id="cur" label="Currency" value=${u.currency} options=${[{ id: 'PHP', label: 'PHP' }, { id: 'USD', label: 'USD' }]} onChange=${ctl.changeCurrency} />
            </div>
            <div className="relative">
              <span className="mono pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mute">${sym}</span>
              <input id="rate" type="number" inputMode="decimal" min="0" step="0.01" className="field mono" style=${{ paddingLeft: '30px' }} value=${ctl.rateStr} onChange=${(e) => ctl.setRateStr(e.target.value)} />
            </div>
            <p className="mt-2 text-xs text-mute">Defaults are 12 PHP/kWh or 0.20 USD/kWh. Use the rate on your bill.</p>
          </div>
        </div>
      <//>

      <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:col-span-7">
        <${StatTile} label="Monthly power usage" icon="Zap" value=${u.kwh} decimals=${1} unit="kWh" formula=${nf(calc.rec, 1) + ' W × ' + nf(u.hours, u.hours % 1 ? 1 : 0) + ' h × 30 ÷ 1000'} />
        <${StatTile} label="Estimated monthly cost" icon="Wallet" value=${u.cost} decimals=${2} unit=${u.currency} formula=${nf(u.kwh, 1) + ' kWh × ' + sym + nf(u.rate, 2)}>
          <p className="mt-2 text-xs text-mute">About <strong className="mono font-semibold text-fg">${sym}${nf(u.cost * 12)}</strong> per year.</p>
        <//>
        <p className="px-1 text-xs leading-relaxed text-mute sm:col-span-2">Monthly figures use the recommended wattage, so they are an upper bound. A PC idling or browsing draws far less than its rating.</p>
      </div>

      <${Card} title="Recommended efficiency" icon="BadgeCheck" className="lg:col-span-7">
        <div className="flex flex-wrap items-center gap-4">
          <${M.div} key=${tier.id} className="tier-badge" style=${{ '--tier': tier.color }} initial=${{ scale: 0.9, opacity: 0 }} animate=${{ scale: 1, opacity: 1 }} transition=${{ type: 'spring', stiffness: 220, damping: 16 }}>
            <${Icon} n="Zap" size=${18} />${tier.name}
          <//>
          <span className="chip tabular">${tier.eff}% at 50% load</span>
        </div>
        <p className="mt-3 max-w-[60ch] text-sm text-fg/85">${why}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          ${TIERS.map((t) => html`
            <div key=${t.id} className="tier-opt" data-on=${t.id === tier.id} style=${{ '--tier': t.color }}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold" style=${{ color: t.color }}>${t.name.replace('80+ ', '')}</span>
                <span className="mono tabular text-xs text-mute">${t.eff}%</span>
              </div>
              <div className="mono mt-1.5 text-[11px] text-mute">
                ${t.id === 'bronze' ? 'Baseline' : html`Saves ${nf(tierSaving(u.kwh, t, u.rate).kwh, 1)} kWh / mo`}
              </div>
            </div>`)}
        </div>
        <p className="mt-3 text-xs text-mute">
          ${tier.id === 'bronze'
            ? 'Bronze is the baseline for the savings shown on the other tiers.'
            : html`Versus Bronze at these settings, ${tier.name.replace('80+ ', '')} saves about ${nf(sav.kwh, 1)} kWh and ${sym}${nf(sav.cost, 2)} a month at the wall.`}
        </p>
      <//>

      <${Card} title="PSU load" icon="Gauge" className="lg:col-span-5">
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:gap-5">
          <${Ring} value=${calc.load} sub=${calc.psu ? nf(calc.base) + ' / ' + calc.psu + ' W' : nf(calc.base) + ' W'} />
          <div className="min-w-0 text-center sm:text-left">
            <span className=${'chip chip-' + band.tone}>${band.label}</span>
            <p className="mt-2 text-sm text-fg/85">${calc.psu ? 'Base draw against a standard ' + calc.psu + ' W unit.' : 'No standard unit up to 1,600 W covers this build.'}</p>
            <p className="mt-1 text-xs text-mute">PSUs run most efficiently around 50% load and stay comfortable up to about 80%.</p>
          </div>
        </div>
      <//>
    <//>`;
}

/* ---------- saved rigs ---------- */

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch (e) { return ''; }
}

const SYNC_VIEW = {
  local: ['chip', 'Local only', 'HardDrive'],
  pending: ['chip chip-warn', 'Sync pending', 'CloudOff'],
  syncing: ['chip chip-cool', 'Syncing', 'RefreshCw'],
  synced: ['chip chip-ok', 'In Neon', 'Check'],
};

function RigCard({ rig, onLoad, onSync, onDelete }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return undefined;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  const sym = (CURRENCIES[rig.currency] || CURRENCIES.PHP).sym;
  const sv = SYNC_VIEW[rig.sync] || SYNC_VIEW.local;
  const canSync = !rig.example && rig.sync !== 'synced' && rig.sync !== 'syncing';
  return html`
    <${M.article} layout initial=${{ opacity: 0, y: 18, scale: 0.97 }} animate=${{ opacity: 1, y: 0, scale: 1 }} exit=${{ opacity: 0, scale: 0.9, y: -8 }}
      transition=${{ type: 'spring', stiffness: 220, damping: 24 }} whileHover=${{ y: -4 }} className="panel flex min-w-0 flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <h4 className="font-display min-w-0 break-words text-[15px] font-medium leading-snug">${rig.name}</h4>
        <span className="flex shrink-0 flex-wrap justify-end gap-1.5">
          ${rig.example && html`<span className="chip chip-cool">Example</span>`}
          ${!rig.example && html`<span className=${sv[0]}><${Icon} n=${sv[2]} size=${12} />${sv[1]}</span>`}
        </span>
      </div>
      ${rig.desc ? html`<p className="clamp-2 text-sm text-fg/80">${rig.desc}</p>` : null}
      <p className="mono break-words text-[11px] leading-relaxed text-mute">${rig.cpu}<br />${rig.gpu}</p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        <div><dt className="label">Total wattage</dt><dd className="mono tabular mt-0.5 text-lg font-semibold">${nf(rig.base)} W</dd></div>
        <div><dt className="label">Thermal</dt><dd className="mono tabular mt-0.5 text-lg font-semibold">${nf(rig.btu)}<span className="text-xs font-normal text-mute"> BTU/hr</span></dd></div>
        <div><dt className="label">PSU</dt><dd className="mono tabular mt-0.5 text-sm">${nf(rig.rec)} W</dd></div>
        <div><dt className="label">Monthly cost</dt><dd className="mono tabular mt-0.5 text-sm">${sym}${nf(rig.cost, 2)}</dd></div>
      </dl>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-3">
        <span className="mono text-[11px] text-mute">${fmtDate(rig.created)}</span>
        <div className="flex flex-wrap gap-1.5">
          <${M.button} whileTap=${{ scale: 0.95 }} type="button" className="btn btn-ghost btn-sm" onClick=${() => onLoad(rig)} aria-label=${'Load ' + rig.name + ' into the calculator'}><${Icon} n="Upload" size=${14} />Load<//>
          ${canSync && html`<${M.button} whileTap=${{ scale: 0.95 }} type="button" className="btn btn-ghost btn-sm" onClick=${() => onSync(rig)} aria-label=${'Sync ' + rig.name + ' to Neon'}><${Icon} n="Cloud" size=${14} />Sync<//>`}
          <${M.button} whileTap=${{ scale: 0.95 }} type="button" className="btn btn-ghost btn-danger btn-sm" data-armed=${armed}
            onClick=${() => { if (armed) onDelete(rig); else setArmed(true); }} aria-label=${(armed ? 'Confirm delete ' : 'Delete ') + rig.name}>
            <${Icon} n="Trash2" size=${14} />${armed ? 'Confirm?' : 'Delete'}
          <//>
        </div>
      </div>
    <//>`;
}

function RigsTab({ calc, u, draft, setDraft, rigs, net, actions }) {
  const [err, setErr] = useState('');
  const unsynced = rigs.filter((r) => !r.example && r.sync !== 'synced' && r.sync !== 'syncing');
  const sym = CURRENCIES[u.currency].sym;
  const submit = (withSync) => {
    const name = draft.name.trim();
    if (!name) { setErr('Give the rig a name before saving.'); return; }
    setErr('');
    actions.add(name, draft.desc.trim(), withSync);
  };
  return html`
    <${M.div} className="grid gap-4" variants=${stagger} initial="hidden" animate="show">
      <${Card} title="Save this build" icon="Save">
        <form className="grid gap-4 lg:grid-cols-12" onSubmit=${(e) => { e.preventDefault(); submit(false); }}>
          <div className="grid min-w-0 gap-3 lg:col-span-7">
            <div>
              <label htmlFor="rigName" className="text-sm font-medium">Rig name</label>
              <input id="rigName" className="field mt-1.5" maxLength="80" placeholder="Weekend render box" value=${draft.name}
                onChange=${(e) => { setDraft({ ...draft, name: e.target.value }); if (err) setErr(''); }} aria-invalid=${err ? 'true' : 'false'} aria-describedby="rigErr" />
              <p id="rigErr" role="alert" className="mt-1 min-h-[1rem] text-xs" style=${{ color: 'rgb(var(--crit))' }}>${err}</p>
            </div>
            <div>
              <label htmlFor="rigDesc" className="text-sm font-medium">Description</label>
              <textarea id="rigDesc" className="field mt-1.5" maxLength="240" placeholder="What it is for, which case, what you would change" value=${draft.desc}
                onChange=${(e) => setDraft({ ...draft, desc: e.target.value })}></textarea>
            </div>
          </div>
          <div className="flex min-w-0 flex-col justify-between gap-4 lg:col-span-5">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="label">Current build</div>
              <div className="mono tabular mt-2 grid grid-cols-3 gap-2 text-sm">
                <div><div className="text-[10px] text-mute">DRAW</div>${nf(calc.base)} W</div>
                <div><div className="text-[10px] text-mute">BTU/HR</div>${nf(calc.btu)}</div>
                <div><div className="text-[10px] text-mute">PER MONTH</div>${sym}${nf(u.cost, 2)}</div>
              </div>
              <p className="mono mt-3 break-words text-[11px] leading-relaxed text-mute">${calc.cpu.name}<br />${calc.gpu.name}</p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <${M.button} whileTap=${{ scale: 0.96 }} type="submit" className="btn btn-ghost"><${Icon} n="Save" size=${16} />Save locally<//>
              <${M.button} whileTap=${{ scale: 0.96 }} type="button" className="btn btn-primary" onClick=${() => submit(true)}><${Icon} n="Cloud" size=${16} />Save and sync to Neon<//>
            </div>
          </div>
        </form>
        <p className="mt-3 text-xs leading-relaxed text-mute">
          ${net === 'neon'
            ? 'Neon answered, so Save and sync stores a summary row in your database. The description stays in this browser.'
            : 'Neon is not reachable from here, so a sync attempt keeps the rig in this browser and marks it pending. On your deployed Netlify site it goes through.'}
        </p>
      <//>

      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <h2 className="font-display text-base font-medium">Saved rigs <span className="chip tabular ml-1">${rigs.length}</span></h2>
        ${unsynced.length > 0 && html`
          <${M.button} whileTap=${{ scale: 0.96 }} type="button" className="btn btn-ghost btn-sm" onClick=${() => actions.syncAll(unsynced)}>
            <${Icon} n="RefreshCw" size=${14} />Sync ${unsynced.length} unsynced
          <//>`}
      </div>

      ${rigs.length === 0
        ? html`<${M.div} variants=${rise} className="panel p-8 text-center"><p className="font-display text-sm">Nothing saved yet</p><p className="mx-auto mt-2 max-w-[44ch] text-sm text-mute">Name the build above and save it. It appears here with its wattage, BTU/hr and monthly cost.</p><//>`
        : html`
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <${AnimatePresence}>
              ${rigs.map((r) => html`<${RigCard} key=${r.id} rig=${r} onLoad=${actions.load} onSync=${actions.sync} onDelete=${actions.remove} />`)}
            <//>
          </div>`}
      <p className="px-1 text-xs text-mute">Delete removes the copy in this browser. Rows already synced to Neon stay there until the site owner removes them.</p>
    <//>`;
}

/* ---------- privacy policy ---------- */

const POLICY = [
  { h: 'What this app is', p: ['RigThermal estimates the power draw, heat output and electricity cost of a PC build. It is a web page plus one optional serverless function that stores build summaries in a database.'] },
  { h: 'Information you enter', p: ['You choose hardware, daily usage hours and an electricity rate. If you save a rig, you also type a name and a description.', 'The app does not ask for an account, email address, phone number, real name or payment details.'] },
  { h: 'Calculations happen on your device', p: ['Every formula runs in your browser. Changing a dropdown, stepper or slider does not send anything over the network.'] },
  { h: 'Saved on your device', p: ['Saved rigs and your last calculator settings are kept in your browser LocalStorage for this site. Other websites cannot read them.', 'They stay until you delete a rig, clear site data, or your browser clears them. Private windows may not keep them at all.'] },
  { h: 'Neon database sync', p: ['Sync is opt-in. Only when you press Save and sync to Neon, or Sync on a saved rig, the page sends the rig name, CPU name, GPU name, total wattage, BTU/hr and monthly cost estimate. The database adds an ID and a timestamp.', 'The description is never sent. Rows are stored in a Neon Postgres database owned by whoever deployed this app, in the region they picked.', 'Rows are not tied to an account, a cookie or a device ID, and the function does not write your IP address or browser details into the table. Because there are no accounts, the person who runs the database can read every row. Do not put personal information in a rig name.', 'Deleting a rig inside the app removes only the local copy. To remove a synced row, ask the site operator.'] },
  { h: 'Hosting and third parties', p: ['Netlify hosts the page and runs the function. Like most hosts, it may log request details such as IP address, browser type and time under its own policy. Neon stores synced rows on the operator’s behalf.', 'The page loads fonts from Google Fonts and scripts from public CDNs (cdnjs, jsDelivr and the Tailwind CDN). Those services can see your IP address and browser details when the page loads. An operator who wants to avoid that can host these files themselves.'] },
  { h: 'No personal tracking', p: ['The app has no analytics, advertising, tracking pixels, fingerprinting or profiling, and it sets no cookies of its own. Nothing is sold or shared for marketing.'] },
  { h: 'Retention', p: ['Local data lasts until you remove it. Synced rows last until the operator deletes them. There is no automatic expiry.'] },
  { h: 'Security', p: ['Traffic uses HTTPS. The database connection string lives in a Netlify environment variable and is only used by the server function, never sent to your browser. The function checks and length-limits every field and accepts inserts only. No system is perfectly secure, so keep sensitive details out of rig names.'] },
  { h: 'Children', p: ['The app is not aimed at children and is designed to work without collecting personal details.'] },
  { h: 'Your choices', p: ['You can use the calculator without saving anything, save locally without syncing, delete any rig, and clear site data in your browser at any time.', 'Depending on where you live, laws such as the Philippines Data Privacy Act of 2012 or the GDPR may give you further rights over synced rows. The operator is responsible for handling those requests.'] },
  { h: 'Changes and contact', p: ['If this policy changes, the date at the top changes with it. The operator of this deployment handles privacy requests. Replace this line with their contact email before publishing the site.'] },
];

function PrivacyTab() {
  const glance = [
    ['Cpu', 'Math runs on your device'],
    ['UserX', 'No accounts or sign-in'],
    ['EyeOff', 'No analytics or ad trackers'],
    ['CloudUpload', 'Sync only when you press it'],
  ];
  return html`
    <${M.div} className="grid gap-4" variants=${stagger} initial="hidden" animate="show">
      <${M.section} variants=${rise} className="panel p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-lg font-medium">Privacy Policy</h2>
          <span className="mono text-xs text-mute">Last updated October 24, 2026</span>
        </div>
        <ul className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          ${glance.map((g) => html`
            <li key=${g[0]} className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3 text-sm">
              <span style=${{ color: 'rgb(var(--ember))' }}><${Icon} n=${g[0]} size=${17} /></span>${g[1]}
            </li>`)}
        </ul>
      <//>

      <${Card} title="Where your data lives" icon="Database">
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Data</th><th>Stored in</th><th>Leaves your device?</th><th>Removed by</th></tr></thead>
            <tbody>
              <tr><td>Calculator settings</td><td>Browser LocalStorage</td><td>No</td><td>You, by clearing site data</td></tr>
              <tr><td>Saved rigs, including descriptions</td><td>Browser LocalStorage</td><td>No</td><td>You, with Delete</td></tr>
              <tr><td>Synced rig summary (no description)</td><td>Operator’s Neon database</td><td>Only when you press Sync</td><td>The site operator</td></tr>
            </tbody>
          </table>
        </div>
      <//>

      <${M.section} variants=${rise} className="panel policy grid gap-6 p-5 sm:p-6">
        ${POLICY.map((s) => html`
          <section key=${s.h}>
            <h3>${s.h}</h3>
            ${s.p.map((t, i) => html`<p key=${i} className="mt-2 text-sm leading-relaxed">${t}</p>`)}
          </section>`)}
      <//>
    <//>`;
}

/* ---------- storage and sync helpers ---------- */

function loadJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch (e) { return null; }
}
function saveJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ }
}

function makeRig(name, desc, calc, u, extra) {
  return Object.assign({
    id: uid(), name: name, desc: desc, cfg: calc.cfg,
    cpu: calc.cpu.name, gpu: calc.gpu.name,
    base: Math.round(calc.base), rec: Math.round(calc.rec),
    btu: round1(calc.btu), cost: round2(u.cost),
    currency: u.currency, hours: u.hours, rate: u.rate,
    created: new Date().toISOString(), sync: 'local', example: false,
  }, extra || {});
}

function seedExamples() {
  const mk = (name, desc, cfg, hours) => {
    const calc = calcBuild(cfg);
    const cost = calcCost(calc.rec, hours, CURRENCIES.PHP.rate).cost;
    return makeRig(name, desc, calc, { cost: cost, currency: 'PHP', hours: hours, rate: CURRENCIES.PHP.rate }, { example: true });
  };
  return [
    mk('Office 5600G', 'Integrated graphics, one NVMe drive, two quiet case fans.',
      { cpu: 'r5-5600g', gpu: 'igpu', board: 'itx', ramType: 'ddr4', ramCount: 2, nvme: 1, ssd: 0, hdd: 0, aio: 0, fans: 2 }, 8),
    mk('Living-room 4070', 'Compact gaming build with an AIO and DDR5.',
      { cpu: 'i7-12700k', gpu: 'rtx-4070', board: 'atx', ramType: 'ddr5', ramCount: 2, nvme: 2, ssd: 0, hdd: 0, aio: 1, fans: 4 }, 4),
  ];
}

async function pushToNeon(rig) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: rig.name, 
        cpu: rig.cpu, 
        gpu: rig.gpu,
        total_wattage: rig.base, 
        btu_hr: rig.btu, 
        monthly_cost: rig.cost,
      }),
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => ({}));
    
    // ✅ Check res.ok (HTTP 200-299) and accept returned record ID or data.id
    if (!res.ok) return { ok: false, error: data.error || 'HTTP ' + res.status };
    return { ok: true, id: data.id || data.id };
  } catch (e) {
    return { ok: false, error: e && e.name === 'AbortError' ? 'Timed out' : 'Not reachable' };
  } finally {
    clearTimeout(timer);
  }
}
async function pingNeon() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(API, { method: 'GET', signal: ctrl.signal });
    return res.ok; // ✅ Checks for HTTP 200 OK
  } catch (e) { 
    return false; 
  } finally { 
    clearTimeout(timer); 
  }
}

/* ---------- app ---------- */

function Toast({ toast }) {
  return html`
    <div className="toast" aria-live="polite">
      <${AnimatePresence}>
        ${toast && html`
          <${M.div} key=${toast.id} className=${'toast-card' + (toast.tone === 'warn' ? ' toast-warn' : '')}
            initial=${{ opacity: 0, y: 20, scale: 0.96 }} animate=${{ opacity: 1, y: 0, scale: 1 }} exit=${{ opacity: 0, y: 12 }}>
            <${Icon} n=${toast.tone === 'warn' ? 'Info' : 'Check'} size=${16} />${toast.msg}
          <//>`}
      <//>
    </div>`;
}

function App() {
  const sess = useMemo(() => loadJSON(LS_SESSION) || {}, []);
  const [tab, setTab] = useState('calc');
  const [cfg, setCfg] = useState(() => normalizeCfg(sess.cfg));
  const [currency, setCurrency] = useState(sess.currency === 'USD' ? 'USD' : 'PHP');
  const [hoursStr, setHoursStr] = useState(String(sess.hours != null ? sess.hours : 8));
  const [rateStr, setRateStr] = useState(String(sess.rate != null ? sess.rate : CURRENCIES[sess.currency === 'USD' ? 'USD' : 'PHP'].rate));
  const [rigs, setRigs] = useState(() => { const s = loadJSON(LS_RIGS); return Array.isArray(s) ? s : seedExamples(); });
  const [draft, setDraft] = useState({ name: '', desc: '' });
  const [net, setNet] = useState('checking');
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const hours = clamp(parseFloat(hoursStr) || 0, 0, 24);
  const rate = Math.max(0, parseFloat(rateStr) || 0);
  const calc = useMemo(() => calcBuild(cfg), [cfg]);
  const u = useMemo(() => {
    const c = calcCost(calc.rec, hours, rate);
    const tierPick = pickTier(calc.rec, hours);
    return {
      hours, rate, currency, kwh: c.kwh, cost: c.cost, tierPick,
      saving: tierSaving(c.kwh, tierPick.tier, rate),
    };
  }, [calc, hours, rate, currency]);

  useEffect(() => { saveJSON(LS_RIGS, rigs); }, [rigs]);
  useEffect(() => { saveJSON(LS_SESSION, { cfg: cfg, currency: currency, hours: hours, rate: rate }); }, [cfg, currency, hours, rate]);
  useEffect(() => { let live = true; pingNeon().then((ok) => { if (live) setNet(ok ? 'neon' : 'local'); }); return () => { live = false; }; }, []);

  const notify = (msg, tone) => {
    clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), msg: msg, tone: tone || 'ok' });
    toastTimer.current = setTimeout(() => setToast(null), 3600);
  };

  const patchRig = (id, patch) => setRigs((prev) => prev.map((r) => (r.id === id ? Object.assign({}, r, patch) : r)));

  const syncOne = async (rig, quiet) => {
    patchRig(rig.id, { sync: 'syncing' });
    const res = await pushToNeon(rig);
    if (res.ok) {
      patchRig(rig.id, { sync: 'synced' });
      setNet('neon');
      if (!quiet) notify('Synced ' + rig.name + ' to Neon.');
    } else {
      patchRig(rig.id, { sync: 'pending' });
      if (!quiet) notify('Saved locally. Neon sync failed (' + res.error + '), try again from the card.', 'warn');
    }
    return res.ok;
  };

  const actions = {
    add: (name, desc, withSync) => {
      const rig = makeRig(name, desc, calc, u);
      setRigs((prev) => [rig, ...prev]);
      setDraft({ name: '', desc: '' });
      if (withSync) syncOne(rig, false); else notify('Saved ' + name + ' in this browser.');
    },
    sync: (rig) => syncOne(rig, false),
    syncAll: async (list) => {
      let okCount = 0;
      for (const r of list) { if (await syncOne(r, true)) okCount += 1; }
      notify(okCount + ' of ' + list.length + ' rigs synced.', okCount === list.length ? 'ok' : 'warn');
    },
    remove: (rig) => {
      setRigs((prev) => prev.filter((r) => r.id !== rig.id));
      notify(rig.sync === 'synced' ? 'Removed locally. The Neon row stays until the site owner deletes it.' : 'Removed ' + rig.name + '.');
    },
    load: (rig) => {
      setCfg(normalizeCfg(rig.cfg));
      const cur = rig.currency === 'USD' ? 'USD' : 'PHP';
      setCurrency(cur);
      setHoursStr(String(rig.hours));
      setRateStr(String(rig.rate));
      setTab('calc');
      notify('Loaded ' + rig.name + ' into the calculator.');
    },
  };

  const ctl = {
    hoursStr, setHoursStr, rateStr, setRateStr,
    changeCurrency: (c) => { setCurrency(c); setRateStr(String(CURRENCIES[c].rate)); },
  };

  return html`
    <${MotionConfig} reducedMotion="user">
      <div className="shell">
        <${Header} tab=${tab} setTab=${setTab} rigCount=${rigs.length} net=${net} />
        <${AnimatePresence} mode="wait">
          <${M.main} key=${tab} id="panel" role="tabpanel" aria-labelledby=${'tab-' + tab} className="mt-5"
            initial=${{ opacity: 0, y: 14 }} animate=${{ opacity: 1, y: 0 }} exit=${{ opacity: 0, y: -8 }} transition=${{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}>
            ${tab === 'calc' && html`<${CalcTab} cfg=${cfg} setField=${(k, v) => setCfg((c) => Object.assign({}, c, { [k]: v }))} calc=${calc} />`}
            ${tab === 'psu' && html`<${PsuTab} calc=${calc} u=${u} ctl=${ctl} />`}
            ${tab === 'rigs' && html`<${RigsTab} calc=${calc} u=${u} draft=${draft} setDraft=${setDraft} rigs=${rigs} net=${net} actions=${actions} />`}
            ${tab === 'privacy' && html`<${PrivacyTab} />`}
          <//>
        <//>
        <footer className="mt-8 px-1 text-xs text-mute">RigThermal gives estimates for planning. Check part datasheets before buying a PSU.</footer>
      </div>
      <${Toast} toast=${toast} />
    <//>`;
}

ReactDOM.createRoot(document.getElementById('root')).render(html`<${App} />`);

})();
