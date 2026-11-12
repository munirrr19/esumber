const $ = (id) => document.getElementById(id);
const store = { get: () => { try { return sessionStorage.getItem("k") || ""; } catch { return ""; } }, set: (v) => { try { v ? sessionStorage.setItem("k", v) : sessionStorage.removeItem("k"); } catch {} } };
const hm = (t) => { const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };
const HARI = ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"];
let key = store.get();

const check = (k) => fetch("/api/admin/check", { headers: { "x-admin-key": k } }).then((r) => r.ok);

function show(on) { $("login").hidden = on; $("panel").hidden = !on; $("cetak-form").hidden = !on; $("guru").hidden = !on; if (on) { load(); loadGuru(); initCetak(); } else $("key").focus(); }

const dmy = (d) => d.split("-").reverse().join("/");
const el = (tag, text, cls) => Object.assign(document.createElement(tag), { textContent: text ?? "", className: cls || "" });

// Tarikh lalu disimpan sehingga keepDays (config.json); arkib lebih lama ada dalam Google Sheet.
async function initCetak() {
  if ($("dari").value) return;
  const { today } = await (await fetch("/api/config")).json();
  $("dari").value = today.slice(0, 8) + "01"; $("hingga").value = today;
}

$("cetak-btn").onclick = async () => {
  const from = $("dari").value, to = $("hingga").value, msg = $("cetak-msg");
  msg.textContent = "";
  if (!from || !to || to < from) { msg.textContent = "Pilih tarikh Dari dan Hingga (Hingga tidak boleh sebelum Dari)."; return; }
  const rows = await (await fetch(`/api/bookings?date=${from}&to=${to}`)).json();
  if (!rows.length) { msg.textContent = "Tiada tempahan dalam tempoh ini."; return; }

  const tbl = el("table");
  tbl.createTHead().insertRow().append(...["Masa", "Bilik", "Guru", "Tujuan", "Peserta"].map((h) => el("th", h)));
  const body = tbl.createTBody();
  let day = "";
  for (const b of rows) {
    if (b.date !== day) {
      day = b.date;
      const tr = body.insertRow(); tr.className = "d";
      const td = el("td", `${dmy(day)} (${HARI[new Date(day + "T00:00").getDay()]})`); td.colSpan = 5; tr.append(td);
    }
    body.insertRow().append(el("td", `${hm(b.start)} – ${hm(b.end)}`, "t"), el("td", b.room), el("td", b.nama), el("td", b.tujuan), el("td", b.peserta));
  }
  const days = new Set(rows.map((b) => b.date)).size;
  const tf = tbl.createTFoot().insertRow(); const fc = el("td", `Dicetak ${new Date().toLocaleString("ms-MY")} · eSumber`); fc.colSpan = 5; tf.append(fc);

  const hd = document.createElement("header");
  const logo = Object.assign(new Image(), { src: "/logo.png", alt: "" });
  const t = document.createElement("div"); t.append(el("h1", "Sejarah Tempahan Pusat Sumber"), el("p", "Nama Organisasi Anda"));
  hd.append(logo, t);
  $("cetak").replaceChildren(hd, el("p", `Tempoh: ${dmy(from)} hingga ${dmy(to)} · ${rows.length} tempahan, ${days} hari`, "sum"), tbl);
  if (!logo.complete) await new Promise((r) => { logo.onload = logo.onerror = r; }); // decode() tergantung pada imej tersembunyi
  window.onafterprint = () => $("cetak").replaceChildren();
  window.print();
};

async function loadGuru() {
  const rows = await (await fetch("/api/teachers")).json();
  const ul = $("guru-list"); ul.replaceChildren();
  for (const t of rows) {
    const li = document.createElement("li");
    const m = Object.assign(document.createElement("span"), { className: "m", textContent: t.nama });
    const x = Object.assign(document.createElement("button"), { className: "danger", type: "button", textContent: "Buang" });
    x.onclick = async () => {
      if (!confirm(`Buang ${t.nama} daripada senarai guru? Tempahan sedia ada kekal.`)) return;
      const r = await fetch("/api/teachers/" + t.id, { method: "DELETE", headers: { "x-admin-key": key } });
      $("guru-msg").textContent = r.ok ? "" : (await r.json().catch(() => ({}))).error || "Ralat.";
      if (r.ok) loadGuru();
    };
    const ed = Object.assign(document.createElement("button"), { className: "btn ghost small", type: "button", textContent: "Edit" });
    ed.onclick = () => {
      const inp = Object.assign(document.createElement("input"), { value: t.nama, maxLength: 100, ariaLabel: "Nama guru" });
      const ok = Object.assign(document.createElement("button"), { className: "btn small", type: "button", textContent: "Simpan" });
      const no = Object.assign(document.createElement("button"), { className: "btn ghost small", type: "button", textContent: "Batal" });
      no.onclick = loadGuru;
      ok.onclick = async () => {
        const r = await fetch("/api/teachers/" + t.id, { method: "PUT", headers: { "x-admin-key": key, "Content-Type": "application/json" }, body: JSON.stringify({ nama: inp.value }) });
        $("guru-msg").textContent = r.ok ? "" : (await r.json().catch(() => ({}))).error || "Ralat.";
        if (r.ok) { loadGuru(); load(); }
      };
      li.replaceChildren(inp, ok, no); inp.focus();
    };
    li.append(m, ed, x); ul.append(li);
  }
}

$("guru-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const r = await fetch("/api/teachers", { method: "POST", headers: { "x-admin-key": key, "Content-Type": "application/json" }, body: JSON.stringify({ nama: $("guru-nama").value }) });
  $("guru-msg").textContent = r.ok ? "" : (await r.json().catch(() => ({}))).error || "Ralat.";
  if (r.ok) { $("guru-nama").value = ""; loadGuru(); }
});

async function load() {
  const rows = await (await fetch("/api/bookings")).json();
  const box = $("jadual"); box.replaceChildren();
  if (!rows.length) { box.append(Object.assign(document.createElement("p"), { className: "empty", textContent: "Tiada tempahan." })); return; }
  let day = "", ul;
  for (const b of rows) {
    if (b.date !== day) {
      day = b.date;
      box.append(Object.assign(document.createElement("h3"), { className: "day", textContent: `${day.split("-").reverse().join("/")} (${HARI[new Date(day + "T00:00").getDay()]})` }));
      box.append(ul = document.createElement("ul"));
    }
    const li = document.createElement("li");
    const t = Object.assign(document.createElement("span"), { className: "t", textContent: `${hm(b.start)} – ${hm(b.end)}` });
    const m = Object.assign(document.createElement("span"), { className: "m", textContent: `${b.room} · ${b.nama}` });
    m.append(Object.assign(document.createElement("small"), { textContent: `${b.tujuan} (${b.peserta})` }));
    const x = Object.assign(document.createElement("button"), { className: "danger", type: "button", textContent: "Batal" });
    x.onclick = async () => {
      if (!confirm(`Batalkan tempahan ${b.nama} (${b.room}, ${b.date.split("-").reverse().join("/")} ${hm(b.start)}–${hm(b.end)})?`)) return;
      const r = await fetch("/api/bookings/" + b.id, { method: "DELETE", headers: { "x-admin-key": key } });
      $("msg").textContent = r.ok ? "" : (await r.json().catch(() => ({}))).error || "Ralat.";
      if (r.ok) load();
    };
    li.append(t, m, x); ul.append(li);
  }
}

$("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const k = $("key").value;
  if (await check(k)) { key = k; store.set(k); $("key").value = ""; $("login-msg").textContent = ""; show(true); }
  else { $("login-msg").textContent = "Kata laluan salah."; $("key").select(); }
});
$("logout").onclick = () => { key = ""; store.set(""); show(false); };

key ? check(key).then((ok) => { if (!ok) { key = ""; store.set(""); } show(ok); }) : show(false);
