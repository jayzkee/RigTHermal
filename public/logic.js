/* ===== RigThermal logic: data and formulas (pure, no DOM) ===== */
const HEADROOM = 1.2;
const BTU_PER_WATT = 3.41214;
const DAYS_PER_MONTH = 30;
const STANDARD_PSUS = [350, 450, 550, 650, 750, 850, 1000, 1200, 1600];
const WATT_SCALE = 1000;
const BTU_SCALE = 4200;
const HEATER_BTU = 1500 * BTU_PER_WATT;
const BTU_PER_TON = 12000;

const CPUS = [
  { id: 'r5-5600g', name: 'AMD Ryzen 5 5600G', w: 65 },
  { id: 'r5-5600x', name: 'AMD Ryzen 5 5600X', w: 65 },
  { id: 'r7-5700x', name: 'AMD Ryzen 7 5700X', w: 65 },
  { id: 'r9-5900x', name: 'AMD Ryzen 9 5900X', w: 105 },
  { id: 'r9-7950x', name: 'AMD Ryzen 9 7950X', w: 170 },
  { id: 'i5-12400', name: 'Intel Core i5-12400', w: 65 },
  { id: 'i7-12700k', name: 'Intel Core i7-12700K', w: 125 },
  { id: 'xeon-2680v4', name: 'Intel Xeon E5-2680 v4', w: 120 },
];

const GPUS = [
  { id: 'igpu', name: 'Integrated Graphics', w: 0 },
  { id: 'rtx-4060', name: 'NVIDIA RTX 4060', w: 115 },
  { id: 'gtx-1660s', name: 'NVIDIA GTX 1660 Super', w: 125 },
  { id: 'rtx-3060', name: 'NVIDIA RTX 3060', w: 170 },
  { id: 'rx-580', name: 'AMD Radeon RX 580', w: 185 },
  { id: 'rtx-4070', name: 'NVIDIA RTX 4070', w: 200 },
  { id: 'rx-6700xt', name: 'AMD Radeon RX 6700 XT', w: 230 },
  { id: 'rtx-4080', name: 'NVIDIA RTX 4080', w: 320 },
];

const BOARDS = [
  { id: 'itx', name: 'Mini-ITX or mATX board', w: 30 },
  { id: 'atx', name: 'ATX mainstream board', w: 45 },
  { id: 'atx-hi', name: 'ATX high-end or workstation board', w: 65 },
];

const RAM_TYPES = [
  { id: 'ddr4', name: 'DDR4', w: 3 },
  { id: 'ddr5', name: 'DDR5', w: 5 },
];

const STORAGE_W = { nvme: 7, ssd: 3, hdd: 9 };
const COOLING_W = { aio: 15, fans: 3 };

const CURRENCIES = {
  PHP: { id: 'PHP', sym: '₱', rate: 12 },
  USD: { id: 'USD', sym: '$', rate: 0.2 },
};

const TIERS = [
  { id: 'bronze', name: '80+ Bronze', eff: 85, color: '#E0985C' },
  { id: 'gold', name: '80+ Gold', eff: 90, color: '#FFC24B' },
  { id: 'platinum', name: '80+ Platinum', eff: 92, color: '#A9D6FF' },
];

const PART_COLORS = {
  cpu: '#6EC8FF',
  gpu: '#FF7A3D',
  board: '#8B93FF',
  ram: '#5EE6B0',
  storage: '#FFC24B',
  cooling: '#E0509E',
};

const DEFAULT_CFG = {
  cpu: 'r7-5700x', gpu: 'rtx-3060', board: 'atx',
  ramType: 'ddr4', ramCount: 2,
  nvme: 1, ssd: 0, hdd: 1,
  aio: 0, fans: 3,
};

const LIMITS = {
  ramCount: [0, 8], nvme: [0, 4], ssd: [0, 6], hdd: [0, 6], aio: [0, 2], fans: [0, 12],
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round1 = (v) => Math.round(v * 10) / 10;
const round2 = (v) => Math.round(v * 100) / 100;
const nf = (v, d = 0) =>
  Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const byId = (list, id) => list.find((x) => x.id === id) || list[0];

function normalizeCfg(c) {
  const d = Object.assign({}, DEFAULT_CFG, c || {});
  if (!CPUS.some((x) => x.id === d.cpu)) d.cpu = DEFAULT_CFG.cpu;
  if (!GPUS.some((x) => x.id === d.gpu)) d.gpu = DEFAULT_CFG.gpu;
  if (!BOARDS.some((x) => x.id === d.board)) d.board = DEFAULT_CFG.board;
  if (!RAM_TYPES.some((x) => x.id === d.ramType)) d.ramType = DEFAULT_CFG.ramType;
  Object.keys(LIMITS).forEach((k) => {
    const n = Math.round(Number(d[k]));
    d[k] = Number.isFinite(n) ? clamp(n, LIMITS[k][0], LIMITS[k][1]) : DEFAULT_CFG[k];
  });
  return d;
}

/* Base System TDP = sum of component wattages
   Recommended PSU = Base x 1.20
   Thermal output (BTU/hr) = Recommended x 3.41214 */
function calcBuild(input) {
  const cfg = normalizeCfg(input);
  const cpu = byId(CPUS, cfg.cpu);
  const gpu = byId(GPUS, cfg.gpu);
  const board = byId(BOARDS, cfg.board);
  const ramType = byId(RAM_TYPES, cfg.ramType);
  const parts = [
    { key: 'cpu', label: 'CPU', w: cpu.w },
    { key: 'gpu', label: 'GPU', w: gpu.w },
    { key: 'board', label: 'Board', w: board.w },
    { key: 'ram', label: 'Memory', w: ramType.w * cfg.ramCount },
    { key: 'storage', label: 'Storage', w: cfg.nvme * STORAGE_W.nvme + cfg.ssd * STORAGE_W.ssd + cfg.hdd * STORAGE_W.hdd },
    { key: 'cooling', label: 'Cooling', w: cfg.aio * COOLING_W.aio + cfg.fans * COOLING_W.fans },
  ];
  const base = parts.reduce((s, p) => s + p.w, 0);
  const rec = base * HEADROOM;
  const btu = rec * BTU_PER_WATT;
  const psu = STANDARD_PSUS.find((s) => s >= rec) || null;
  const load = psu ? base / psu : 1;
  return { cfg, cpu, gpu, board, ramType, parts, base, rec, btu, psu, load };
}

/* Monthly kWh = recommended W x hours x 30 / 1000 */
function calcCost(recWatts, hours, rate) {
  const kwh = (recWatts * hours * DAYS_PER_MONTH) / 1000;
  return { kwh, cost: kwh * rate };
}

function pickTier(rec, hours) {
  const h = nf(hours, hours % 1 ? 1 : 0);
  if (hours >= 12 || rec >= 750) {
    return {
      tier: TIERS[2],
      why: hours >= 12
        ? 'At ' + h + ' h a day, the efficiency gain repays the higher price.'
        : 'Above 750 W, each point of efficiency removes a lot of waste heat.',
    };
  }
  if (hours >= 6 || rec >= 450) {
    return {
      tier: TIERS[1],
      why: hours >= 6
        ? 'At ' + h + ' h a day, Gold is the usual balance of price and wall draw.'
        : 'A ' + Math.round(rec) + ' W build suits Gold even at lighter use.',
    };
  }
  return {
    tier: TIERS[0],
    why: 'Light daily use on a modest build. A higher tier takes a long time to recover its extra cost.',
  };
}

/* Wall-draw saving versus an 80+ Bronze unit at the same load */
function tierSaving(kwh, tier, rate) {
  const bronze = TIERS[0].eff / 100;
  const t = tier.eff / 100;
  const saved = kwh * (1 / bronze - 1 / t);
  return { kwh: saved, cost: saved * rate };
}

function loadBand(load) {
  if (load > 0.9) return { label: 'Too tight', tone: 'crit' };
  if (load > 0.8) return { label: 'Tight', tone: 'warn' };
  if (load >= 0.3) return { label: 'Good range', tone: 'ok' };
  return { label: 'Oversized', tone: 'warn' };
}
