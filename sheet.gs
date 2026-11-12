// Dipasang sebagai skrip Apps Script berasingan (akaun Google anda). Deploy > Web app (Execute as: Me, Anyone).
// Letak URL + ?k=<KEY> dalam secret SHEET_URL. KEY sebenar tidak disimpan di repo.
const KEY = "UBAH-INI";
const SHEET_ID = "GANTI-DENGAN-ID-GOOGLE-SHEET";;

function doPost(e) {
  if (e.parameter.k !== KEY) return ContentService.createTextOutput("forbidden");
  const b = JSON.parse(e.postData.contents);
  const sh = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
  sh.appendRow([b.id, new Date(), b.nama, b.room, b.date, b.start, b.end, b.tujuan, b.peserta]);
  return ContentService.createTextOutput("ok");
}
