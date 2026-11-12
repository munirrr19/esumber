# eSumber

[![Test](https://github.com/munirrr19/esumber/actions/workflows/test.yml/badge.svg)](https://github.com/munirrr19/esumber/actions/workflows/test.yml)

Sistem tempahan bilik dan dewan yang ringan untuk sekolah dan organisasi kecil. Pengguna memilih nama, bilik, tarikh dan masa. Tempahan yang bertindih ditolak melalui semakan atomik dalam satu pernyataan SQL, jadi tempahan berganda tidak berlaku walaupun ada permintaan serentak.

**Teknologi:** Cloudflare Workers (API) · Workers Assets (`public/`) · Cloudflare D1 (SQLite) · arkib Google Sheets pilihan melalui Apps Script.

## Ciri

- Semakan pertindihan atomik, dengan jalur ketersediaan yang menunjukkan slot yang sudah ditempah
- Tempahan beberapa hari dan tempoh pantas (1, 2 atau 4 jam)
- Halaman admin (`/admin`) untuk membatalkan tempahan, mengurus senarai guru dan mencetak sejarah tempahan
- Kongsi tempahan sebagai kad imej ke WhatsApp
- Pembersihan automatik tempahan lama (`keepDays`) dan had tempahan ke hadapan (`maxDaysAhead`)
- Salinan pilihan setiap tempahan dan pembatalan ke Google Sheet

## Pembangunan setempat

```bash
npm install
cp wrangler.example.jsonc wrangler.jsonc
npx wrangler d1 execute esumber --local --file=schema.sql
npx wrangler d1 execute esumber --local --file=seed-guru.example.sql
echo ADMIN_KEY=tukar-ini > .dev.vars
npm run dev        # http://localhost:8787
npm test           # ujian pertindihan tempahan
```

## Tetapan

Ubah `config.json`:

| Kunci | Maksud |
|---|---|
| `rooms` | Senarai bilik yang boleh ditempah |
| `maxDaysAhead` | Sejauh mana tempahan dibenarkan ke hadapan |
| `keepDays` | Tempoh tempahan lepas disimpan sebelum dibersihkan setiap hari |

Senarai guru disimpan dalam jadual `teachers` dan diurus melalui `/admin`. Gunakan `seed-guru.example.sql` sebagai permulaan.

## Pasang ke Cloudflare

```bash
npx wrangler login
npx wrangler d1 create esumber                      # salin database_id ke wrangler.jsonc
npx wrangler d1 execute esumber --remote --file=schema.sql
npx wrangler secret put ADMIN_KEY                   # kata laluan admin
npm run deploy
```

Untuk domain sendiri, buang komen pada `routes` dalam `wrangler.jsonc` dan pastikan domain itu berada dalam akaun Cloudflare yang sama.

### Pilihan: arkib Google Sheet

1. Cipta Google Sheet dan catat ID-nya.
2. Dalam projek Apps Script baharu, tampal `sheet.gs`, tetapkan `KEY` dan `SHEET_ID`, kemudian deploy sebagai Web app.
3. Simpan URL dengan `?k=<KEY>` sebagai rahsia: `npx wrangler secret put SHEET_URL`

## Nota keselamatan

- `wrangler.jsonc`, `.dev.vars` dan rahsia dikecualikan daripada git. Jangan commit kunci sebenar.
- Tindakan admin memerlukan rahsia `ADMIN_KEY` yang dihantar sebagai `x-admin-key`.
- Jangan dedahkan `database_id`, ID Sheet dan URL Apps Script dalam commit awam.

## Menyumbang

Lihat [CONTRIBUTING.md](CONTRIBUTING.md). Laporkan isu keselamatan seperti dalam [SECURITY.md](SECURITY.md).

## Lesen

MIT. Lihat [LICENSE](LICENSE).
