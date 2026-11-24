# Legacy Switch — Concept Brief (Kiroween 2026, kategori Frankenstein)

Dipilih Bos 24 Nov 2026 06:48 WIB (konsep no. 2). Dokumen ini adalah brief manusia
untuk Kiro — spec formal (requirements/design/tasks) WAJIB dibuat lewat Kiro
sendiri (spec-driven workflow), bukan ditulis manual ke .kiro/.

## Masalah nyata
Orang meninggal atau hilang tanpa sempat menyampaikan hal penting: password,
pesan terakhir, dokumen, instruksi untuk keluarga. Solusi yang ada (pengacara,
brankas, password manager emergency access) mahal, rumit, atau tidak dikenal
orang awam. Legacy Switch: dead man's switch digital yang murah dan sederhana.

## Cara kerja
1. Pengguna menulis "legacy capsules": pesan teks, daftar akun/instruksi, dan
   file penting (terenkripsi end-to-end — server tidak pernah bisa membaca isi).
2. Pengguna menunjuk penerima tepercaya (trusted contacts) per kapsul.
3. Pengguna check-in berkala (tombol "I'm alive", interval pilihan: harian /
   mingguan / bulanan). Check-in memperpanjang timer.
4. Jika timer habis tanpa check-in: sistem mengirim peringatan bertahap ke
   pengguna (email, grace period 7 hari), lalu — bila tetap tidak ada respons —
   membuka kapsul untuk penerima yang ditunjuk.
5. Penerima mendapat tautan sekali pakai + passphrase terpisah untuk membuka kapsul.

## Kenapa Frankenstein (jahitan teknologi yang tidak cocok)
- Penjadwal dead-man (cron + antrean tunda) + enkripsi client-side (WebCrypto,
  kunci berasal dari passphrase pengguna) + email transaksional + auth +
  audit log yang tidak bisa diubah (append-only, hash-chain).
- Elemen-elemen ini biasanya tidak pernah bertemu dalam satu app: scheduler
  bertemu kriptografi bertemu alur "warisan digital".

## Fitur inti (MVP untuk demo juri)
- Akun + login (email). Kapsul: buat, edit, hapus; isi teks + lampiran file.
- Enkripsi end-to-end: kunci diturunkan dari passphrase via PBKDF2/Argon2 di
  browser; server hanya menyimpan ciphertext.
- Check-in + timer + grace period + pengingat email bertahap.
- Trusted contacts per kapsul; rilis kapsul + tautan sekali pakai.
- Dashboard: status timer, kapsul, riwayat check-in.
- Mode demo untuk juri: timer dipercepat (menit, bukan hari) + akun demo.

## UX horor (mendukung fungsi, bukan sekadar dekorasi)
- Tema "lilin yang menyala selama kamu check-in": api lilin mengecil saat timer
  menipis — urgensi terlihat tanpa membaca angka.
- Kapsul digambarkan sebagai "peti" tersegel; segel retak saat grace period.
- Palet gelap, ungu/hijau hantu, tipografi serif untuk pesan warisan.
- Jelas BUKAN mainan: copywriting serius dan menenangkan di alur sensitif.

## Stack (usulan untuk Kiro — keputusan akhir di design.md Kiro)
- Web app: React + Vite + TypeScript, Tailwind.
- Backend: Node (Hono/Express) + SQLite/Postgres; antrean timer via cron.
- Enkripsi: WebCrypto API (AES-GCM), kunci dari passphrase (PBKDF2).
- Email: provider gratis (Resend free tier / SMTP Gmail) — atau log email di
  mode demo bila kredensial tidak tersedia.
- Deploy gratis: frontend Vercel/Netlify, backend Fly.io/Render free tier
  (atau satu layanan saja bila cukup).

## Artefak Kiro yang harus ada (dibuat LEWAT Kiro CLI)
- `.kiro/specs/legacy-switch/` — requirements.md, design.md, tasks.md.
- `.kiro/steering/` — product.md, tech.md, structure.md.
- `.kiro/hooks/` — mis. hook auto-format + test saat file disimpan.
- Custom agent (mis. "security-reviewer") bila relevan.
- MCP bila ada yang benar-benar membantu (mis. fetch docs) — jangan dipaksakan.
- Property-based testing untuk logika timer/grace period (batas-batas waktu).
- Write-up pemakaian Kiro untuk submission Devpost.

## Risiko & kejujuran
- Enkripsi E2E asli harus benar-benar diimplementasikan, bukan klaim kosong.
  Bila waktu mepet, kurangi fitur (tanpa lampiran file) daripada memalsukan.
- Email nyata butuh kredensial SMTP — siapkan mode demo yang transparan
  (log pengiriman terlihat) bila email asli tidak terkonfigurasi.
- Jangan simpan data pribadi Bos di demo; semua data demo adalah fiktif.
