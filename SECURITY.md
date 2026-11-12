# Dasar Keselamatan

## Melaporkan kelemahan

Jika anda jumpa kelemahan keselamatan, **jangan buka Issue awam**.
Sila gunakan **Security → Report a vulnerability** pada halaman repo ini (laporan persendirian GitHub).

Sertakan langkah untuk menghasilkan semula masalah dan kesannya. Saya akan cuba membalas dalam beberapa hari.

## Sebelum berkongsi kod anda

- Jangan commit `.dev.vars`, `wrangler.jsonc`, kata laluan admin, `database_id` atau URL Apps Script sebenar.
- Semua rahsia disimpan sebagai Cloudflare secret (`npx wrangler secret put ...`).
