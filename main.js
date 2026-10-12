import './style.css';
import { PocketTTS, chunksToWavBlob } from 'pocket-tts-js';
import { getVoices, saveVoice, deleteVoice, getHistory, saveHistory, deleteHistory } from './storage.js';

const $ = id => document.getElementById(id);
const MAX_AUDIO = 40 * 1024 * 1024;
const MAX_HISTORY = 10;
const TEMPLATES = {
  story: 'The world went silent at exactly midnight. No phones. No lights. No warning. But one man heard something moving beneath his house. And what he found would change everything.',
  doc: 'Every day, millions of machines work behind the scenes. From raw materials to precision manufacturing, each process tells the story of human ingenuity and engineering.',
  short: 'What if the Sun suddenly disappeared? For eight minutes, everything would look completely normal. Then darkness would swallow the Earth. Here is what would happen next.'
};
let engine = null;
let loading = false;
let generating = false;
let stopRequested = false;
let recorder = null;
let recordingStream = null;
let draftBlob = null;
let sampleUrl = '';
let outputUrl = '';
let outputBlob = null;
let profiles = [];
let history = [];
let activeProfileId = '';
const refs = new Map();

function toast(message) {
  const el = $('toast'); el.textContent = message; el.classList.add('show');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 4600);
}
function text(id, val) { $(id).textContent = val; }
function setEngineStatus(name, details, pct) {
  text('engineTitle', name); text('engineDesc', details);
  text('modelStateMini', name);
  $('modelDot').classList.toggle('ready', Boolean(engine));
  $('progressTrack').hidden = !(pct >= 0 && pct <= 100);
  if (pct >= 0 && pct <= 100) $('progressFill').style.width = `${pct}%`;
}
function formatSize(bytes) { return `${(bytes / (1024 * 1024)).toFixed(1)} MB`; }
function formatDate(date) { return new Date(date).toLocaleString('id-ID', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }); }
function safeName(name) { return name.replace(/[^a-z0-9_\-]+/gi,'-').replace(/^-+|-+$/g,'').slice(0,48) || 'narasi'; }
function makeBtn(title, cssClass, action) {
  const btn = document.createElement('button'); btn.type = 'button'; btn.className = cssClass; btn.textContent = title;
  btn.addEventListener('click', action); return btn;
}
function setBusy(busy) {
  generating = busy;
  $('generateBtn').disabled = busy;
  $('stopBtn').disabled = !busy;
  $('cloneBtn').disabled = busy;
  $('loadModelBtn').disabled = busy || loading || Boolean(engine);
  $('generateBtn').textContent = busy ? '✦ Sedang menghasilkan...' : '✦ Generate Narration →';
}
async function loadModel() {
  if (engine || loading) return;
  if (!window.isSecureContext) { toast('Gunakan HTTPS atau localhost. Model browser memerlukan secure context.'); return; }
  loading = true; $('loadModelBtn').disabled = true; $('loadModelBtn').textContent = 'Menyiapkan...';
  setEngineStatus('Mengunduh model...', 'Pertama kali ~150 MB, tergantung jaringan dan cache. Jangan tutup tab.', 1);
  const instance = new PocketTTS({ language: 'english_2026-04', quantized: true, voiceCloning: true });
  try {
    await instance.load(p => {
      if (p?.label) {
        const frac = p.total ? Math.max(0, Math.min(100, Math.round(p.loaded / p.total * 100))) : null;
        setEngineStatus('Memuat model AI...', `${p.label}${p.fromCache ? ' · dari cache' : ''}${frac === null ? '' : ` · ${frac}% file`}`, frac);
      }
    });
    engine = instance;
    setEngineStatus('AI siap digunakan', 'Pocket TTS berjalan langsung di browser. Pilih atau clone suara untuk mulai.', -1);
    $('loadModelBtn').textContent = '✓ Model aktif';
    toast('Model AI berhasil dimuat. Sekarang kamu bisa clone suara!');
  } catch (err) {
    try { instance.destroy(); } catch {}
    engine = null;
    setEngineStatus('Gagal memuat model', `Pesan sistem: ${err.message || err}. Coba refresh atau cek koneksi internet.`, -1);
    $('loadModelBtn').textContent = 'Coba lagi';
    toast('Model gagal: ' + (err.message || err));
  } finally { loading = false; $('loadModelBtn').disabled = Boolean(engine); }
}
function audioObjectUrl(blob, previous) { if (previous) URL.revokeObjectURL(previous); return URL.createObjectURL(blob); }
function setSample(blob, name) {
  if (!blob || !blob.size || blob.size > MAX_AUDIO) { toast('File audio kosong atau lebih besar dari 40 MB.'); return; }
  draftBlob = blob;
  sampleUrl = audioObjectUrl(blob, sampleUrl);
  $('sampleAudio').src = sampleUrl;
  $('sampleBox').hidden = false;
  text('sampleTitle', name || 'Rekaman baru');
  text('sampleInfo', `${formatSize(blob.size)} · hanya disimpan di browser`);
  text('cloneStatus', 'Sampel sudah dipilih. Aktifkan AI lalu tekan Clone My Voice.');
}
async function startStopRecording() {
  if (recorder && recorder.state === 'recording') { recorder.stop(); $('recordBtn').disabled = true; return; }
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    toast('Rekam mikrofon tidak didukung. Gunakan Chrome/Edge dengan HTTPS atau upload audio.'); return;
  }
  try {
    recordingStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation:true, noiseSuppression:true }, video:false });
    const mimeTypes = ['audio/webm;codecs=opus','audio/mp4','audio/webm'];
    const mimeType = mimeTypes.find(m => MediaRecorder.isTypeSupported(m));
    recorder = new MediaRecorder(recordingStream, mimeType ? { mimeType } : undefined);
    const chunks = [];
    recorder.ondataavailable = ev => { if (ev.data.size > 0) chunks.push(ev.data); };
    recorder.onstop = () => {
      const mime = recorder.mimeType || 'audio/webm';
      const blob = new Blob(chunks, { type:mime });
      setSample(blob, `Rekaman ${new Date().toLocaleTimeString('id-ID')}`);
      recordingStream?.getTracks().forEach(t => t.stop());
      recordingStream = null;
      $('recordBtn').textContent = '● Mulai Rekam';
      $('recordBtn').classList.remove('recording');
      $('recordBtn').disabled = false;
    };
    recorder.onerror = ev => toast('Gagal merekam: ' + (ev.error?.message || 'unknown error'));
    recorder.start(200);
    $('recordBtn').textContent = '■ Selesai Rekam'; $('recordBtn').classList.add('recording');
    toast('Sedang merekam. Ucapkan 1–2 kalimat dengan suara jernih selama 5–10 detik.');
  } catch (e) { toast('Tidak bisa akses mikrofon: ' + (e.message || e)); }
}
async function decodeClip(blob) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  try {
    const data = await ctx.decodeAudioData(await blob.arrayBuffer());
    if (data.duration < 2) throw new Error('Rekaman minimal 2 detik. Ideal 5–10 detik.');
    // Cap reference at 15 seconds to limit CPU and browser memory.
    const len = Math.min(data.length, Math.floor(data.sampleRate * 15));
    const mono = new Float32Array(len);
    for (let ch = 0; ch < data.numberOfChannels; ch++) {
      const channel = data.getChannelData(ch);
      for (let i = 0; i < len; i++) mono[i] += channel[i] / data.numberOfChannels;
    }
    return { mono, rate:data.sampleRate, duration:data.duration };
  } finally { await ctx.close(); }
}
async function cloneFromBlob(blob, refId) {
  if (!engine) throw new Error('Aktifkan mesin AI terlebih dahulu.');
  const decoded = await decodeClip(blob);
  const reference = await engine.cloneVoice(decoded.mono, { inputSampleRate: decoded.rate, name: `profile:${refId}` });
  if (!reference) throw new Error('AI tidak mengembalikan profil suara.');
  return reference;
}
async function cloneVoice() {
  if (!draftBlob) { toast('Upload atau rekam suara kamu terlebih dahulu.'); return; }
  if (!$('consent').checked) { toast('Konfirmasi bahwa suara ini milikmu atau sudah mendapat izin.'); return; }
  if (!engine) { toast('Klik Aktifkan AI terlebih dahulu.'); return; }
  const name = $('voiceName').value.trim() || `Suara Saya ${profiles.length+1}`;
  $('cloneBtn').disabled = true; text('cloneStatus', 'Sedang mengekstrak karakter suara dari audio...');
  try {
    const id = crypto.randomUUID();
    const ref = await cloneFromBlob(draftBlob, id);
    const record = { id, name, blob:draftBlob, created:Date.now() };
    await saveVoice(record);
    profiles.unshift(record); refs.set(id, ref); activeProfileId = id;
    renderProfiles();
    text('cloneStatus', `✓ Profil ${name} berhasil dibuat dan disimpan di browser.`);
    toast('Cloning selesai. Ketik naskah dan pilih Generate Narration.');
  } catch (e) {
    text('cloneStatus', 'Gagal cloning: ' + (e.message || e)); toast('Gagal cloning: ' + (e.message || e));
  } finally { $('cloneBtn').disabled = generating; }
}
async function ensureVoice(profile) {
  if (!engine) throw new Error('Model belum dimuat.');
  if (refs.has(profile.id)) return refs.get(profile.id);
  text('generateStatus', `Memuat kembali profil suara ${profile.name} dari sampel tersimpan...`);
  const ref = await cloneFromBlob(profile.blob, profile.id);
  refs.set(profile.id, ref);
  return ref;
}
function splitScript(source, maxLen=225) {
  const sentences = source.replace(/\s+/g,' ').trim().match(/[^.!?]+[.!?]*/g) || [];
  const pieces=[]; let buffer='';
  for (const sentenceRaw of sentences) {
    const sentence=sentenceRaw.trim(); if (!sentence) continue;
    if (buffer && buffer.length + sentence.length + 1 > maxLen) { pieces.push(buffer); buffer=''; }
    if (sentence.length > maxLen) {
      let part='';
      for (const word of sentence.split(/\s+/)) {
        if (part && part.length + word.length + 1 > maxLen) { pieces.push(part); part=''; }
        if (word.length > maxLen) { if(part){pieces.push(part);part='';} for(let i=0;i<word.length;i+=maxLen) pieces.push(word.slice(i,i+maxLen)); }
        else part += (part?' ':'') + word;
      }
      if (part) buffer=part;
    } else buffer += (buffer?' ':'')+sentence;
  }
  if (buffer) pieces.push(buffer);
  return pieces;
}
async function generateAudio() {
  if (generating) return;
  if (!engine) { toast('Aktifkan AI terlebih dahulu.'); return; }
  if (!activeProfileId) { toast('Clone dan pilih profil suaramu terlebih dahulu.'); return; }
  const profile = profiles.find(p => p.id === activeProfileId);
  if (!profile) { toast('Profil suara tidak ditemukan.'); return; }
  const script = $('scriptText').value.trim();
  if (!script) { toast('Masukkan naskah terlebih dahulu.'); return; }
  if ($('language').value !== 'english_2026-04') { toast('Saat ini hanya model bahasa Inggris yang tersedia.'); return; }
  const pieces = splitScript(script);
  if (!pieces.length) { toast('Naskah tidak valid.'); return; }
  setBusy(true); stopRequested=false;
  const chunks=[]; let totalSec=0;
  try {
    const ref = await ensureVoice(profile);
    for (let i=0; i<pieces.length; i++) {
      if(stopRequested) break;
      text('generateStatus', `AI sedang membuat narasi bagian ${i+1} dari ${pieces.length}...`);
      await engine.generate(pieces[i], {
        voice:ref,
        onChunk:(audio) => { if(audio?.length) { chunks.push(new Float32Array(audio)); totalSec+=audio.length/engine.sampleRate; } }
      });
    }
    if (stopRequested) { text('generateStatus','Proses dihentikan. Tidak menyimpan audio parsial.'); return; }
    if(!chunks.length) throw new Error('AI tidak menghasilkan sampel audio.');
    outputBlob = chunksToWavBlob(chunks, engine.sampleRate);
    outputUrl=audioObjectUrl(outputBlob, outputUrl);
    $('outputAudio').src=outputUrl;
    $('audioResult').hidden=false; $('emptyOutput').hidden=true;
    text('resultTitle', `${profile.name} — Narration`);
    text('resultMeta', `${Math.round(totalSec)} detik · ${formatSize(outputBlob.size)} · WAV`);
    text('generateStatus', `✓ Narasi selesai dibuat. Durasi sekitar ${Math.round(totalSec)} detik. Klik play atau download WAV.`);
    const record={ id:crypto.randomUUID(), name:profile.name, snippet:script.slice(0,90), created:Date.now(), blob:outputBlob };
    try {
      await saveHistory(record); history.unshift(record);
      if(history.length>MAX_HISTORY){const removed=history.splice(MAX_HISTORY); for(const x of removed) await deleteHistory(x.id);}
      renderHistory();
    } catch (e) { toast('Audio siap, tetapi tidak tersimpan ke history: ' + e.message); }
    toast('Narasi berhasil dibuat! Silakan download WAV.');
  } catch(e) { text('generateStatus','Gagal generate: '+(e.message||e)); toast('Generate gagal: '+(e.message||e)); }
  finally {setBusy(false);}
}
function download(blob, filename) {
  const url = URL.createObjectURL(blob); const a=document.createElement('a');
  a.href=url; a.download=filename; document.body.append(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),15000);
}
function downloadOutput() { if(outputBlob) download(outputBlob, `voiceclone-${safeName(profiles.find(p=>p.id===activeProfileId)?.name || 'narration')}-${Date.now()}.wav`); }
function renderProfiles() {
  const targets=[$('voiceList'),$('voicesPageList')];
  for(const root of targets) {
    root.replaceChildren();
    if(!profiles.length){ const el=document.createElement('div'); el.className='empty'; el.textContent='Belum ada profil. Buka Narration Studio, rekam suara lalu Clone My Voice.'; root.append(el); continue; }
    for (const profile of profiles) {
      const el=document.createElement('div'); el.className='voice-item'+(activeProfileId===profile.id?' active':'');
      const avatar=document.createElement('div'); avatar.className='voice-avatar'; avatar.textContent='♫';
      const meta=document.createElement('div'); meta.className='voice-meta';
      const strong=document.createElement('strong');strong.textContent=profile.name;
      const small=document.createElement('small');small.textContent=formatDate(profile.created)+' · '+formatSize(profile.blob.size);
      meta.append(strong,small);
      const btn=makeBtn(activeProfileId===profile.id?'✓ Dipilih':'Gunakan','tiny-btn',()=>{activeProfileId=profile.id;renderProfiles();});
      const del=makeBtn('×','tiny-btn delete', async()=>{
        if(!confirm(`Hapus profil "${profile.name}" dari browser ini?`)) return;
        try {await deleteVoice(profile.id); profiles=profiles.filter(p=>p.id!==profile.id);refs.delete(profile.id);if(activeProfileId===profile.id)activeProfileId=profiles[0]?.id||'';renderProfiles();toast('Profil dihapus.');}catch(e){toast('Gagal menghapus: '+e.message);}
      });
      el.append(avatar,meta,btn,del);root.append(el);
    }
  }
  const select=$('selectedVoice');select.replaceChildren();
  const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Pilih suara cloning...';select.append(placeholder);
  for(const p of profiles){const opt=document.createElement('option');opt.value=p.id;opt.textContent=p.name;select.append(opt);}
  select.value=activeProfileId;
}
function renderHistory() {
  const root=$('historyList');root.replaceChildren();
  if(!history.length){const el=document.createElement('div');el.className='empty';el.textContent='Belum ada narasi yang dihasilkan.';root.append(el);return;}
  for(const r of history){
    const el=document.createElement('div');el.className='history-item';
    const icon=document.createElement('div');icon.className='voice-avatar';icon.textContent='▥';
    const meta=document.createElement('div');meta.className='history-item-info';
    const s=document.createElement('strong');s.textContent=r.snippet||r.name;
    const m=document.createElement('small');m.textContent=`${r.name} · ${formatDate(r.created)} · ${formatSize(r.blob.size)}`;meta.append(s,m);
    const down=makeBtn('↓ WAV','tiny-btn',()=>download(r.blob,`voiceclone-${safeName(r.name)}-${r.id.slice(0,6)}.wav`));
    const del=makeBtn('×','tiny-btn delete',async()=>{try{await deleteHistory(r.id);history=history.filter(x=>x.id!==r.id);renderHistory();}catch(e){toast(e.message);}});
    el.append(icon,meta,down,del);root.append(el);
  }
}
function showView(name) {
  for (const view of ['studio','voices','history']) $(view+'View').hidden=view!==name;
  const titles={studio:'Narration Studio',voices:'My Voice Library',history:'Audio History'};
  text('pageName', titles[name]);
  document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
}
function setup() {
  $('loadModelBtn').addEventListener('click',loadModel);
  $('cloneBtn').addEventListener('click',cloneVoice);
  $('recordBtn').addEventListener('click',startStopRecording);
  $('generateBtn').addEventListener('click',generateAudio);
  $('downloadBtn').addEventListener('click',downloadOutput);
  $('stopBtn').addEventListener('click',()=>{stopRequested=true;engine?.stop().catch(()=>{});text('generateStatus','Menghentikan...');});
  $('fileInput').addEventListener('change',e=>{const file=e.target.files?.[0]; if(file)setSample(file,file.name);});
  const dz=$('dropZone');
  dz.addEventListener('click',()=> $('fileInput').click());
  dz.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('fileInput').click();}});
  dz.addEventListener('dragover',e=>{e.preventDefault();dz.classList.add('drag');});
  dz.addEventListener('dragleave',()=>dz.classList.remove('drag'));
  dz.addEventListener('drop',e=>{e.preventDefault();dz.classList.remove('drag');const f=e.dataTransfer.files[0];if(f&&(/audio/.test(f.type)||/\.(wav|mp3|m4a|webm)$/i.test(f.name)))setSample(f,f.name);else toast('Pilih file audio yang valid.');});
  $('scriptText').addEventListener('input',()=>text('charCount',`${$('scriptText').value.length.toLocaleString('id-ID')} / 1.200 karakter`));
  $('selectedVoice').addEventListener('change',e=>{activeProfileId=e.target.value;renderProfiles();});
  document.querySelectorAll('[data-script]').forEach(b=>b.addEventListener('click',()=>{$('scriptText').value=TEMPLATES[b.dataset.script];$('scriptText').dispatchEvent(new Event('input'));}));
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
  if (!window.isSecureContext) setEngineStatus('HTTPS diperlukan','Voice cloning browser memerlukan HTTPS atau localhost untuk akses mikrofon dan penyimpanan.',-1);
  Promise.all([getVoices(),getHistory()]).then(([v,h])=>{
    profiles=(v||[]).sort((a,b)=>b.created-a.created);
    history=(h||[]).sort((a,b)=>b.created-a.created).slice(0,MAX_HISTORY);
    activeProfileId=profiles[0]?.id||'';
    renderProfiles();renderHistory();
  }).catch(e=>toast('Penyimpanan browser tidak tersedia: '+e.message));
}
setup();
