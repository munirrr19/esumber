# eSumber

[![Test](https://github.com/munirrr19/esumber/actions/workflows/test.yml/badge.svg)](https://github.com/munirrr19/esumber/actions/workflows/test.yml)

A lightweight room and hall booking system for schools and small organisations. Users pick their name, room, date and time; overlapping bookings are rejected by an atomic check inside a single SQL statement, so double bookings cannot happen even under simultaneous requests.

**Stack:** Cloudflare Workers (API) · Workers Assets (`public/`) · Cloudflare D1 (SQLite) · optional Google Sheets archive via Apps Script.

> The interface is in Bahasa Melayu. Strings live in `public/` and are easy to translate.

## Features

- Atomic clash detection, with the availability strip showing taken slots
- Multi-day bookings and quick durations (1, 2 or 4 hours)
- Admin page (`/admin`) to cancel bookings, manage the teacher list and print booking history
- Share a booking as an image card to WhatsApp
- Automatic cleanup of old bookings (`keepDays`) and a booking horizon (`maxDaysAhead`)
- Optional copy of every booking and cancellation to a Google Sheet

## Local development

```bash
npm install
cp wrangler.example.jsonc wrangler.jsonc
npx wrangler d1 execute esumber --local --file=schema.sql
npx wrangler d1 execute esumber --local --file=seed-guru.example.sql
echo ADMIN_KEY=change-me > .dev.vars
npm run dev        # http://localhost:8787
npm test           # booking clash tests
```

## Configuration

Edit `config.json`:

| Key | Meaning |
|---|---|
| `rooms` | List of bookable rooms |
| `maxDaysAhead` | How far ahead bookings are allowed |
| `keepDays` | How long past bookings are kept before the daily cleanup removes them |

The teacher list is stored in the `teachers` table and managed from `/admin`. Use `seed-guru.example.sql` as a starting point.

## Deploy

```bash
npx wrangler login
npx wrangler d1 create esumber                      # copy database_id into wrangler.jsonc
npx wrangler d1 execute esumber --remote --file=schema.sql
npx wrangler secret put ADMIN_KEY                   # admin password
npm run deploy
```

To use a custom domain, uncomment `routes` in `wrangler.jsonc` and make sure the domain is in the same Cloudflare account.

### Optional: Google Sheet archive

1. Create a Google Sheet and note its ID.
2. In a new Apps Script project, paste `sheet.gs`, set `KEY` and `SHEET_ID`, then deploy as a Web app.
3. Store the URL with `?k=<KEY>` as a secret: `npx wrangler secret put SHEET_URL`

## Security notes

- `wrangler.jsonc`, `.dev.vars` and secrets are git-ignored. Never commit real keys.
- Admin actions require the `ADMIN_KEY` secret sent as `x-admin-key`.
- Keep `database_id`, Sheet IDs and Apps Script URLs out of public commits.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Report security issues as described in [SECURITY.md](SECURITY.md).

## Licence

MIT. See [LICENSE](LICENSE).
