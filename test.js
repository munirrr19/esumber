// Jalankan: npm test. D1 ditiru dengan node:sqlite (API prepare/bind/run/all/first yang sama).
import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import worker from "./worker.js";
import config from "./config.json" with { type: "json" };

const sqlite = new DatabaseSync(":memory:");
sqlite.exec(fs.readFileSync("./schema.sql", "utf8"));
const DB = {
  prepare: (sql) => {
    const st = sqlite.prepare(sql);
    const mk = (args) => ({
      run: async () => { const r = st.run(...args); return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }; },
      all: async () => ({ results: st.all(...args) }),
      first: async () => st.get(...args) ?? null,
    });
    return { ...mk([]), bind: (...args) => mk(args) };
  },
  batch: async (sts) => { const out = []; for (const s of sts) out.push(await s.run()); return out; },
};
const env = { DB, ADMIN_KEY: "rahsia", MAX_AHEAD: "100000" }; // ujian lain guna tarikh 2099
const pending = [];
const ctx = { waitUntil: (p) => pending.push(p) };
const call = async (method, path, body, headers = {}) => {
  const r = await worker.fetch(new Request("http://x" + path, { method, headers: { "Content-Type": "application/json", ...headers }, body: body && JSON.stringify(body) }), env, ctx);
  return { status: r.status, body: await r.json().catch(() => null) };
};
sqlite.exec("INSERT INTO teachers (nama) VALUES ('Guru Ujian')");
const base = { nama: "Guru Ujian", tujuan: "Mesyuarat", room: config.rooms[0], date: "2099-01-05", start: "09:00", end: "10:00", peserta: "10" };

test("tempahan clash ditolak, bersebelahan dibenarkan", async () => {
  assert.equal((await call("POST", "/api/bookings", base)).status, 201);
  assert.equal((await call("POST", "/api/bookings", { ...base, start: "09:30", end: "10:30" })).status, 409); // separa
  assert.equal((await call("POST", "/api/bookings", { ...base, start: "08:00", end: "11:00" })).status, 409); // meliputi
  assert.equal((await call("POST", "/api/bookings", { ...base, start: "09:15", end: "09:45" })).status, 409); // dalam
  assert.equal((await call("POST", "/api/bookings", { ...base, start: "10:00", end: "11:00" })).status, 201); // sambung
  assert.equal((await call("POST", "/api/bookings", { ...base, start: "08:00", end: "09:00" })).status, 201);
  assert.equal((await call("POST", "/api/bookings", { ...base, room: config.rooms[1] })).status, 201); // bilik lain
  assert.equal((await call("POST", "/api/bookings", { ...base, date: "2099-01-06" })).status, 201); // hari lain
});

test("validasi", async () => {
  for (const bad of [{ start: "11:00", end: "10:00" }, { date: "2020-01-01" }, { room: "Dewan Lain" }, { nama: "Orang Lain" }, { start: "06:00" }, { end: "23:00" }, { tujuan: "" }]) {
    assert.equal((await call("POST", "/api/bookings", { ...base, date: "2099-02-01", ...bad })).status, 400, JSON.stringify(bad));
  }
});

test("senarai dan batal (admin)", async () => {
  const q = "/api/bookings?room=" + encodeURIComponent(base.room) + "&date=2099-01-05";
  const list = await call("GET", q);
  assert.equal(list.body.length, 3);
  const id = list.body[0].id;
  assert.equal((await call("GET", "/api/admin/check", null, { "x-admin-key": "salah" })).status, 403);
  assert.equal((await call("GET", "/api/admin/check", null, { "x-admin-key": "rahsia" })).status, 200);
  assert.equal((await call("DELETE", "/api/bookings/" + id, null, { "x-admin-key": "salah" })).status, 403);
  assert.equal((await call("DELETE", "/api/bookings/" + id, null, { "x-admin-key": "rahsia" })).status, 200);
  assert.equal((await call("GET", q)).body.length, 2);
});

test("urus guru (admin sahaja)", async () => {
  const A = { "x-admin-key": "rahsia" };
  assert.equal((await call("POST", "/api/teachers", { nama: "Guru Baru" })).status, 403);
  assert.equal((await call("POST", "/api/teachers", { nama: "  " }, A)).status, 400);
  const add = await call("POST", "/api/teachers", { nama: "Guru Baru" }, A);
  assert.equal(add.status, 201);
  assert.equal((await call("POST", "/api/teachers", { nama: "Guru Baru" }, A)).status, 409);
  assert.ok((await call("GET", "/api/config")).body.names.includes("Guru Baru"));
  assert.equal((await call("POST", "/api/bookings", { ...base, nama: "Guru Baru", date: "2099-03-03" })).status, 201);
  assert.equal((await call("DELETE", "/api/teachers/" + add.body.id)).status, 403);
  assert.equal((await call("DELETE", "/api/teachers/" + add.body.id, null, A)).status, 200);
  assert.ok(!(await call("GET", "/api/config")).body.names.includes("Guru Baru"));
  assert.equal((await call("POST", "/api/bookings", { ...base, nama: "Guru Baru", date: "2099-03-04" })).status, 400);
});

test("edit nama guru", async () => {
  const A = { "x-admin-key": "rahsia" };
  const id = (await call("POST", "/api/teachers", { nama: "Guru Salah" }, A)).body.id;
  await call("POST", "/api/teachers", { nama: "Guru Lain" }, A);
  await call("POST", "/api/bookings", { ...base, nama: "Guru Salah", date: "2099-04-04" });
  assert.equal((await call("PUT", "/api/teachers/" + id, { nama: "Guru Betul" })).status, 403);
  assert.equal((await call("PUT", "/api/teachers/" + id, { nama: "" }, A)).status, 400);
  assert.equal((await call("PUT", "/api/teachers/" + id, { nama: "Guru Lain" }, A)).status, 409);
  assert.equal((await call("PUT", "/api/teachers/99999", { nama: "X" }, A)).status, 404);
  assert.equal((await call("PUT", "/api/teachers/" + id, { nama: "Guru Betul" }, A)).status, 200);
  const names = (await call("GET", "/api/config")).body.names;
  assert.ok(names.includes("Guru Betul") && !names.includes("Guru Salah"));
  const b = (await call("GET", "/api/bookings?date=2099-04-04")).body;
  assert.equal(b[0].nama, "Guru Betul");
});

test("tempah beberapa hari: semua atau tiada", async () => {
  const multi = { ...base, room: config.rooms[2], date: "2099-06-01", dateEnd: "2099-06-03" };
  const ok = await call("POST", "/api/bookings", multi);
  assert.equal(ok.status, 201); assert.equal(ok.body.count, 3);
  const q = "/api/bookings?room=" + encodeURIComponent(multi.room) + "&date=2099-06-01&to=2099-06-03";
  assert.equal((await call("GET", q)).body.length, 3);
  // satu hari dalam julat bertindih -> tiada satu pun masuk
  const clash = { ...multi, date: "2099-06-03", dateEnd: "2099-06-05", start: "09:30" };
  const bad = await call("POST", "/api/bookings", clash);
  assert.equal(bad.status, 409); assert.match(bad.body.error, /03\/06\/2099/);
  assert.equal((await call("GET", "/api/bookings?room=" + encodeURIComponent(multi.room) + "&date=2099-06-04&to=2099-06-05")).body.length, 0);
  assert.equal((await call("POST", "/api/bookings", { ...multi, date: "2099-07-05", dateEnd: "2099-07-01" })).status, 400);
  assert.equal((await call("POST", "/api/bookings", { ...multi, date: "2099-08-01", dateEnd: "2099-12-01" })).status, 400);
});

test("had tarikh ke hadapan", async () => {
  env.MAX_AHEAD = "30";
  try {
    assert.equal((await call("POST", "/api/bookings", { ...base, date: "2099-05-05" })).status, 400);
    const in10 = new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10);
    assert.equal((await call("POST", "/api/bookings", { ...base, room: config.rooms[4], date: in10 })).status, 201);
    assert.equal((await call("POST", "/api/bookings", { ...base, room: config.rooms[5], date: in10, dateEnd: "2099-05-05" })).status, 400);
  } finally { env.MAX_AHEAD = "100000"; }
});

test("cron padam tempahan lama sahaja", async () => {
  const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  const ins = sqlite.prepare("INSERT INTO bookings (nama,tujuan,room,date,start,end,peserta) VALUES ('Guru Ujian','lama',?,?,'09:00','10:00','1')");
  const k = config.keepDays;
  ins.run("Bilik ICT", day(-k - 20)); ins.run("Bilik ICT", day(-k - 2)); ins.run("Bilik ICT", day(-k + 2)); ins.run("Bilik ICT", day(2));
  await worker.scheduled({}, env);
  const left = sqlite.prepare("SELECT date FROM bookings WHERE tujuan = 'lama' ORDER BY date").all().map((r) => r.date);
  assert.deepEqual(left, [day(-k + 2), day(2)]);
});

test("pembatalan admin dihantar ke Sheet sebagai baris DIBATALKAN", async () => {
  const sent = [], realFetch = globalThis.fetch;
  globalThis.fetch = async (u, o) => { sent.push([u, JSON.parse(o.body)]); return new Response("ok"); };
  env.SHEET_URL = "https://sheet.test/exec?k=x";
  try {
    const created = await call("POST", "/api/bookings", { ...base, room: config.rooms[1], date: "2099-11-11" });
    await Promise.all(pending.splice(0));
    assert.equal(sent.length, 1); assert.equal(sent[0][1].tujuan, "Mesyuarat");
    await call("DELETE", "/api/bookings/" + created.body.id, null, { "x-admin-key": "rahsia" });
    await Promise.all(pending.splice(0));
    assert.equal(sent.length, 2); assert.equal(sent[1][1].tujuan, "[DIBATALKAN] Mesyuarat"); assert.equal(sent[1][1].id, created.body.id);
  } finally { globalThis.fetch = realFetch; delete env.SHEET_URL; }
});
