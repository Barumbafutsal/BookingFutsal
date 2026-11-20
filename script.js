// === KONFIGURASI SCRIPT ===
const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbwgqi9ZRY7PzFDrP5omDib4ZzC2ro7U3hsOejQD_wSYaJv6Fq1dR5X-bK-cFT8_dM1r/exec";

let configSettings = {
  hargaSiang: 90000,
  hargaMalam: 120000,
  jamBukaSiang: 7,
  jamTutupSiang: 18,
  jamBukaMalam: 18,
  jamTutupMalam: 23,
  adminWaNumber: "6282230012582",
  minimalDp: 0,
};

let existingBookings = [];
let currentTotalHarga = 0;

const NAMA_HARI = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];

// Set Minimal Tanggal Input = Hari ini & Isi Hari Otomatis
const todayStr = getTodayISO();
const inputTanggal = document.getElementById("tanggal");
inputTanggal.min = todayStr;
inputTanggal.value = todayStr;
updateHariOtomatis();

window.addEventListener("DOMContentLoaded", initApp);

async function initApp() {
  const progressBar = document.getElementById("progress-bar");
  if (progressBar) progressBar.style.width = "50%";

  try {
    const response = await fetch(APPS_SCRIPT_URL);
    const result = await response.json();

    if (progressBar) progressBar.style.width = "100%";

    setTimeout(() => {
      document.getElementById("loading-screen").style.display = "none";

      if (result.status === "success") {
        if (result.settings) {
          configSettings = { ...configSettings, ...result.settings };
        }

        if (configSettings.isClosed) {
          document.getElementById("closed-screen").classList.remove("hidden");
          document.getElementById("booking-form").classList.add("hidden");
        } else {
          existingBookings = result.bookings || [];
          updateMinimalDpInfo();
          setupJamManualBounds(true);
          updateFormLogic();
        }
      } else {
        showModal(
          "Gagal Memuat Data",
          result.message || "Terjadi kesalahan pada server.",
        );
      }
    }, 400);
  } catch (err) {
    console.error("Error init:", err);
    showModal(
      "Koneksi Terputus",
      "Gagal terhubung ke server Google Sheets. Silakan muat ulang halaman.",
    );
  }
}

// === EVENT LISTENERS ===
document.getElementById("tanggal").addEventListener("change", () => {
  validateDateInput();
  updateHariOtomatis();
  updateFormLogic();
});

document.getElementById("kategori").addEventListener("change", () => {
  setupJamManualBounds(true);
  updateFormLogic();
});

document.getElementById("jamMulai").addEventListener("change", updateFormLogic);
document.getElementById("jamMulai").addEventListener("input", updateFormLogic);
document.getElementById("durasi").addEventListener("change", updateFormLogic);

// Toggle Metode Pembayaran (Tunai / DP)
document
  .getElementById("metodePembayaran")
  .addEventListener("change", handleMetodeChange);

// Format Ribuan Otomatis & Pembatasan Maksimal Nominal DP saat mengetik
document
  .getElementById("nominalDp")
  .addEventListener("input", handleNominalDpInput);

// === FUNGSI HELPER WAKTU & HARI ===
function updateHariOtomatis() {
  const selectedDate = document.getElementById("tanggal").value;
  const hariInput = document.getElementById("hari");
  if (!selectedDate) {
    hariInput.value = "";
    return;
  }
  const [year, month, day] = selectedDate.split("-").map(Number);
  const dateObj = new Date(year, month - 1, day);
  hariInput.value = NAMA_HARI[dateObj.getDay()] || "";
}

function validateDateInput() {
  const selectedDate = inputTanggal.value;
  if (selectedDate < todayStr) {
    showModal(
      "Tanggal Tidak Valid",
      "Anda tidak dapat memilih tanggal yang sudah berlalu.",
    );
    inputTanggal.value = todayStr;
  }
}

function setupJamManualBounds(resetValue = false) {
  const kategori = document.getElementById("kategori").value;
  const jamMulaiInput = document.getElementById("jamMulai");
  const infoJam = document.getElementById("info-jam-operasional");

  const startHour =
    kategori === "Siang"
      ? configSettings.jamBukaSiang
      : configSettings.jamBukaMalam;
  const endHour =
    kategori === "Siang"
      ? configSettings.jamTutupSiang
      : configSettings.jamTutupMalam;

  const minTimeStr = minutesToTime(startHour * 60);
  const maxTimeStr = minutesToTime(endHour * 60);

  jamMulaiInput.min = minTimeStr;
  jamMulaiInput.max = maxTimeStr;
  infoJam.textContent = `Operasional ${kategori}: ${minTimeStr} - ${maxTimeStr}`;

  if (resetValue || !jamMulaiInput.value) {
    jamMulaiInput.value = minTimeStr;
  }
}

function timeToMinutes(timeStr) {
  if (!timeStr || !timeStr.includes(":")) return NaN;
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + (m || 0);
}

function minutesToTime(totalMinutes) {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${h < 10 ? "0" + h : h}:${m < 10 ? "0" + m : m}`;
}

function formatDurasiLabel(durasiFloat) {
  if (durasiFloat === 1.5) return "1 Jam 30 Menit";
  if (durasiFloat === 2.5) return "2 Jam 30 Menit";
  return `${durasiFloat} Jam`;
}

// === LOGIKA PEMBAYARAN & NOMINAL DP ===
function updateMinimalDpInfo() {
  const infoEl = document.getElementById("info-minimal-dp");
  if (!infoEl) return;
  if (configSettings.minimalDp > 0) {
    infoEl.textContent = `Min. DP: Rp ${configSettings.minimalDp.toLocaleString("id-ID")}`;
  } else {
    infoEl.textContent = "Bebas sesuai kesepakatan";
  }
}

function handleMetodeChange() {
  const metode = document.getElementById("metodePembayaran").value;
  const dpContainer = document.getElementById("dp-container");
  const nominalDpInput = document.getElementById("nominalDp");

  if (metode === "DP") {
    dpContainer.classList.remove("hidden");
    nominalDpInput.required = true;
    updateSisaPembayaran();
  } else {
    dpContainer.classList.add("hidden");
    nominalDpInput.required = false;
    nominalDpInput.value = "";
    updateSisaPembayaran();
  }
}

function parseRupiahNumber(formattedStr) {
  const digitsOnly = (formattedStr || "").toString().replace(/\D/g, "");
  return digitsOnly ? parseInt(digitsOnly, 10) : 0;
}

function formatRibuan(num) {
  if (!num || num <= 0) return "";
  return num.toLocaleString("id-ID");
}

function handleNominalDpInput(e) {
  const input = e.target;
  // Bersihkan karakter non-angka dan angka 0 di depan otomatis
  let numericValue = parseRupiahNumber(input.value);

  // Otomatis membatasi agar tidak melebihi Total Biaya Pemesanan
  if (currentTotalHarga > 0 && numericValue > currentTotalHarga) {
    numericValue = currentTotalHarga;
  }

  input.value = formatRibuan(numericValue);
  updateSisaPembayaran();
}

function updateSisaPembayaran() {
  const dpNominal = parseRupiahNumber(
    document.getElementById("nominalDp").value,
  );
  const sisa = Math.max(0, currentTotalHarga - dpNominal);
  document.getElementById("sisaPembayaranText").textContent =
    "Rp " + sisa.toLocaleString("id-ID");
}

// === KALKULASI UTAMA FORM ===
function updateFormLogic() {
  const jamMulai = document.getElementById("jamMulai").value;
  const durasi = parseFloat(document.getElementById("durasi").value) || 1;
  const kategori = document.getElementById("kategori").value;
  const selectedDate = document.getElementById("tanggal").value;

  if (!jamMulai) return;

  // 1. Hitung Jam Selesai berbasis menit (mendukung durasi 1.5 dan 2.5 jam)
  const startMinutes = timeToMinutes(jamMulai);
  const durasiMinutes = Math.round(durasi * 60);
  const endMinutes = startMinutes + durasiMinutes;
  const jamSelesaiStr = minutesToTime(endMinutes);
  document.getElementById("jamSelesai").value = jamSelesaiStr;

  // 2. Hitung Total Harga Dinamis dari Settings
  const rate =
    kategori === "Siang"
      ? configSettings.hargaSiang
      : configSettings.hargaMalam;
  currentTotalHarga = Math.round(rate * durasi);
  document.getElementById("totalHarga").textContent =
    "Rp " + currentTotalHarga.toLocaleString("id-ID");

  // Sesuaikan batas nominal DP jika total harga berubah (misal durasi diperkecil)
  const nominalDpInput = document.getElementById("nominalDp");
  if (nominalDpInput && nominalDpInput.value) {
    let currentDp = parseRupiahNumber(nominalDpInput.value);
    if (currentDp > currentTotalHarga) {
      nominalDpInput.value = formatRibuan(currentTotalHarga);
    }
  }
  updateSisaPembayaran();

  // 3. Validasi Batas Jam Operasional Kategori (Siang / Malam)
  const opStartMinutes =
    (kategori === "Siang"
      ? configSettings.jamBukaSiang
      : configSettings.jamBukaMalam) * 60;
  const opEndMinutes =
    (kategori === "Siang"
      ? configSettings.jamTutupSiang
      : configSettings.jamTutupMalam) * 60;

  const isOutOfHours =
    startMinutes < opStartMinutes || endMinutes > opEndMinutes;

  // 4. Render Preview Jadwal & Check Overlap Berbasis Menit
  renderSchedulePreview(
    selectedDate,
    startMinutes,
    endMinutes,
    isOutOfHours,
    kategori,
  );
}

function renderSchedulePreview(
  selectedDate,
  currentStartMin,
  currentEndMin,
  isOutOfHours,
  kategori,
) {
  const previewContainer = document.getElementById("preview-schedule");
  previewContainer.innerHTML = "";

  const dayBookings = existingBookings.filter(
    (b) => b.tanggal === selectedDate,
  );
  let isConflict = false;

  if (dayBookings.length === 0) {
    previewContainer.innerHTML =
      '<div class="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-medium text-center">Belum ada bookingan pada tanggal ini.</div>';
  } else {
    dayBookings.forEach((b) => {
      let div = document.createElement("div");
      div.className =
        "p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex justify-between items-center font-semibold";
      div.innerHTML = `<span>Jam ${b.jamMulai} - ${b.jamSelesai}</span> <span class="bg-red-200/60 px-2 py-0.5 rounded text-[10px]">Telah Dibooking</span>`;
      previewContainer.appendChild(div);

      // Cek Overlap Jam berbasis menit
      const bStartMin = timeToMinutes(b.jamMulai);
      const bEndMin = timeToMinutes(b.jamSelesai);

      if (
        Math.max(currentStartMin, bStartMin) < Math.min(currentEndMin, bEndMin)
      ) {
        isConflict = true;
      }
    });
  }

  // Update State Tombol Kirim
  const btnSubmit = document.getElementById("btn-submit");
  const btnText = document.getElementById("btn-text");

  if (isOutOfHours) {
    btnSubmit.disabled = true;
    btnText.textContent = `Di Luar Jam Operasional ${kategori}!`;
  } else if (isConflict) {
    btnSubmit.disabled = true;
    btnText.textContent = "Sudah Terbooking!";
  } else {
    btnSubmit.disabled = false;
    btnText.textContent = "Booking Sekarang";
  }
}

// === FORM SUBMIT HANDLER ===
document
  .getElementById("booking-form")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    const btnSubmit = document.getElementById("btn-submit");
    const btnText = document.getElementById("btn-text");
    const btnProgress = document.getElementById("btn-progress");

    const durasiFloat =
      parseFloat(document.getElementById("durasi").value) || 1;
    const durasiLabel = formatDurasiLabel(durasiFloat);
    const metodePembayaran = document.getElementById("metodePembayaran").value;
    const isDp = metodePembayaran === "DP";
    const nominalDpValue = isDp
      ? parseRupiahNumber(document.getElementById("nominalDp").value)
      : 0;

    // Validasi Tambahan Sebelum Kirim
    const tanggalVal = document.getElementById("tanggal").value;
    if (tanggalVal < todayStr) {
      showModal("Peringatan", "Tanggal booking tidak boleh masa lalu.");
      return;
    }

    if (isDp) {
      if (nominalDpValue <= 0) {
        showModal(
          "Nominal DP Kosong",
          "Silakan masukkan nominal DP terlebih dahulu.",
        );
        return;
      }
      if (
        configSettings.minimalDp > 0 &&
        nominalDpValue < configSettings.minimalDp
      ) {
        showModal(
          "Nominal DP Kurang",
          `Minimal pembayaran DP adalah Rp ${configSettings.minimalDp.toLocaleString("id-ID")}.`,
        );
        return;
      }
    }

    const sisaPembayaranValue = isDp
      ? Math.max(0, currentTotalHarga - nominalDpValue)
      : currentTotalHarga;

    // Format Payload Data
    const payload = {
      nama: document.getElementById("nama").value.trim(),
      tanggal: tanggalVal,
      hari: document.getElementById("hari").value.trim(),
      kategori: document.getElementById("kategori").value,
      jamMulai: document.getElementById("jamMulai").value,
      jamSelesai: document.getElementById("jamSelesai").value,
      durasi: durasiFloat,
      durasiLabel: durasiLabel,
      totalHarga: document.getElementById("totalHarga").textContent,
      totalHargaNominal: currentTotalHarga,
      metodePembayaran: metodePembayaran,
      nominalDp: nominalDpValue,
      sisaPembayaran: sisaPembayaranValue,
      catatan: document.getElementById("catatan").value.trim(),
    };

    // Set State Loading Tombol Kirim
    btnSubmit.disabled = true;
    btnText.textContent = "Menyimpan Booking...";
    btnProgress.classList.remove("hidden");

    try {
      const res = await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.status === "success") {
        const metodeTextWa = isDp ? "DP" : "Tunai (Bayar di Tempat)";
        let detailPembayaranWa = `*Metode Pembayaran:* ${metodeTextWa}%0A`;

        if (isDp) {
          detailPembayaranWa +=
            `*Nominal DP:* Rp ${nominalDpValue.toLocaleString("id-ID")}%0A` +
            `*Sisa Pembayaran:* Rp ${sisaPembayaranValue.toLocaleString("id-ID")}%0A`;
        }

        let waText =
          `Halo Admin Barumba, saya ingin mengonfirmasi booking:%0A%0A` +
          `*ID Booking:* ${data.bookingId}%0A` +
          `*Nama:* ${payload.nama}%0A` +
          `*Hari, Tanggal:* ${payload.hari}, ${payload.tanggal}%0A` +
          `*Kategori:* ${payload.kategori}%0A` +
          `*Waktu:* ${payload.jamMulai} - ${payload.jamSelesai} (${durasiLabel})%0A` +
          `*Total Biaya:* ${payload.totalHarga}%0A` +
          detailPembayaranWa +
          `*Catatan:* ${payload.catatan || "-"}`;

        if (isDp) {
          waText += `%0A%0ASilahkan kirim bukti tf setelah pesan ini`;
        }

        const targetWaNumber = configSettings.adminWaNumber || "6282230012582";
        window.location.href = `https://wa.me/${targetWaNumber}?text=${waText}`;
      } else {
        showModal("Gagal Memproses", data.message || "Terjadi kesalahan.");
        resetSubmitBtn();
      }
    } catch (err) {
      console.error("Submit Error:", err);
      showModal("Kesalahan Koneksi", "Gagal menghubungkan ke server.");
      resetSubmitBtn();
    }
  });

function resetSubmitBtn() {
  const btnSubmit = document.getElementById("btn-submit");
  const btnText = document.getElementById("btn-text");
  const btnProgress = document.getElementById("btn-progress");

  btnSubmit.disabled = false;
  btnText.textContent = "Kirim Booking via WhatsApp";
  btnProgress.classList.add("hidden");
}

function showModal(title, message) {
  document.getElementById("modal-title").textContent = title;
  document.getElementById("modal-message").textContent = message;
  document.getElementById("modal-alert").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("modal-alert").classList.add("hidden");
}

function getTodayISO() {
  const d = new Date();
  let month = "" + (d.getMonth() + 1);
  let day = "" + d.getDate();
  let year = d.getFullYear();

  if (month.length < 2) month = "0" + month;
  if (day.length < 2) day = "0" + day;

  return [year, month, day].join("-");
}
