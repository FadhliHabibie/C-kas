// script.js - frontend shared
// Functions: register, login, logout, simpanHariIni, loadHistory, showDetail

async function register() {
  msg.textContent = "";
  const res = await fetch("/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.value, password: password.value })
  });
  const data = await res.json();
  if (data.token) {
    alert("Akun dibuat, silakan login");
    location.href = "index.html";
  } else {
    msg.textContent = data.error || "Gagal membuat akun";
  }
}

async function login() {
  msg.textContent = "";
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.value, password: password.value })
  });
  const data = await res.json();
  if (data.token) {
    localStorage.setItem("token", data.token);
    location.href = "dashboard.html";
  } else {
    msg.textContent = data.error || "Login gagal";
  }
}

function logout() {
  localStorage.removeItem("token");
  location.href = "index.html";
}

async function simpanHariIni() {
  const token = localStorage.getItem("token");
  if (!token) {
    alert("Silakan login ulang");
    location.href = "index.html";
    return;
  }

  const penjualan = Number(jual_input.value) || 0;
  const pengeluaran = Number(keluar_input.value) || 0;

  try {

    if (penjualan > 0) {
      const res1 = await fetch("/api/penjualan_add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token
        },
        body: JSON.stringify({
          jumlah: penjualan,
          keterangan: ""  // <--- FIX
        })
      });

      const d1 = await res1.json();
      if (d1.error) {
        alert("Error penjualan: " + d1.error);
        return;
      }
    }

    if (pengeluaran > 0) {
      const res2 = await fetch("/api/pengeluaran_add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token
        },
        body: JSON.stringify({
          jumlah: pengeluaran,
          keterangan: "" // <--- FIX
        })
      });

      const d2 = await res2.json();
      if (d2.error) {
        alert("Error pengeluaran: " + d2.error);
        return;
      }
    }

    // tampilkan hasil
    await tampilkanHasilDanGrafik();
    alert("Data berhasil disimpan!");

  } catch (e) {
    alert("Kesalahan jaringan: " + e.message);
  }
}


async function tampilkanHasilDanGrafik() {
  const token = localStorage.getItem("token");
  const res = await fetch("/api/history", {
    headers: { "Authorization": "Bearer " + token }
  });
  const data = await res.json();

  // hitung total hari ini
  const today = new Date().toISOString().slice(0,10);
  const penjualan_today = (data.penjualan || []).filter(x => x.tanggal === today).reduce((s,a)=>s + Number(a.jumlah), 0);
  const pengeluaran_today = (data.pengeluaran || []).filter(x => x.tanggal === today).reduce((s,a)=>s + Number(a.jumlah), 0);
  const laba = penjualan_today - pengeluaran_today;

  document.getElementById("penjualan_today").innerText = "Penjualan hari ini: Rp " + numberFormat(penjualan_today);
  document.getElementById("pengeluaran_today").innerText = "Pengeluaran hari ini: Rp " + numberFormat(pengeluaran_today);
  document.getElementById("laba_today").innerText = (laba >= 0 ? "Untung: Rp " : "Rugi: Rp ") + numberFormat(laba);

  document.getElementById("hasil_today").style.display = "block";

  // buat array hari minggu ini (Senin..Minggu) dengan nilai penjualan tiap hari
  const weekly = buildWeekArray(data.penjualan || []);

  // tampilkan grafik dengan Chart.js
  document.getElementById("grafik_section").style.display = "block";
  drawChart(Object.keys(weekly), Object.values(weekly));

  // prediksi: rata-rata pengeluaran 7 hari terakhir
  const prediksi = predictNextExpense(data.pengeluaran || [], data.acara || []);
  document.getElementById("prediksi_text").innerText =
    prediksi.text;
  document.getElementById("prediksi_section").style.display = "block";
}

// helper: number format
function numberFormat(n){
  return n.toLocaleString('id-ID');
}

// build week array (Mon..Sun) from penjualan list
function buildWeekArray(penjualan) {
  // get current week dates (Mon..Sun)
  const today = new Date();
  const day = today.getDay(); // 0 Sun .. 6 Sat
  // find monday
  const diffToMon = (day === 0 ? -6 : 1 - day);
  const mon = new Date(today);
  mon.setDate(today.getDate() + diffToMon);

  const labels = [];
  const values = {};
  for (let i=0;i<7;i++){
    const d = new Date(mon);
    d.setDate(mon.getDate()+i);
    const key = d.toISOString().slice(0,10);
    const label = d.toLocaleDateString('id-ID', { weekday: 'short' }); // Sen, Sel...
    labels.push(label);
    values[key] = 0;
  }

  penjualan.forEach(p => {
    const date = p.tanggal;
    if (values.hasOwnProperty(date)) values[date] += Number(p.jumlah);
  });

  // return object label->value
  const out = {};
  let i=0;
  for (const k in values) {
    out[labels[i]] = values[k];
    i++;
  }
  return out;
}

// draw chart
let chartInstance = null;
function drawChart(labels, dataPoints){
  const ctx = document.getElementById('chartLine').getContext('2d');
  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Penjualan (Rp)',
        data: dataPoints,
        borderWidth: 1
      }]
    },
    options: {
      scales: {
        y: { beginAtZero: true }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

// prediksi sederhana
function predictNextExpense(pengeluaranList, acaraList){
  // rata-rata 7 hari terakhir (by tanggal)
  const map = {};
  pengeluaranList.forEach(p => {
    map[p.tanggal] = (map[p.tanggal] || 0) + Number(p.jumlah);
  });
  const dates = Object.keys(map).sort().slice(-7); // last 7 days
  const sum = dates.reduce((s,d)=>s + (map[d]||0), 0);
  const avg = dates.length ? Math.round(sum / dates.length) : 0;

  // faktor hari
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dow = tomorrow.getDay(); // 0 Sun .. 6 Sat
  let faktorHari = 1.0;
  if (dow === 5) faktorHari = 0.8; // Jumat sepi
  if (dow === 6 || dow === 0) faktorHari = 0.7; // weekend sepi

  // cek acara untuk besok
  const tomorrowStr = tomorrow.toISOString().slice(0,10);
  const acaraBesok = (acaraList || []).some(a => a.tanggal === tomorrowStr);
  const faktorAcara = acaraBesok ? 1.2 : 1.0;

  const prediksi = Math.round(avg * faktorHari * faktorAcara);

  // pilih contoh kalimat: ambil pendapatan minggu lalu Senin kalau ada
  let contohKalimat = "";
  // find last week's Monday (if exists)
  const lastMon = new Date();
  lastMon.setDate(lastMon.getDate() - 7);
  while (lastMon.getDay() !== 1) lastMon.setDate(lastMon.getDate() - 1);
  const lastMonStr = lastMon.toISOString().slice(0,10);
  const lastMonPenjualan = (window.__historyData?.penjualan_by_day || {})[lastMonStr];
  const penMon = lastMonPenjualan ? lastMonPenjualan.reduce((s,a)=>s+Number(a.jumlah),0) : null;
  if (penMon) {
    contohKalimat = `Pendapatan minggu kemarin hari ${new Date(lastMonStr).toLocaleDateString('id-ID', { weekday: 'long' })}: Rp ${numberFormat(penMon)}.`;
  } else {
    contohKalimat = `Pendapatan minggu kemarin tidak cukup data.`;
  }

  return {
    value: prediksi,
    text: `${contohKalimat}\nBerdasarkan hasil tersebut, diperkirakan pengeluaran bahan baku besok: Rp ${numberFormat(prediksi)}.`
  };
}

// load history page
async function loadHistory() {
  const token = localStorage.getItem("token");
  if (!token) { location.href = "index.html"; return; }

  const res = await fetch("/api/history", { headers: { "Authorization": "Bearer " + token }});
  const data = await res.json();
  // store globally for prediksi helper
  window.__historyData = data;

  // build list of unique dates from penjualan & pengeluaran
  const datesSet = new Set();
  (data.penjualan || []).forEach(p => datesSet.add(p.tanggal));
  (data.pengeluaran || []).forEach(p => datesSet.add(p.tanggal));

  const dates = Array.from(datesSet).sort((a,b)=> b.localeCompare(a)); // desc
  const container = document.getElementById("days_list");
  container.innerHTML = "";
  dates.forEach(d => {
    const btn = document.createElement("button");
    const label = new Date(d).toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'short' });
    btn.textContent = label + " — " + d;
    btn.onclick = () => showDetailDay(d);
    container.appendChild(btn);
  });
}

async function showDetailDay(dateStr) {
  const data = window.__historyData;
  const pen = (data.penjualan_by_day || {})[dateStr] || [];
  const peng = (data.pengeluaran_by_day || {})[dateStr] || [];
  const penSum = pen.reduce((s,a)=>s+Number(a.jumlah),0);
  const pengSum = peng.reduce((s,a)=>s+Number(a.jumlah),0);
  const laba = penSum - pengSum;

  document.getElementById("detail_title").innerText = "Riwayat " + new Date(dateStr).toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long' });
  document.getElementById("detail_penjualan").innerText = "Penjualan: Rp " + numberFormat(penSum);
  document.getElementById("detail_pengeluaran").innerText = "Pengeluaran: Rp " + numberFormat(pengSum);
  document.getElementById("detail_laba").innerText = (laba>=0? "Untung: Rp ":"Rugi: Rp ") + numberFormat(laba);

  document.getElementById("detail_day").style.display = "block";
}

// if page load is dashboard, try to display existing data
document.addEventListener("DOMContentLoaded", async ()=> {
  const path = window.location.pathname;
  if (path.endsWith("dashboard.html")) {
    // ensure user logged in
    const token = localStorage.getItem("token");
    if (!token) { location.href = "index.html"; return; }
    // load history for chart/prediksi but don't show until simpan or request
    const res = await fetch("/api/history", { headers: { "Authorization": "Bearer " + token }});
    const data = await res.json();
    window.__historyData = data;
    // if there is penjualan today already, show results
    await tampilkanHasilDanGrafik();
  }

  if (path.endsWith("history.html")) {
    const token = localStorage.getItem("token");
    if (!token) { location.href = "index.html"; return; }
    await loadHistory();
  }
});

window.simpanHariIni = simpanHariIni;
window.logout = logout;




