// app.js (ES module)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

/** ====== Firebase config (senin projen) ====== */
const firebaseConfig = {
  apiKey: "AIzaSyDsT3H0PL_6tRLEvSdK4pzYih0jJXHL6Qc",
  authDomain: "gps-panel-7aff9.firebaseapp.com",
  databaseURL: "https://gps-panel-7aff9-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "gps-panel-7aff9",
  storageBucket: "gps-panel-7aff9.firebasestorage.app",
  messagingSenderId: "815455099474",
  appId: "1:815455099474:web:94009b9f94b410dc235d8b",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const LEV_PATH = "live/levent";

// storage keys
const WHO_KEY = "zey_who";
const MYLOC_KEY = "zey_myloc";
const DUTY_KEY = "zey_duty";
const STATUS_KEY = "zey_status";

// helpers
const $ = (id) => document.getElementById(id);
const toastEl = $("toast");
const rainEl = $("rain");
const eqEl = $("eq");
const heartEl = $("heart");
const heartTextEl = $("heartText");

let toastT = null;
function toast(msg){
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastT);
  toastT = setTimeout(() => toastEl.classList.remove("show"), 1800);
}
function fmtTime(ts){
  try { return new Date(ts).toLocaleTimeString("tr-TR", { hour:"2-digit", minute:"2-digit" }); }
  catch { return "—"; }
}

// clock
function tickClock(){
  const now = new Date();
  $("clock").textContent = now.toLocaleString("tr-TR", { weekday:"short", hour:"2-digit", minute:"2-digit" });
}
tickClock();
setInterval(tickClock, 20_000);

// cute lines
const cuteLines = [
  "Bugün kendine nazik davran. Minik bir kahve molası bile yeter ☕",
  "Yağmur varsa bile… şemsiye + sıcak sohbet = tamam 🌧️💛",
  "Bir mesaj kadar yakınız 🙂",
  "Nöbet öncesi: su içmeyi unutma 💧",
  "Şu an tek hedef: günün içinden yumuşak geçmek 🌿",
];
function setCuteLine(){
  $("cuteLine").textContent = cuteLines[Math.floor(Math.random() * cuteLines.length)];
}
setCuteLine();
setInterval(setCuteLine, 60_000);

// state
let who = localStorage.getItem(WHO_KEY) || "";
let isDuty = localStorage.getItem(DUTY_KEY) === "1";
let zStatus = localStorage.getItem(STATUS_KEY) || ""; // "" | free | busy | rest

// calm mode toggle (duty -> calm)
function applyCalmMode(){
  document.body.classList.toggle("calm", isDuty);
}

// who mode
function setWho(v){
  who = v;
  localStorage.setItem(WHO_KEY, v);

  $("btnZeynep").setAttribute("aria-pressed", v === "zeynep" ? "true" : "false");
  $("btnLevent").setAttribute("aria-pressed", v === "levent" ? "true" : "false");
  $("whoBadge").textContent = `Mod: ${v ? (v === "zeynep" ? "Zeynep" : "Levent") : "—"}`;

  if(v === "zeynep"){
    $("greeting").textContent = "Selam Zeynep 🙂";
    $("hintLine").textContent = "Konumunu açarsan: hava + yağmur + uzaklık hemen gelir.";
    $("btnTrackStart").disabled = true;
    $("btnTrackStop").disabled = true;

    heartEl?.classList.add("beat");
    if(heartTextEl) heartTextEl.textContent = "Zeynep modu";

  } else if(v === "levent"){
    $("greeting").textContent = "Selam Levent 🙂";
    $("hintLine").textContent = "Takibi başlatırsan Zeynep uzaklığı canlı görür.";
    $("btnTrackStart").disabled = false;
    $("btnTrackStop").disabled = false;

    heartEl?.classList.remove("beat");
    if(heartTextEl) heartTextEl.textContent = "Levent modu";

  } else {
    $("greeting").textContent = "Selam 🙂";
    $("hintLine").textContent = "Önce kim olduğunu seç: Zeynep mi Levent mi?";
    $("btnTrackStart").disabled = true;
    $("btnTrackStop").disabled = true;

    heartEl?.classList.remove("beat");
    if(heartTextEl) heartTextEl.textContent = "mod seç";
  }

  updateDistanceUI();
}

$("btnZeynep").addEventListener("click", () => { setWho("zeynep"); toast("Zeynep modu ✅"); });
$("btnLevent").addEventListener("click", () => { setWho("levent"); toast("Levent modu ✅"); });

// music
const bgm = $("bgm");
let musicOn = false;

async function toggleMusic(){
  musicOn = !musicOn;
  $("btnMusic").setAttribute("aria-pressed", musicOn ? "true" : "false");
  $("btnMusic").textContent = `Müzik: ${musicOn ? "Açık" : "Kapalı"}`;

  if(musicOn){
    try{
      bgm.volume = 0.35;
      await bgm.play();
      eqEl?.classList.add("on");
      toast("Müzik açıldı 🎧");
    }catch{
      musicOn = false;
      $("btnMusic").setAttribute("aria-pressed", "false");
      $("btnMusic").textContent = "Müzik: Kapalı";
      eqEl?.classList.remove("on");
      toast("Müzik için dokunup tekrar dene 🙂");
    }
  } else {
    bgm.pause();
    eqEl?.classList.remove("on");
    toast("Müzik kapandı 🌙");
  }
}
$("btnMusic").addEventListener("click", toggleMusic);

// my location (Zeynep or Levent - used for weather & distance)
function saveMyLoc(lat, lon, acc){
  // privacy: 4 decimals (~11m)
  const safeLat = Math.round(lat * 10000) / 10000;
  const safeLon = Math.round(lon * 10000) / 10000;
  const obj = { lat: safeLat, lon: safeLon, acc: acc ?? 0, at: Date.now() };
  localStorage.setItem(MYLOC_KEY, JSON.stringify(obj));
  return obj;
}
function loadMyLoc(){
  try{
    const raw = localStorage.getItem(MYLOC_KEY);
    return raw ? JSON.parse(raw) : null;
  }catch{ return null; }
}
let myLoc = loadMyLoc();
let leventLoc = null;

$("btnMyLoc").addEventListener("click", () => {
  if(!navigator.geolocation){
    toast("Konum desteklenmiyor 🙃");
    return;
  }
  toast("Konum alınıyor…");
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      myLoc = saveMyLoc(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
      $("locStatus").textContent = `Konum açık ✅ (son: ${fmtTime(myLoc.at)})`;
      toast("Konum alındı ✅");
      fetchWeatherForMine();
      updateDistanceUI();
    },
    () => toast("Konum izni verilmedi 🙂"),
    { enableHighAccuracy:false, timeout:12000, maximumAge: 2*60*1000 }
  );
});

// weather (Open-Meteo)
async function fetchWeather(lat, lon){
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}`
    + `&current=temperature_2m,wind_speed_10m`
    + `&hourly=precipitation_probability`
    + `&forecast_days=1&timezone=auto`;

  const res = await fetch(url);
  if(!res.ok) throw new Error("weather_fetch_failed");
  return await res.json();
}
function rainAdvice(prob){
  if(prob >= 60) return "Şemsiye önerilir ☔  •  Nöbete çıkacaksan ekstra dikkat: ıslak zemin + acele = kayma riski 🙂";
  if(prob >= 30) return "Yağmur ihtimali var 🌦️  •  Yanına ince bir şey almak iyi olur.";
  return "Yağmur düşük 🌤️  •  Bugün yumuşak bir yürüyüş iyi gelebilir.";
}
async function fetchWeatherForMine(){
  if(!myLoc) return;
  try{
    const data = await fetchWeather(myLoc.lat, myLoc.lon);
    const t = Math.round(data?.current?.temperature_2m);
    const w = Math.round(data?.current?.wind_speed_10m);
    const probs = data?.hourly?.precipitation_probability || [];
    const next3 = probs.slice(0, 3);
    const rain = next3.length ? Math.round(next3.reduce((a,b)=>a+b,0)/next3.length) : 0;

    $("wxTemp").textContent = Number.isFinite(t) ? `${t}°` : "—";
    $("wxMeta").textContent = `Son güncelleme: ${fmtTime(Date.now())}`;
    $("wxRain").textContent = `Yağmur riski: %${rain}`;
    $("wxWind").textContent = `Rüzgar: ${Number.isFinite(w) ? w : "—"} km/s`;
    $("wxAdvice").textContent = rainAdvice(rain);

    // rain overlay: >=60%
    if (rainEl) {
      if (rain >= 60) rainEl.classList.add("on");
      else rainEl.classList.remove("on");
    }
  }catch{
    $("wxMeta").textContent = "Hava alınamadı (internet?)";
    toast("Hava durumu alınamadı 🙃");
  }
}

// distance
function haversineKm(lat1, lon1, lat2, lon2){
  const R = 6371;
  const toRad = (x) => x * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat/2)**2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
function updateDistanceUI(){
  if(!leventLoc){
    $("distKm").textContent = "—";
    $("distMeta").textContent = "Levent konumu bekleniyor.";
    $("levStatus").textContent = "Levent canlı konumu: —";
    return;
  }

  const last = leventLoc.at ? `Son: ${fmtTime(leventLoc.at)}` : "—";
  $("levStatus").textContent = `Levent canlı konumu: hazır ✅ (${last})`;

  if(!myLoc){
    $("distKm").textContent = "—";
    $("distMeta").textContent = "Uzaklık için Zeynep konumu da açık olmalı 🙂";
    return;
  }

  const km = haversineKm(myLoc.lat, myLoc.lon, leventLoc.lat, leventLoc.lon);
  const kmRound = km < 10 ? km.toFixed(1) : Math.round(km).toString();
  $("distKm").textContent = `~${kmRound} km`;

  // pulse on update
  $("distKm").classList.remove("pulse");
  void $("distKm").offsetWidth;
  $("distKm").classList.add("pulse");

  // cute message by distance
  let msg = "Bir mesaj kadar yakınız 💛";
  if(km >= 200) msg = "Uzaklık var ama niyet daha yakın 💛";
  else if(km >= 50) msg = "Az kaldı… bir kahve mesafesi 💛";
  else if(km >= 10) msg = "Yakınız 🙂";
  else msg = "Çok yakınız 😄";

  $("distMeta").textContent = `${msg} • ${last}`;
}

// firebase listen
onValue(ref(db, LEV_PATH), (snap) => {
  const v = snap.val();
  if(!v){
    leventLoc = null;
    updateDistanceUI();
    return;
  }
  leventLoc = { lat: v.lat, lon: v.lon, at: v.at || Date.now() };
  updateDistanceUI();
});

// Levent tracking (watchPosition)
let watchId = null;

async function writeLeventLocation(lat, lon){
  const safeLat = Math.round(lat * 10000) / 10000;
  const safeLon = Math.round(lon * 10000) / 10000;
  await set(ref(db, LEV_PATH), { lat: safeLat, lon: safeLon, at: Date.now() });
}

$("btnTrackStart").addEventListener("click", () => {
  if(who !== "levent"){
    toast("Bu buton Levent için 🙂");
    return;
  }
  if(!navigator.geolocation){
    toast("Konum desteklenmiyor 🙃");
    return;
  }
  if(watchId !== null){
    toast("Takip zaten açık ✅");
    return;
  }

  toast("Levent takibi başlıyor…");
  watchId = navigator.geolocation.watchPosition(
    async (pos) => {
      try{
        await writeLeventLocation(pos.coords.latitude, pos.coords.longitude);
        $("levStatus").textContent = `Levent canlı konumu: güncellendi ✅ (${fmtTime(Date.now())})`;
      }catch{
        // ignore
      }
    },
    () => toast("Konum izni/veri hatası 🙂"),
    { enableHighAccuracy:false, timeout:12000, maximumAge: 5000 }
  );
  toast("Takip başladı ✅ (sayfa açıkken)");
});

$("btnTrackStop").addEventListener("click", () => {
  if(watchId !== null){
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
    toast("Takip durdu 🌙");
  } else {
    toast("Takip zaten kapalı 🙂");
  }
});

// nudge
$("btnNudge").addEventListener("click", () => {
  const n = [
    "Hızlı bir 3+0 atalım mı? 🙂",
    "Bir el satranç? Ben hazırım ♟️",
    "Bugün açılışın güzeldi, devam? 😄",
    "Yorgunsan sorun değil, ben buradayım 💛",
  ];
  toast(n[Math.floor(Math.random()*n.length)]);
});

// duty UI + calm mode
function syncDutyUI(){
  $("btnDuty").textContent = `Nöbet: ${isDuty ? "Açık" : "Kapalı"}`;
  $("btnDuty").classList.remove("warn","soft");
  $("btnDuty").classList.add(isDuty ? "warn" : "soft");

  applyCalmMode();

  if(isDuty){
    $("statusNote").textContent = "Nöbet modunda: su + mini mola 💧🙂 (arka plan daha sakin)";
  } else {
    // status note will be handled by status
    if (!zStatus) $("statusNote").textContent = "—";
  }
}
$("btnDuty").addEventListener("click", () => {
  isDuty = !isDuty;
  localStorage.setItem(DUTY_KEY, isDuty ? "1" : "0");
  syncDutyUI();
  syncStatusUI(); // harmonize note
  toast(isDuty ? "Nöbet modu açık 🩺" : "Nöbet modu kapalı 🌿");
});

// status UI
function syncStatusUI(){
  const btn = $("btnStatus");
  btn.classList.remove("good","warn","soft");

  let label = "Durum: —";
  let note = "—";

  if(zStatus === "free"){
    label = "Durum: Müsaitim";
    btn.classList.add("good");
    note = "Müsait mod: küçük bir satranç oyunu keyifli olabilir ♟️";
  } else if(zStatus === "rest"){
    label = "Durum: Dinleniyorum";
    btn.classList.add("soft");
    note = "Dinlenme modunda her şey daha yumuşak… 🙂";
  } else if(zStatus === "busy"){
    label = "Durum: Yoğun";
    btn.classList.add("warn");
    note = "Yoğun mod: kısa ve tatlı mesajlar en iyisi 💛";
  } else {
    btn.classList.add("soft");
  }

  btn.textContent = label;

  if(isDuty && zStatus){
    $("statusNote").textContent = "Nöbet + durum: kendine nazik ol 💛";
  } else if(isDuty){
    $("statusNote").textContent = "Nöbet modunda: su + mini mola 💧🙂 (arka plan daha sakin)";
  } else {
    $("statusNote").textContent = note;
  }
}

$("btnStatus").addEventListener("click", () => {
  // cycle: "" -> free -> busy -> rest -> ""
  if(zStatus === "") zStatus = "free";
  else if(zStatus === "free") zStatus = "busy";
  else if(zStatus === "busy") zStatus = "rest";
  else zStatus = "";

  localStorage.setItem(STATUS_KEY, zStatus);
  syncStatusUI();

  const map = { free:"Müsait 🙂", busy:"Yoğun 🧡", rest:"Dinleniyorum 🌙", "":"Temizlendi" };
  toast(`Durum: ${map[zStatus]}`);
});

// init
setWho(who);
applyCalmMode();
syncDutyUI();
syncStatusUI();

if(myLoc){
  $("locStatus").textContent = `Konum açık ✅ (son: ${fmtTime(myLoc.at)})`;
  fetchWeatherForMine();
} else {
  $("locStatus").textContent = "Konum kapalı.";
}
updateDistanceUI();
