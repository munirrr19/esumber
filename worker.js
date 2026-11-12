// Cloudflare Worker: API sahaja (/api/*). Fail statik dihidang oleh Workers Assets dari public/.
import config from "./config.json" with { type: "json" };

const OPEN = "07:00", CLOSE = "22:00"; // waktu tempahan dibenarkan
const DAY = 86_400_000, MAX_DAYS = 31;
const hm = (t) => { const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };
const dmy = (iso) => iso.split("-").reverse().join("/");

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date());
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
const isTime = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const str = (v, max) => (typeof v === "string" && v.trim() && v.trim().length <= max ? v.trim() : null);
const send = (code, body) => Response.json(body, { status: code });
const addDays = (iso, n) => new Date(Date.parse(iso) + n * DAY).toISOString().slice(0, 10);
// Salinan baris ke Google Sheet (pilihan). D1 kekal sumber utama; kegagalan Sheet tidak membatalkan operasi.
const toSheet = (env, ctx, row) => env.SHEET_URL && ctx?.waitUntil(fetch(env.SHEET_URL, { method: "POST", body: JSON.stringify(row) }).catch(() => {}));

function validate(b) {
  const d = { nama: str(b.nama, 100), tujuan: str(b.tujuan, 200), room: b.room, date: b.date, start: b.start, end: b.end, peserta: str(b.peserta, 200) };
  if (!d.nama) return "Nama tidak sah.";
  if (!d.tujuan || !d.peserta) return "Tujuan dan peserta wajib diisi.";
  if (!config.rooms.includes(d.room)) return "Pusat/bilik tidak sah.";
  if (!isDate(d.date) || d.date < today()) return "Tarikh tidak sah atau sudah lepas.";
  if (!isTime(d.start) || !isTime(d.end)) return "Masa tidak sah.";
  if (d.start >= d.end) return "Masa tamat mesti selepas masa mula.";
  if (d.start < OPEN || d.end > CLOSE) return `Tempahan hanya antara ${OPEN} dan ${CLOSE}.`;
  return d;
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const db = env.DB;
    try {
      const isAdmin = !!env.ADMIN_KEY && req.headers.get("x-admin-key") === env.ADMIN_KEY;
      if (url.pathname === "/api/admin/check") return isAdmin ? send(200, { ok: true }) : send(403, { error: "Kata laluan salah." });

      const teachers = () => db.prepare("SELECT id,nama FROM teachers ORDER BY nama").all().then((r) => r.results);

      if (url.pathname === "/api/config") return send(200, { ...config, names: (await teachers()).map((t) => t.nama), open: OPEN, close: CLOSE, today: today() });

      if (url.pathname === "/api/teachers" && req.method === "GET") return send(200, await teachers());

      if (url.pathname === "/api/teachers" && req.method === "POST") {
        if (!isAdmin) return send(403, { error: "Kata laluan admin salah." });
        let body; try { body = await req.json(); } catch { return send(400, { error: "Data tidak sah." }); }
        const nama = str(body?.nama, 100);
        if (!nama) return send(400, { error: "Nama diperlukan (maksimum 100 aksara)." });
        const r = await db.prepare("INSERT OR IGNORE INTO teachers (nama) VALUES (?)").bind(nama).run();
        return r.meta.changes ? send(201, { id: r.meta.last_row_id }) : send(409, { error: "Nama sudah ada." });
      }

      const delT = url.pathname.match(/^\/api\/teachers\/(\d+)$/);
      if (delT && req.method === "PUT") {
        if (!isAdmin) return send(403, { error: "Kata laluan admin salah." });
        let body; try { body = await req.json(); } catch { return send(400, { error: "Data tidak sah." }); }
        const nama = str(body?.nama, 100);
        if (!nama) return send(400, { error: "Nama diperlukan (maksimum 100 aksara)." });
        const id = Number(delT[1]);
        const old = await db.prepare("SELECT nama FROM teachers WHERE id = ?").bind(id).first();
        if (!old) return send(404, { error: "Guru tidak dijumpai." });
        const r = await db.prepare("UPDATE teachers SET nama = ? WHERE id = ? AND NOT EXISTS (SELECT 1 FROM teachers WHERE nama = ? AND id <> ?)").bind(nama, id, nama, id).run();
        if (!r.meta.changes) return send(409, { error: "Nama sudah ada." });
        // Tempahan lama ikut nama baharu supaya senarai kekal konsisten (Sheet tidak dikemas kini).
        await db.prepare("UPDATE bookings SET nama = ? WHERE nama = ?").bind(nama, old.nama).run();
        return send(200, { ok: true });
      }
      if (delT && req.method === "DELETE") {
        if (!isAdmin) return send(403, { error: "Kata laluan admin salah." });
        await db.prepare("DELETE FROM teachers WHERE id = ?").bind(Number(delT[1])).run();
        return send(200, { ok: true });
      }

      if (url.pathname === "/api/bookings" && req.method === "GET") {
        const room = url.searchParams.get("room") || "";
        const qd = url.searchParams.get("date") || "", qt = url.searchParams.get("to") || "";
        const date = isDate(qd) ? qd : "";
        const to = date ? (isDate(qt) && qt >= date ? qt : date) : "";
        const { results } = await db
          .prepare("SELECT id,nama,tujuan,room,date,start,end,peserta FROM bookings WHERE date >= ? AND (? = '' OR date <= ?) AND (? = '' OR room = ?) ORDER BY date,start")
          .bind(date || today(), to, to, room, room).all();
        return send(200, results);
      }

      if (url.pathname === "/api/bookings" && req.method === "POST") {
        const raw = await req.text();
        let body;
        if (raw.length > 10_000) return send(400, { error: "Data tidak sah." });
        try { body = JSON.parse(raw); } catch { return send(400, { error: "Data tidak sah." }); }
        const d = validate(body ?? {});
        if (typeof d === "string") return send(400, { error: d });
        if (!(await db.prepare("SELECT 1 FROM teachers WHERE nama = ?").bind(d.nama).first())) return send(400, { error: "Nama tidak sah." });
        const limit = addDays(today(), Number(env.MAX_AHEAD ?? config.maxDaysAhead));
        if (d.date > limit || (body.dateEnd && body.dateEnd > limit)) return send(400, { error: "Tarikh terlalu jauh. Tempahan hanya dibenarkan sehingga setahun ke hadapan." });

        // Satu hari, atau setiap hari dari date hingga dateEnd (masa sama setiap hari). Semua atau tiada.
        let dates = [d.date];
        if (body.dateEnd) {
          if (!isDate(body.dateEnd) || body.dateEnd < d.date) return send(400, { error: "Tarikh akhir tidak sah." });
          dates = [];
          for (let t = Date.parse(d.date); ; t += DAY) {
            const iso = new Date(t).toISOString().slice(0, 10);
            if (iso > body.dateEnd) break;
            if (dates.length >= MAX_DAYS) return send(400, { error: `Maksimum ${MAX_DAYS} hari sekali tempah.` });
            dates.push(iso);
          }
        }

        const { results: clashes } = await db
          .prepare("SELECT date,nama,start,end FROM bookings WHERE room = ? AND date >= ? AND date <= ? AND start < ? AND end > ? ORDER BY date")
          .bind(d.room, dates[0], dates.at(-1), d.end, d.start).all();
        const wanted = new Set(dates);
        clashes.splice(0, clashes.length, ...clashes.filter((c) => wanted.has(c.date)));
        if (clashes.length) {
          const c = clashes[0];
          return send(409, { error: `Bertindih pada ${dmy(c.date)} dengan tempahan ${c.nama} (${hm(c.start)}–${hm(c.end)}).` + (clashes.length > 1 ? ` (${clashes.length} hari bertindih)` : "") });
        }

        // Setiap INSERT menyemak bertindih secara atomik; jika ada yang terlepas (hantaran serentak), batalkan yang sudah masuk.
        const ins = "INSERT INTO bookings (nama,tujuan,room,date,start,end,peserta) SELECT ?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM bookings WHERE room = ? AND date = ? AND start < ? AND end > ?)";
        const rs = await db.batch(dates.map((day) => db.prepare(ins).bind(d.nama, d.tujuan, d.room, day, d.start, d.end, d.peserta, d.room, day, d.end, d.start)));
        const ids = rs.filter((r) => r.meta.changes).map((r) => r.meta.last_row_id);
        if (ids.length < dates.length) {
          await db.batch(ids.map((id) => db.prepare("DELETE FROM bookings WHERE id = ?").bind(id)));
          return send(409, { error: "Bertindih dengan tempahan lain. Sila cuba lagi." });
        }
        dates.forEach((day, i) => toSheet(env, ctx, { id: ids[i], ...d, date: day }));
        return send(201, { id: ids[0], ids, count: ids.length });
      }

      const del = url.pathname.match(/^\/api\/bookings\/(\d+)$/);
      if (del && req.method === "DELETE") {
        if (!isAdmin) return send(403, { error: "Kata laluan admin salah." });
        const id = Number(del[1]);
        const b = await db.prepare("SELECT id,nama,tujuan,room,date,start,end,peserta FROM bookings WHERE id = ?").bind(id).first();
        await db.prepare("DELETE FROM bookings WHERE id = ?").bind(id).run();
        // Skrip Sheet hanya menambah baris, jadi pembatalan dihantar sebagai baris baharu bertanda supaya arkib tidak mengelirukan.
        if (b) toSheet(env, ctx, { ...b, tujuan: "[DIBATALKAN] " + b.tujuan });
        return send(200, { ok: true });
      }

      return send(404, { error: "Tiada." });
    } catch (e) {
      console.error(e);
      return send(500, { error: "Ralat pelayan." });
    }
  },

  // Cron harian: padam tempahan yang sudah lepas lebih keepDays hari (config.json). Arkib kekal dalam Google Sheet.
  async scheduled(_event, env) {
    await env.DB.prepare("DELETE FROM bookings WHERE date < ?").bind(addDays(today(), -config.keepDays)).run();
  },
};
