import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { evaluateSeafoodChecks } from "./seafood-rules.mjs";

const orders = JSON.parse(await readFile(new URL("../data/shipments.json", import.meta.url), "utf8"));
assert.equal(orders.length, 500);
assert.equal(new Set(orders.map((row) => row.id)).size, 500);
assert.equal(orders.filter((row) => row.product === "SHRIMP").length, 250);
assert.equal(orders.filter((row) => row.product === "PANGASIUS").length, 250);
assert.equal(orders.reduce((sum, row) => sum + row.containers.length, 0), 550);
assert(orders.every((row) => row.status !== "COMPLETED" || row.checks.every((entry) => entry.status === "PASS")));
const tasks = orders.flatMap((row) => row.tasks);
const taskStatuses = Object.fromEntries(["OPEN", "IN_PROGRESS", "DONE"].map((status) => [status, tasks.filter((task) => task.status === status).length]));
assert(Object.values(taskStatuses).every((count) => count > 0));
const departmentByCode = {
  SI_CONFIRMED: "Bộ phận Chứng từ", SEAL_SI_MATCH: "Bộ phận Chứng từ",
  CERT_CONFIRMED: "Bộ phận Chứng từ", FACTORY_EVIDENCE: "Bộ phận Chứng từ", LOT_TRACE: "Bộ phận Chứng từ",
  VGM_CONFIRMED: "Bộ phận Vận tải / Hiện trường", REEFER_SETPOINT: "Bộ phận Vận tải / Hiện trường",
  PRODUCT_SPEC: "Bộ phận Kiểm soát chất lượng", LAB_RESIDUE: "Bộ phận Kiểm soát chất lượng",
  LAB_SULFITE: "Bộ phận Kiểm soát chất lượng", LAB_MICROBIOLOGY: "Bộ phận Kiểm soát chất lượng",
  CARGO_TEMP: "Bộ phận Kiểm soát chất lượng",
};
assert(tasks.every((task) => task.assigneeName === departmentByCode[task.sourceCheckCode]));
for (const row of orders) {
  for (const task of row.tasks.filter((item) => item.status === "DONE")) {
    assert.equal(row.checks.find((item) => item.code === task.sourceCheckCode)?.status, "PASS");
    assert(row.documents.some((document) => document.id === task.evidenceDocumentId && document.status === "VERIFIED"));
  }
  assert.equal(row.assigneeName, row.tasks.find((task) => task.status !== "DONE")?.assigneeName ?? null);
}
for (const row of orders) {
  const evaluated = evaluateSeafoodChecks(row.seafoodProfile, row.containers, Date.parse("2026-10-06T02:00:00.000Z"), row.cutoffs.cy);
  for (const check of evaluated) assert.deepEqual(row.checks.find((entry) => entry.code === check.code), check);
}

const sample = orders.find((row) => row.product === "SHRIMP" && row.seafoodProfile.marketCode === "US");
assert(sample);
const checked = (profile, containers) => evaluateSeafoodChecks(profile, containers, Date.parse("2026-10-06T02:00:00.000Z"), sample.cutoffs.cy);
const withoutProbe = sample.containers.map((container) => ({ ...container, temperatureReadings: container.temperatureReadings.filter((reading) => reading.source === "RETURN_AIR") }));
assert.equal(checked(sample.seafoodProfile, withoutProbe).find((row) => row.code === "CARGO_TEMP").status, "MISSING");
const warm = sample.containers.map((container, index) => ({ ...container, temperatureReadings: index === 0 ? [
  ...container.temperatureReadings, { observedAt: "2026-10-06T01:00:00.000Z", source: "CARGO_PROBE", celsius: -12, sensorId: "TEST" },
] : container.temperatureReadings }));
assert.equal(checked(sample.seafoodProfile, warm).find((row) => row.code === "CARGO_TEMP").status, "MISMATCH");
assert.equal(checked({ ...sample.seafoodProfile, packingListLotCode: "WRONG" }, sample.containers).find((row) => row.code === "LOT_TRACE").status, "MISMATCH");
assert(checked(sample.seafoodProfile, sample.containers).some((row) => row.code === "LAB_SULFITE"));
const fish = orders.find((row) => row.product === "PANGASIUS" && row.seafoodProfile.glazePercent !== null);
assert(fish);
assert.equal(evaluateSeafoodChecks({ ...fish.seafoodProfile, glazePercent: 25 }, fish.containers, Date.parse("2026-10-06T02:00:00.000Z"), fish.cutoffs.cy).find((row) => row.code === "PRODUCT_SPEC").status, "MISMATCH");
console.log(`Verified 500 orders, 550 containers, team routing, evidence, and task states: ${JSON.stringify(taskStatuses)}.`);
