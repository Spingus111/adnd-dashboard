import assert from "node:assert/strict";
import test from "node:test";

import {
  CURRENCY_BY_CODE,
  currencyBreakdownFromGp,
  currencyCodeFromName,
  formatGpAsCurrency,
  formatGpAsPrice,
  gpToCopperPieces,
} from "../app/currency.ts";

test("AD&D coin values use gold as the base unit", () => {
  assert.equal(CURRENCY_BY_CODE.cp.gpValue * 10, CURRENCY_BY_CODE.sp.gpValue);
  assert.equal(CURRENCY_BY_CODE.sp.gpValue * 20, CURRENCY_BY_CODE.gp.gpValue);
  assert.equal(CURRENCY_BY_CODE.ep.gpValue * 2, CURRENCY_BY_CODE.gp.gpValue);
  assert.equal(CURRENCY_BY_CODE.pp.gpValue, CURRENCY_BY_CODE.gp.gpValue * 5);
  assert.equal(gpToCopperPieces(1), 200);
});

test("treasure denomination breakdown retains pp and ep", () => {
  assert.deepEqual(currencyBreakdownFromGp(6.655), { pp: 1, gp: 1, ep: 1, sp: 3, cp: 1 });
  assert.equal(formatGpAsCurrency(6.655), "1 pp 1 gp 1 ep 3 sp 1 cp");
  assert.equal(formatGpAsCurrency(0, "Free"), "Free");
});

test("ordinary prices and change use gp, sp, and cp only", () => {
  assert.equal(formatGpAsPrice(6.655), "6 gp 13 sp 1 cp");
  assert.equal(formatGpAsPrice(.5), "10 sp");
});

test("legacy and emoji coin names identify their AD&D denomination", () => {
  assert.equal(currencyCodeFromName("🥇 Gold Coins"), "gp");
  assert.equal(currencyCodeFromName("sp"), "sp");
  assert.equal(currencyCodeFromName("Electrum pieces"), "ep");
  assert.equal(currencyCodeFromName("Platinum Coins (pp)"), "pp");
});
