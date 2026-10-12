# VoiceClone Studio AI

Aplikasi web voice cloning pribadi untuk konten narasi. Dibangun khusus agar **tidak memerlukan API key / kredit / langganan**. AI dijalankan *di browser pengguna*, lewat `pocket-tts-js` yang menggunakan Pocket TTS (ONNX Runtime Web + Web Worker).

## Kemampuan nyata versi 1.0

- ✅ Upload WAV / MP3 / audio browser dan rekam dengan mikrofon
- ✅ Clone suara dari rekaman audio sendiri via `PocketTTS.cloneVoice()`
- ✅ Ketik naskah Inggris, proses dengan `PocketTTS.generate()`
- ✅ Ekspor WAV dan putar dengan pemutar audio browser (CapCut menerima WAV)
- ✅ Simpan profil (rekaman referensi) dan riwayat audio ke IndexedDB browser
- ✅ Generate tanpa server AI komersial; inference lokal setelah unduhan model
- ⚠️ **Bahasa Indonesia belum didukung** oleh bundle browser yang dipasang. Jangan klaim aplikasi ini TTS bahasa Indonesia.
- ⚠️ **MP3 belum tersedia**. Ekspor WAV sudah dapat digunakan di CapCut.
- ⚠️ Memakai nama model `english_2026-04`. Suara clone dapat berbeda dari rekaman dan hasil bukan jaminan identik 100%.

**Bagaimana voice library bekerja:** IndexedDB menyimpan sampel audio referensi asli, bukan model AI terlatih atau voice embedding permanen. Setelah reload, mesin akan melakukan `cloneVoice()` lagi saat suara dipakai. Dengan demikian, voice profile tetap bisa digunakan tanpa upload ulang selama data browser belum dihapus.

## Buka di browser tanpa instalasi program (GitHub Pages)

Aplikasi dalam ZIP ini adalah **SOURCE CODE**, bukan tautan hosting yang sudah aktif. Untuk menghasilkan alamat web pribadi lewat browser:

1. Download ZIP dari ChatGPT lalu ekstrak.
2. Login ke https://github.com/ dan buat repository baru, misalnya `voiceclone-studio-ai` (Public).
3. Pada repository, gunakan **Add file → Upload files**, unggah isi folder `VoiceClone-Studio-AI`, termasuk folder `src` dan `.github/workflows` (folder tersembunyi dapat perlu ditampilkan). Commit ke branch `main`.
4. Buka **Settings → Pages → Build and deployment**, pilih **Source: GitHub Actions**.
5. Buka tab **Actions**, pilih workflow `Deploy browser app`. Jika belum jalan, pilih **Run workflow**.
6. Tunggu hingga workflow selesai. Buka alamat `https://USERNAME.github.io/voiceclone-studio-ai/` (ganti USERNAME dan nama repo sesuai punya kamu).
7. Klik **Aktifkan AI**. Pertama kali akan mengunduh model AI dari Hugging Face (~150 MB, plus runtime); butuh koneksi internet dan ruang penyimpanan browser. Tunggu hingga indikator "AI siap digunakan".
8. Rekam/unggah suara pribadi 5–10 detik, centang izin suara, klik **Clone My Voice**.
9. Pilih profil, masukkan naskah *bahasa Inggris*, klik **Generate Narration** lalu **Download WAV**.

Github Pages hosting statis dan library ini tidak memerlukan API key berbayar. Kuota data internet dan resource CPU tetap terpakai.

### Bila workflow tidak otomatis jalan

Cek Actions di repo diaktifkan, branch bernama `main`, folder `.github/workflows/deploy.yml` benar-benar ikut terupload, serta Settings → Pages menggunakan GitHub Actions.

### Test lokal untuk developer

Butuh Node.js versi 18+:

```bash
npm install
npm run dev
```

Buka alamat localhost yang ditampilkan. Untuk build:

```bash
npm run build
npm run preview
```

> Jangan langsung klik `index.html` di file explorer (`file://`). ES modules/Web Workers harus dibuka dari website **HTTPS** atau `localhost`.

## Keterbatasan & troubleshooting

- **Model gagal diunduh**: cek jaringan, periksa izin Hugging Face CDN, simpan ruang disk. Chrome/Edge desktop direkomendasikan. Download model gagal jangan dianggap AI berhasil.
- **Lambat**: AI berjalan di CPU browser, kecepatan laptop memengaruhi waktu generate; single-threaded di beberapa host statis mungkin lebih lambat. Tutup tab berat lainnya.
- **Mikrofon ditolak**: izinkan akses mikrofon pada pengaturan situs. Audio file upload tetap bisa digunakan.
- **Audio tidak dapat dibaca**: codec tertentu (M4A/WEBM) mungkin tidak didukung browser. Coba WAV/MP3.
- **Lupa suara yang pernah disimpan**: cek browser dan profil pengguna yang sama; IndexedDB tidak sinkron antar perangkat. Jangan hapus Site Data.
- **Hasil tidak mirip**: gunakan 5–10 detik suara jelas, tanpa musik, tanpa noise dan satu pembicara. Eksperimen dengan rekaman berbeda.
- **Model bahasa Indonesia**: membutuhkan bundle model dan pipeline terpisah. Menu bahasa Indonesia sengaja dinonaktifkan, bukan palsu.
- **ElevenLabs**: tidak digunakan. Tidak ada field API key.

## Privasi dan etika

Sampel yang kamu unggah diproses di browser, tidak dikirim ke backend aplikasi. Namun runtime dan model AI pertama kali diunduh dari CDN pihak ketiga. Gunakan hanya suara sendiri atau suara yang jelas-jelas telah mengizinkan cloning. Perhatikan lisensi model saat menerbitkan konten publik.

## Atribusi/lisensi sumber terbuka

- [pocket-tts-js](https://github.com/vlapky/pocket-tts-js): library MIT oleh vlapky.
- [Pocket TTS](https://github.com/kyutai-labs/pocket-tts): arsitektur dan model © Kyutai. Bobot model dan aset suara CC BY 4.0, termasuk kewajiban atribusi.
- [ONNX Runtime Web](https://onnxruntime.ai/docs/get-started/with-javascript/web.html): runtime inferensi.

Dilarang menyatakan bahwa output sudah diuji pada browser nyata bila belum diuji menggunakan model yang berhasil diunduh. Versi ini telah diperiksa sintaks JavaScript dan visual HTML/CSS secara lokal, tetapi proses model/clone/generate membutuhkan uji runtime setelah deployment di browser dengan akses internet.
