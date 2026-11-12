const $ = (id) => document.getElementById(id);
const f = $("form"), warn = $("amaran"), msg = $("msg"), box = $("jadual"), submit = f.querySelector("button");
let today = "", OPEN = "07:00", CLOSE = "22:00";
const mins = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const store = { get: () => { try { return localStorage.getItem("nama") || ""; } catch { return ""; } }, set: (v) => { try { localStorage.setItem("nama", v); } catch {} } };
const HARI = ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"];
const hm = (t) => { const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };
const dmy = (iso) => iso.split("-").reverse().join("/");
const hari = (d) => HARI[new Date(d + "T00:00").getDay()];
const dh = (iso) => `${dmy(iso)} (${hari(iso)})`;

async function api(url, opt) {
  const r = await fetch(url, opt);
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || "Ralat.");
  return body;
}

function say(text, ok) { msg.textContent = text; msg.className = "alert " + (ok ? "ok" : "err"); }

// Medan tarikh/masa asli mengikut bahasa pelayar; paparkan dd/mm/yyyy dan masa 12 jam (AM/PM) secara seragam.
function syncOv() {
  document.querySelectorAll(".ov").forEach((o) => {
    const i = o.querySelector("input"), t = o.querySelector(".fmt");
    t.textContent = i.value ? (i.type === "date" ? dh(i.value) : hm(i.value)) : i.type === "date" ? "dd/mm/yyyy" : "--:-- --";
    t.classList.toggle("ph", !i.value);
  });
}


// ---- Makluman WhatsApp: kad imej + teks ringkas ----
let last = null; // { info, blob }
const waText = (i) => [
  "*Makluman Tempahan Bilik*",
  `*Bilik:* ${i.room}`,
  `*Tarikh:* ${i.dateEnd && i.dateEnd !== i.date ? `${dh(i.date)} hingga ${dh(i.dateEnd)}` : dh(i.date)}`,
  `*Masa:* ${hm(i.start)} – ${hm(i.end)}`,
  `*Oleh:* ${i.nama}`,
  `*Tujuan:* ${i.tujuan}`,
  `*Peserta:* ${i.peserta}`,
  "", "Ditempah melalui eSumber",
].join("\n");

async function card(i) {
  const F = '"Plus Jakarta Sans", system-ui, sans-serif';
  await Promise.all([500, 600, 700].map((w) => document.fonts.load(`${w} 40px ${F}`).catch(() => {})));
  const logo = await new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => ok(null); im.src = "/logo.png"; });
  const W = 1080, P = 64, IN = 48, VW = W - 2 * (P + IN);
  const m = document.createElement("canvas").getContext("2d");
  m.font = `600 40px ${F}`;
  const wrap = (t) => t.split("\n").flatMap((line) => {
    const out = []; let cur = "";
    for (const w of line.split(" ")) { const n = cur ? cur + " " + w : w; if (m.measureText(n).width > VW && cur) { out.push(cur); cur = w; } else cur = n; }
    return [...out, cur];
  });
  const rows = [
    ["Bilik", i.room],
    ["Tarikh", i.dateEnd && i.dateEnd !== i.date ? `${dh(i.date)}\nhingga ${dh(i.dateEnd)}` : dh(i.date)],
    ["Masa", `${hm(i.start)} – ${hm(i.end)}`],
    ["Oleh", i.nama], ["Tujuan", i.tujuan], ["Peserta", i.peserta],
  ].map(([k, v]) => [k, wrap(v)]);
  const rh = (l) => 32 + 30 + l.length * 54 + 28; // jarak atas + label + nilai + jarak bawah
  const HEAD = 200, top = HEAD + P, body = rows.reduce((s, [, l]) => s + rh(l), 0);
  const H = top + body + 40 + 130;
  const c = Object.assign(document.createElement("canvas"), { width: W, height: H });
  const x = c.getContext("2d");
  x.fillStyle = "#f7f8f7"; x.fillRect(0, 0, W, H);
  // Header putih nipis, sama seperti laman
  x.fillStyle = "#fff"; x.fillRect(0, 0, W, HEAD);
  x.fillStyle = "#e4e9e6"; x.fillRect(0, HEAD - 2, W, 2);
  let tx = P;
  if (logo) { const lh = 124, lw = lh * logo.width / logo.height; x.drawImage(logo, P, (HEAD - lh) / 2, lw, lh); tx = P + lw + 32; }
  x.textBaseline = "alphabetic"; x.fillStyle = "#1a2420";
  x.font = `700 52px ${F}`; x.fillText("Makluman Tempahan", tx, HEAD / 2 + 4);
  x.fillStyle = "#66756d"; x.font = `500 30px ${F}`; x.fillText("eSumber", tx, HEAD / 2 + 52);
  // Kad putih
  x.fillStyle = "#fff"; x.strokeStyle = "#e4e9e6"; x.lineWidth = 2;
  x.beginPath(); x.roundRect(P, top, W - 2 * P, body + 40, 28); x.fill(); x.stroke();
  let y = top + 20;
  rows.forEach(([k, lines], n) => {
    x.fillStyle = "#66756d"; x.font = `500 26px ${F}`; x.fillText(k, P + IN, y + 32 + 26);
    x.fillStyle = k === "Masa" ? "#0f5132" : "#1a2420"; x.font = `600 40px ${F}`;
    lines.forEach((l, j) => x.fillText(l, P + IN, y + 32 + 30 + 40 + j * 54));
    y += rh(lines);
    if (n < rows.length - 1) { x.fillStyle = "#e4e9e6"; x.fillRect(P + IN, y, W - 2 * (P + IN), 2); }
  });
  x.fillStyle = "#0f5132"; x.fillRect(W / 2 - 24, H - 100, 48, 4);
  x.fillStyle = "#66756d"; x.font = `500 28px ${F}`; x.textAlign = "center";
  x.fillText(location.host, W / 2, H - 44);
  return new Promise((ok) => c.toBlob(ok, "image/png"));
}

async function showShare(info) {
  last = { info, blob: await card(info) };
  $("share-img").src = URL.createObjectURL(last.blob);
}

async function sendWA() {
  if (!last) return;
  const text = waText(last.info), file = new File([last.blob], "tempahan.png", { type: "image/png" });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text }); return; }
  } catch (e) { if (e.name === "AbortError") return; }
  // Komputer: salin imej ke papan keratan (atau muat turun), buka WhatsApp dengan teks.
  let copied = false;
  try { await navigator.clipboard.write([new ClipboardItem({ "image/png": last.blob })]); copied = true; } catch {}
  if (!copied) Object.assign(document.createElement("a"), { href: $("share-img").src, download: "tempahan.png" }).click();
  window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank", "noopener");
  $("share-hint").textContent = copied ? "Teks dibuka dalam WhatsApp. Imej sudah disalin: tampal (Ctrl+V) dalam group sebelum hantar." : "Teks dibuka dalam WhatsApp. Imej dimuat turun: lampirkan dalam group sebelum hantar.";
}
$("share-btn").addEventListener("click", sendWA);

async function refresh() {
  syncOv();
  const { date, dateEnd, start, end } = f.elements, room = f.elements.room.value;
  const multi = $("multi").checked, to = multi && dateEnd.value >= date.value ? dateEnd.value : "";
  const q = new URLSearchParams();
  if (room) q.set("room", room);
  if (date.value) q.set("date", date.value);
  if (to) q.set("to", to);
  $("jadual-tajuk").textContent = room || date.value ? `Tempahan: ${room || "semua bilik"}${date.value ? ", " + dmy(date.value) + (to ? " hingga " + dmy(to) : "") : ""}` : "Tempahan akan datang";
  const rows = await api("/api/bookings?" + q);

  // Jalur ketersediaan untuk hari pertama yang dipilih.
  const day1 = room && date.value ? rows.filter((b) => b.date === date.value) : null;
  $("avail").hidden = !day1;
  if (day1) {
    const o = mins(OPEN), span = mins(CLOSE) - o, pct = (t) => Math.min(100, Math.max(0, ((mins(t) - o) / span) * 100));
    const seg = (s, e, cls) => { const i = document.createElement("i"); i.className = cls; i.style.left = pct(s) + "%"; i.style.width = pct(e) - pct(s) + "%"; return i; };
    const mine = start.value && end.value && start.value < end.value ? [seg(start.value, end.value, "me")] : [];
    $("avail-bar").replaceChildren(...day1.map((b) => seg(b.start, b.end, "")), ...mine);
    const list = day1.map((b) => `${hm(b.start)}–${hm(b.end)}`).join(", ");
    $("avail-t").textContent = `Ketersediaan ${room}, ${dmy(date.value)}${to ? " (hari pertama)" : ""}`;
    $("avail-l").textContent = list ? `Sudah ditempah: ${list}` : "Semua masa kosong.";
    $("avail-bar").setAttribute("aria-label", $("avail-t").textContent + ". " + $("avail-l").textContent);
  }

  const c = room && date.value && start.value && end.value && rows.find((b) => b.start < end.value && b.end > start.value);
  warn.textContent = c ? `Sudah ditempah oleh ${c.nama} pada ${dmy(c.date)} (${hm(c.start)}–${hm(c.end)}). Sila pilih masa atau bilik lain.` : "";
  submit.disabled = !!c;

  const wasOpen = box.querySelector("details.more")?.open;
  box.replaceChildren(); box.removeAttribute("aria-busy");
  if (!rows.length) { const p = document.createElement("p"); p.className = "empty"; p.textContent = "Tiada tempahan."; box.append(p); return; }
  // Hari ini hingga 2 hari lagi dipaparkan; tempahan 3 hari ke atas dilipat dalam dropdown (kecuali bila tarikh dipilih).
  let day = "", ul, more, moreN = 0;
  for (const b of rows) {
    if (b.date !== day) {
      day = b.date;
      const diff = Math.round((Date.parse(day) - Date.parse(today)) / 864e5);
      let into = box;
      if (!date.value && diff >= 3) {
        if (!more) {
          more = document.createElement("details"); more.className = "more"; more.open = !!wasOpen;
          more.append(document.createElement("summary")); box.append(more);
        }
        into = more;
      }
      const h = document.createElement("h3"); h.className = "day";
      const rel = { 0: "Hari ini", 1: "Esok" }[diff];
      if (rel) h.append(Object.assign(document.createElement("b"), { textContent: rel + " · " }));
      h.append(dh(day));
      ul = document.createElement("ul"); into.append(h, ul);
    }
    if (more && ul.parentNode === more) moreN++;
    const li = document.createElement("li");
    const t = document.createElement("span"); t.className = "t"; t.textContent = `${hm(b.start)} – ${hm(b.end)}`;
    const m = document.createElement("span"); m.className = "m"; m.textContent = `${b.room} · ${b.nama}`;
    const s = document.createElement("small"); s.textContent = `${b.tujuan} (${b.peserta})`;
    m.append(s); li.append(t, m); ul.append(li);
  }
  if (more) more.firstChild.textContent = `Tempahan 3 hari ke atas (${moreN})`;
}

(async () => {
  const c = await api("/api/config");
  today = c.today;
  const nama = f.elements.nama;
  nama.replaceChildren(new Option("-- Pilih nama --", "", true, true), ...c.names.map((v) => new Option(v, v)));
  nama.options[0].disabled = true;
  OPEN = c.open; CLOSE = c.close;
  if (c.names.includes(store.get())) nama.value = store.get();
  nama.addEventListener("change", () => store.set(nama.value));
  // Tempoh pantas: isi masa tamat dari masa mula (dihadkan pada waktu tutup).
  $("dur").addEventListener("click", (e) => {
    const h = e.target.dataset?.h, s = f.elements.start.value;
    if (!h || !s) return;
    const m = Math.min(mins(s) + h * 60, mins(CLOSE));
    if (m <= mins(s)) return;
    f.elements.end.value = `${String(m / 60 | 0).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    f.dispatchEvent(new Event("change", { bubbles: true }));
  });
  c.rooms.forEach((r, i) => {
    const l = document.createElement("label"); l.className = "chip";
    const inp = Object.assign(document.createElement("input"), { type: "radio", name: "room", value: r, required: i === 0 });
    const sp = document.createElement("span"); sp.textContent = r;
    l.append(inp, sp); $("rooms").append(l);
  });
  const maxDate = new Date(Date.parse(c.today) + c.maxDaysAhead * 864e5).toISOString().slice(0, 10);
  f.elements.date.min = c.today;
  f.elements.date.max = f.elements.dateEnd.max = maxDate;
  f.elements.start.min = f.elements.end.min = c.open;
  f.elements.start.max = f.elements.end.max = c.close;
  $("multi").addEventListener("change", () => {
    const on = $("multi").checked;
    $("end-wrap").hidden = !on;
    f.elements.dateEnd.disabled = !on;
    f.elements.dateEnd.required = on;
    if (!on) f.elements.dateEnd.value = "";
    $("tarikh-label").textContent = on ? "Tarikh mula" : "Tarikh";
    $("multi-t").textContent = on ? "− Satu hari sahaja" : "+ Tempah beberapa hari";
  });
  f.elements.date.addEventListener("change", () => { f.elements.dateEnd.min = f.elements.date.value; });
  document.querySelectorAll(".ov input").forEach((i) => i.addEventListener("click", () => { try { i.showPicker(); } catch {} }));
  f.addEventListener("change", refresh);
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (submit.dataset.busy) return;
    submit.dataset.busy = "1"; submit.disabled = true; submit.textContent = "Menghantar…";
    $("share").hidden = true;
    const v = Object.fromEntries(new FormData(f));
    try {
      const r = await api("/api/bookings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(f))) });
      say("", true);
      $("done-t").textContent = r.count > 1 ? `Tempahan berjaya (${r.count} hari)` : "Tempahan berjaya";
      $("done-sum").textContent = `${v.room} · ${v.dateEnd ? `${dh(v.date)} hingga ${dh(v.dateEnd)}` : dh(v.date)} · ${hm(v.start)} – ${hm(v.end)}`;
      $("share-hint").textContent = "";
      $("share").hidden = false;
      $("share").scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      showShare(v);
      f.elements.tujuan.value = f.elements.peserta.value = f.elements.start.value = f.elements.end.value = "";
    } catch (err) { say(err.message, false); }
    delete submit.dataset.busy; submit.textContent = "Hantar Tempahan";
    refresh();
  });
  refresh();
})();
