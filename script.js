"use strict";

/* ====================== تنظیمات و داده‌ها ====================== */
const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_URL = "https://api.open-meteo.com/v1/forecast";

const QUICK_PLACES = ["تهران", "پاریس", "توکیو", "نیویورک", "دبی", "مسکو", "قاهره", "سیدنی"];

// کد آب‌وهوای WMO -> متن، آیکون، تم و افکت
function describeWeather(code, isDay) {
  const day = isDay === 1;
  if (code === 0)  return { text: day ? "آسمان صاف و آفتابی" : "آسمان صاف", icon: day ? "☀️" : "🌙", theme: day ? "clear-day" : "clear-night", fx: day ? "none" : "stars" };
  if (code === 1)  return { text: "عمدتاً صاف", icon: day ? "🌤️" : "🌙", theme: day ? "clear-day" : "clear-night", fx: day ? "none" : "stars" };
  if (code === 2)  return { text: "نیمه‌ابری", icon: day ? "⛅" : "☁️", theme: "cloudy", fx: "none" };
  if (code === 3)  return { text: "ابری", icon: "☁️", theme: "cloudy", fx: "none" };
  if (code === 45 || code === 48) return { text: "مه‌آلود", icon: "🌫️", theme: "fog", fx: "none" };
  if (code >= 51 && code <= 57)   return { text: "نم‌نم باران", icon: "🌦️", theme: "rain", fx: "rain" };
  if (code >= 61 && code <= 67)   return { text: "بارانی", icon: "🌧️", theme: "rain", fx: "rain" };
  if (code >= 71 && code <= 77)   return { text: "برفی", icon: "❄️", theme: "snow", fx: "snow" };
  if (code >= 80 && code <= 82)   return { text: "رگبار", icon: "🌧️", theme: "rain", fx: "rain" };
  if (code === 85 || code === 86) return { text: "بارش شدید برف", icon: "🌨️", theme: "snow", fx: "snow" };
  if (code >= 95)                 return { text: "طوفان و رعدوبرق", icon: "⛈️", theme: "storm", fx: "rain" };
  return { text: "نامشخص", icon: "🌡️", theme: "default", fx: "none" };
}

const COMPASS = ["شمال", "شمال شرق", "شرق", "جنوب شرق", "جنوب", "جنوب غرب", "غرب", "شمال غرب"];
const windDirection = deg => COMPASS[Math.round(deg / 45) % 8];

/* ====================== المنت‌ها ====================== */
const $ = id => document.getElementById(id);
const form = $("searchForm");
const input = $("cityInput");
const statusBox = $("status");
const resultBox = $("result");
const altBox = $("alternatives");

/* ====================== جستجو و دریافت داده ====================== */
async function searchPlace(query) {
  showLoading();
  altBox.innerHTML = "";
  try {
    const geoRes = await fetch(`${GEO_URL}?name=${encodeURIComponent(query)}&count=6&language=fa&format=json`);
    if (!geoRes.ok) throw new Error("geo");
    const geo = await geoRes.json();

    if (!geo.results || geo.results.length === 0) {
      showError("مکانی با این نام پیدا نشد. نام را دقیق‌تر بنویسید یا انگلیسی امتحان کنید.");
      return;
    }

    await loadWeather(geo.results[0]);

    // اگر چند نتیجه مشابه بود، نمایش برای انتخاب
    if (geo.results.length > 1) {
      geo.results.slice(1).forEach(place => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "chip";
        btn.textContent = placeLabel(place);
        btn.addEventListener("click", async () => {
          showLoading();
          altBox.innerHTML = "";
          try { await loadWeather(place); } catch { showError("دریافت اطلاعات ناموفق بود."); }
        });
        altBox.appendChild(btn);
      });
    }
  } catch (err) {
    showError("خطا در ارتباط با سرور. اتصال اینترنت خود را بررسی کنید و دوباره تلاش کنید.");
  }
}

function placeLabel(p) {
  return [p.name, p.admin1, p.country].filter((v, i, a) => v && a.indexOf(v) === i).join("، ");
}

async function loadWeather(place) {
  const params = new URLSearchParams({
    latitude: place.latitude,
    longitude: place.longitude,
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,wind_direction_10m,weather_code,is_day",
    wind_speed_unit: "kmh",
    timezone: "auto"
  });
  const res = await fetch(`${WEATHER_URL}?${params}`);
  if (!res.ok) throw new Error("weather");
  const data = await res.json();
  render(place, data.current);
}

/* ====================== نمایش ====================== */
function render(place, c) {
  const info = describeWeather(c.weather_code, c.is_day);

  $("place").textContent = placeLabel(place);
  $("localTime").textContent = "زمان محلی: " + formatLocalTime(c.time);
  $("icon").textContent = info.icon;
  $("icon").setAttribute("aria-label", info.text);
  $("condition").textContent = info.text;
  $("temp").textContent = `${Math.round(c.temperature_2m)}°C`;
  $("feels").textContent = `احساس واقعی: ${Math.round(c.apparent_temperature)}°C`;
  $("humidity").textContent = `${c.relative_humidity_2m}%`;
  $("wind").textContent = `${Math.round(c.wind_speed_10m)} km/h`;
  $("windDir").textContent = windDirection(c.wind_direction_10m);

  setTheme(info.theme);
  setEffect(info.fx);

  statusBox.classList.add("d-none");
  resultBox.classList.remove("d-none");
  // اجرای دوباره انیمیشن کارت
  const card = resultBox.querySelector(".glass-card");
  card.style.animation = "none"; void card.offsetWidth; card.style.animation = "";
}

function formatLocalTime(iso) {
  // iso مثل 2026-10-15T14:30 (به وقت محلی خود مکان)
  const [d, t] = iso.split("T");
  return `${d.replace(/-/g, "/")} - ${t}`;
}

function setTheme(name) {
  document.body.className = `theme-${name}`;
}

function showLoading() {
  resultBox.classList.add("d-none");
  statusBox.classList.remove("d-none");
  statusBox.innerHTML = '<div class="spinner-ring mb-3"></div><div>در حال دریافت اطلاعات...</div>';
}

function showError(msg) {
  resultBox.classList.add("d-none");
  statusBox.classList.remove("d-none");
  statusBox.innerHTML = "";
  const alert = document.createElement("div");
  alert.className = "alert alert-warning d-inline-block mb-0";
  alert.textContent = msg;
  statusBox.appendChild(alert);
}

/* ====================== افکت‌های پس‌زمینه (باران / برف / ستاره) ====================== */
const canvas = $("fx");
const ctx = canvas.getContext("2d");
let particles = [];
let fxMode = "none";
let rafId = null;

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  if (fxMode !== "none") initParticles();
}
window.addEventListener("resize", resizeCanvas);

function initParticles() {
  const w = canvas.width, h = canvas.height;
  const count = fxMode === "rain" ? Math.min(220, Math.floor(w / 6))
              : fxMode === "snow" ? Math.min(120, Math.floor(w / 12))
              : Math.min(110, Math.floor(w / 14));
  particles = Array.from({ length: count }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    r: fxMode === "snow" ? Math.random() * 3 + 1 : fxMode === "stars" ? Math.random() * 1.6 + 0.4 : 0,
    len: Math.random() * 14 + 10,
    v: fxMode === "rain" ? Math.random() * 10 + 14 : Math.random() * 1.5 + 0.8,
    phase: Math.random() * Math.PI * 2
  }));
}

function setEffect(mode) {
  fxMode = mode;
  cancelAnimationFrame(rafId);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (mode === "none") return;
  initParticles();
  animate();
}

function animate() {
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  particles.forEach(p => {
    if (fxMode === "rain") {
      ctx.strokeStyle = "rgba(200, 220, 255, 0.55)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - 2, p.y + p.len);
      ctx.stroke();
      p.y += p.v; p.x -= 0.6;
      if (p.y > h) { p.y = -20; p.x = Math.random() * w; }
    } else if (fxMode === "snow") {
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      p.phase += 0.02;
      p.y += p.v; p.x += Math.sin(p.phase) * 0.6;
      if (p.y > h) { p.y = -10; p.x = Math.random() * w; }
    } else if (fxMode === "stars") {
      p.phase += 0.03;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.4 + Math.abs(Math.sin(p.phase)) * 0.6})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y * 0.8, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  rafId = requestAnimationFrame(animate);
}

/* ====================== رویدادها ====================== */
form.addEventListener("submit", e => {
  e.preventDefault();
  const q = input.value.trim();
  if (q) searchPlace(q);
});

QUICK_PLACES.forEach(name => {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "chip";
  btn.textContent = name;
  btn.addEventListener("click", () => { input.value = name; searchPlace(name); });
  $("quick").appendChild(btn);
});

resizeCanvas();
searchPlace("تهران"); // نمایش اولیه