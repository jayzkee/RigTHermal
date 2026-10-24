import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const src = readFileSync(new URL('../public/logic.js', import.meta.url), 'utf8');
const api = new Function(src + '; return { calcBuild, calcCost, pickTier, tierSaving, loadBand, normalizeCfg, DEFAULT_CFG, CPUS, GPUS, TIERS, BTU_PER_WATT };')();
const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, a + ' vs ' + b);

// Default build: 65 + 170 + 45 + (2x3) + (7 + 9) + (3x3) = 311 W
const c = api.calcBuild(api.DEFAULT_CFG);
near(c.base, 311); near(c.rec, 373.2); near(c.btu, 373.2 * 3.41214);
assert.equal(c.psu, 450); near(c.load, 311 / 450);
// 8 h/day at 12 PHP/kWh
const k = api.calcCost(c.rec, 8, 12);
near(k.kwh, 373.2 * 8 * 30 / 1000); near(k.cost, k.kwh * 12);
console.log('default build', Math.round(c.base), 'W,', c.rec.toFixed(1), 'W PSU,', c.btu.toFixed(1), 'BTU/hr,', k.kwh.toFixed(3), 'kWh,', k.cost.toFixed(2), 'PHP');
// Dataset spot checks from the brief
const w = (list, id) => list.find((x) => x.id === id).w;
assert.equal(w(api.CPUS, 'r5-5600g'), 65); assert.equal(w(api.CPUS, 'r7-5700x'), 65);
assert.equal(w(api.CPUS, 'i7-12700k'), 125); assert.equal(w(api.CPUS, 'xeon-2680v4'), 120);
assert.equal(w(api.GPUS, 'rx-580'), 185); assert.equal(w(api.GPUS, 'rtx-3060'), 170);
assert.equal(w(api.GPUS, 'rtx-4070'), 200); assert.equal(w(api.GPUS, 'igpu'), 0);
// Tier rules and normalization
assert.equal(api.pickTier(373.2, 8).tier.id, 'gold');
assert.equal(api.pickTier(200, 3).tier.id, 'bronze');
assert.equal(api.pickTier(800, 2).tier.id, 'platinum');
assert.equal(api.pickTier(300, 14).tier.id, 'platinum');
const bad = api.normalizeCfg({ cpu: 'nope', fans: 99, hdd: -3, ramCount: 'x' });
assert.equal(bad.cpu, api.DEFAULT_CFG.cpu); assert.equal(bad.fans, 12); assert.equal(bad.hdd, 0); assert.equal(bad.ramCount, 2);
near(api.tierSaving(100, api.TIERS[0], 1).kwh, 0);
assert.ok(api.tierSaving(100, api.TIERS[1], 1).kwh > 0);
// Largest allowed build still inside the meter scales
const big = api.calcBuild({ cpu: 'r9-7950x', gpu: 'rtx-4080', board: 'atx-hi', ramType: 'ddr5', ramCount: 8, nvme: 4, ssd: 6, hdd: 6, aio: 2, fans: 12 });
console.log('max build', big.base, 'W,', big.btu.toFixed(0), 'BTU/hr, psu', big.psu);
assert.ok(big.base <= 1000 && big.btu <= 4200);
console.log('ALL LOGIC CHECKS PASSED');
