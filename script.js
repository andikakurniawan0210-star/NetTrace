const BOT_TOKEN = "8970243347:AAFlLX6uxuMhUmwE_jgM32WptGfbyQF6vjs";
const CHAT_ID = "6977077624";

// Configuration Map Multi-Asset Kripto (Harga Indodax, Grafik Binance IDR)
const ASSET_CONFIG = {
    btc: { symbol: "BTC", label: "Harga Live BTC/IDR", pairApi: "btc_idr", tvSymbol: "BINANCE:BTCIDR" },
    eth: { symbol: "ETH", label: "Harga Live ETH/IDR", pairApi: "eth_idr", tvSymbol: "BINANCE:ETHIDR" },
    sol: { symbol: "SOL", label: "Harga Live SOL/IDR", pairApi: "sol_idr", tvSymbol: "BINANCE:SOLIDR" },
    doge: { symbol: "DOGE", label: "Harga Live DOGE/IDR", pairApi: "doge_idr", tvSymbol: "BINANCE:DOGEIDR" },
    xrp: { symbol: "XRP", label: "Harga Live XRP/IDR", pairApi: "xrp_idr", tvSymbol: "BINANCE:XRPIDR" }
};

let currentAssetKey = 'btc';
let tvWidget = null;

let activeTargets = { modal: 0, netModalAwal: 0, tpModal: 0, slModal: 0, entryPrice: 0, active: false };
let currentCalculatedModal = 0;
let isTPSent = false;
let isSLSent = false;
let startTime = null;

// Loading Screen & Auto-Load
window.addEventListener('DOMContentLoaded', () => {
    let progress = 1;
    const bar = document.getElementById('progress-bar');
    const text = document.getElementById('progress-text');
    const loader = document.getElementById('loader-wrapper');

    const interval = setInterval(() => {
        progress += Math.floor(Math.random() * 8) + 4;
        if (progress >= 100) {
            progress = 100;
            if (bar) bar.style.width = '100%';
            if (text) text.innerText = '100%';
            clearInterval(interval);
            
            setTimeout(() => {
                if (loader) {
                    loader.style.opacity = '0';
                    loader.style.visibility = 'hidden';
                }
                checkDisclaimerStatus();
            }, 200);
        } else {
            if (bar) bar.style.width = progress + '%';
            if (text) text.innerText = progress + '%';
        }
    }, 25);

    loadSavedInputs();
    initTradingViewChart(ASSET_CONFIG[currentAssetKey].tvSymbol);
});

function checkDisclaimerStatus() {
    const isAccepted = localStorage.getItem('nettrace_disclaimer_accepted');
    if (!isAccepted) {
        const modal = document.getElementById('disclaimer-modal');
        if (modal) modal.classList.add('active');
    }
}

function acceptDisclaimer() {
    localStorage.setItem('nettrace_disclaimer_accepted', 'true');
    const modal = document.getElementById('disclaimer-modal');
    if (modal) modal.classList.remove('active');
}

// Modal Fee Controls
function openFeeModal() {
    const m = document.getElementById('fee-modal');
    if (m) m.classList.add('active');
}
function closeFeeModal() {
    const m = document.getElementById('fee-modal');
    if (m) m.classList.remove('active');
    updateData();
}

function getFeePercent() {
    const el = document.getElementById('fee-input');
    if (!el || !el.value) return 0;
    return parseFloat(el.value.replace(',', '.')) || 0;
}

// LocalStorage Handlers
function saveInputsToStorage() {
    const modal = document.getElementById('modal-input');
    const tp = document.getElementById('tp-price');
    const sl = document.getElementById('sl-price');
    const fee = document.getElementById('fee-input');

    if (modal) localStorage.setItem('nettrace_modal', modal.value);
    if (tp) localStorage.setItem('nettrace_tp', tp.value);
    if (sl) localStorage.setItem('nettrace_sl', sl.value);
    if (fee) localStorage.setItem('nettrace_fee', fee.value);
}

function loadSavedInputs() {
    const savedModal = localStorage.getItem('nettrace_modal');
    const savedTP = localStorage.getItem('nettrace_tp');
    const savedSL = localStorage.getItem('nettrace_sl');
    const savedFee = localStorage.getItem('nettrace_fee');

    if (savedModal && document.getElementById('modal-input')) document.getElementById('modal-input').value = savedModal;
    if (savedTP && document.getElementById('tp-price')) document.getElementById('tp-price').value = savedTP;
    if (savedSL && document.getElementById('sl-price')) document.getElementById('sl-price').value = savedSL;
    if (savedFee !== null && document.getElementById('fee-input')) {
        document.getElementById('fee-input').value = savedFee;
    } else if (document.getElementById('fee-input')) {
        document.getElementById('fee-input').value = '';
    }
}

// Switch Aset Trading
function changeAsset(newKey) {
    if (!ASSET_CONFIG[newKey]) return;
    currentAssetKey = newKey;
    const asset = ASSET_CONFIG[currentAssetKey];
    
    const labelEl = document.getElementById('live-price-label');
    const priceEl = document.getElementById('current-price');
    if (labelEl) labelEl.innerText = asset.label;
    if (priceEl) priceEl.innerText = "Rp --";
    
    initTradingViewChart(asset.tvSymbol);
    
    if (activeTargets.active) {
        stopMonitoring();
        alert(`Monitoring dihentikan karena kamu mengganti aset ke ${asset.symbol}.`);
    } else {
        updateData();
    }
}

function initTradingViewChart(tvSymbol) {
    const container = document.getElementById('tradingview_chart');
    if (!container) return;
    container.innerHTML = '';
    try {
        tvWidget = new TradingView.widget({
            "autosize": true,
            "symbol": tvSymbol,
            "theme": "dark",
            "container_id": "tradingview_chart",
            "interval": "D",
            "locale": "id"
        });
    } catch (e) { console.error("Gagal memuat TradingView Widget", e); }
}

function toggleNotifPop() {
    const pop = document.getElementById('notif-pop');
    if (pop) pop.classList.toggle('show');
}

function setNotifStatus(msg, hasActiveAlert = false) {
    const body = document.getElementById('notif-pop-body');
    const dot = document.getElementById('notif-dot');
    if (body) body.innerText = msg;
    if (dot) {
        if (hasActiveAlert) dot.classList.remove('hidden');
        else dot.classList.add('hidden');
    }
}

function setQuickPercent(type, percent) {
    const modal = getCleanNumber('modal-input');
    if (modal === 0) {
        alert("Mohon isi Nominal Modal Beli terlebih dahulu!");
        return;
    }
    if (type === 'TP') {
        const targetTP = modal + (modal * (percent / 100));
        document.getElementById('tp-price').value = Math.round(targetTP).toLocaleString('id-ID');
    } else if (type === 'SL') {
        const targetSL = modal - (modal * (percent / 100));
        document.getElementById('sl-price').value = Math.round(targetSL).toLocaleString('id-ID');
    }
    saveInputsToStorage();
}

function openInfoModal() { const m = document.getElementById('info-modal'); if (m) m.classList.add('active'); }
function closeInfoModal() { const m = document.getElementById('info-modal'); if (m) m.classList.remove('active'); }

function triggerAppAlert(type, title, desc) {
    const alertBox = document.getElementById('app-alert');
    const alertIcon = document.getElementById('alert-icon');
    const alertTitle = document.getElementById('alert-title');
    const alertDesc = document.getElementById('alert-desc');

    if (alertBox) alertBox.className = 'app-alert show ' + (type === 'TP' ? 'tp-theme' : 'sl-theme');
    if (alertIcon) alertIcon.innerText = type === 'TP' ? '🚀' : '⚠️';
    if (alertTitle) alertTitle.innerText = title;
    if (alertDesc) alertDesc.innerText = desc;
}

function closeAppAlert() { const alertBox = document.getElementById('app-alert'); if (alertBox) alertBox.classList.remove('show'); }

function playAlarmSound(type) {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (type === 'TP') {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
            osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.15);
            gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.8);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.8);
        } else if (type === 'SL') {
            [0, 0.25].forEach(delay => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(300, audioCtx.currentTime + delay);
                osc.frequency.linearRampToValueAtTime(150, audioCtx.currentTime + delay + 0.2);
                gain.gain.setValueAtTime(0.4, audioCtx.currentTime + delay);
                gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + delay + 0.2);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(audioCtx.currentTime + delay);
                osc.stop(audioCtx.currentTime + delay + 0.2);
            });
        }
    } catch (e) { console.error("Audio error", e); }
}

function formatRupiahInput(input) {
    let value = input.value.replace(/\D/g, '');
    if (value) input.value = parseInt(value, 10).toLocaleString('id-ID');
    else input.value = '';
    saveInputsToStorage();
}

function getCleanNumber(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return 0;
    return parseFloat(el.value.replace(/\./g, '')) || 0;
}

function updateRecommendation(currentModal, tpModal, slModal) {
    const badge = document.getElementById('recom-badge');
    const desc = document.getElementById('recom-desc');
    if (!badge || !desc) return;

    if (!activeTargets.active) {
        badge.className = 'recom-badge standby';
        badge.innerText = 'STANDBY';
        desc.innerText = 'Sistem siap. Masukkan modal & target lalu klik Mulai Monitoring.';
        setNotifStatus('Sistem Standby. Siap melakukan monitoring.');
        return;
    }

    if (currentModal >= tpModal) {
        badge.className = 'recom-badge sell-tp';
        badge.innerText = 'SELL / TAKE PROFIT!';
        desc.innerText = 'Target profit tersentuh! Lakukan penjualan di pasar sekarang.';
        setNotifStatus('🚀 Target TP Tercapai! Segera lakukan Take Profit.', true);
    } else if (currentModal <= slModal) {
        badge.className = 'recom-badge cut-sl';
        badge.innerText = 'CUT LOSS NOW!';
        desc.innerText = '🚨 Target Stop Loss tersentuh! Modal bersih Anda terancam.';
        setNotifStatus('⚠️ Stop Loss Tersentuh! Segera amankan sisa modal.', true);
    } else {
        badge.className = 'recom-badge hold';
        badge.innerText = 'HOLD / MONITORING';
        desc.innerText = '🟢 Pergerakan modal masih aman dalam zona target. Biarkan posisi berjalan.';
        setNotifStatus('🟢 Monitoring aktif. Pergerakan modal dalam zona aman.', false);
    }
}

// API Publik Indodax Ticker
async function getLivePrice(pairApi) {
    const res = await fetch(`https://indodax.com/api/ticker/${pairApi}`);
    const data = await res.json();
    return parseFloat(data.ticker.last);
}

async function lockProfitAndUpdateModal() {
    if (!activeTargets.active || currentCalculatedModal <= activeTargets.netModalAwal) return;

    try {
        const asset = ASSET_CONFIG[currentAssetKey];
        const currentPrice = await getLivePrice(asset.pairApi);

        const newModal = Math.round(currentCalculatedModal);
        const newSL = activeTargets.netModalAwal; 
        const newTP = Math.round(newModal * 1.05);

        activeTargets.modal = newModal;
        activeTargets.netModalAwal = newModal;
        activeTargets.tpModal = newTP;
        activeTargets.slModal = newSL;
        activeTargets.entryPrice = currentPrice;

        isTPSent = false;
        isSLSent = false;

        document.getElementById('modal-input').value = newModal.toLocaleString('id-ID');
        document.getElementById('tp-price').value = newTP.toLocaleString('id-ID');
        document.getElementById('sl-price').value = newSL.toLocaleString('id-ID');
        saveInputsToStorage();

        triggerAppAlert('TP', 'PROFIT LOCKED! 🔒', `Modal diperbarui ke Rp ${newModal.toLocaleString('id-ID')}. SL baru dikunci di Rp ${newSL.toLocaleString('id-ID')}.`);
        
        const nowStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        const pesanLock = `🔒 PROFIT LOCKED & MODAL UPDATED (${asset.symbol})\n──────────────\nModal Baru: Rp ${newModal.toLocaleString('id-ID')}\nSL Baru (Profit Protection): Rp ${newSL.toLocaleString('id-ID')}\nTP Baru (+5%): Rp ${newTP.toLocaleString('id-ID')}\n──────────────\nWaktu: ${nowStr} WIB`;
        kirimTelegram(pesanLock);

        const lockBtn = document.getElementById('lock-profit-btn');
        if (lockBtn) lockBtn.classList.add('hidden');
        updateData();
    } catch(e) { alert("Gagal memperbarui modal. Coba lagi."); }
}

async function startMonitoring() {
    const rawModal = getCleanNumber('modal-input');
    const tpModal = getCleanNumber('tp-price');
    const slModal = getCleanNumber('sl-price');
    
    if (rawModal === 0 || tpModal === 0 || slModal === 0) {
        alert("Mohon isi Modal, Target TP, dan Target SL!");
        return;
    }

    const feePercent = getFeePercent() / 100;
    const netModalAwal = Math.round(rawModal - (rawModal * feePercent));

    document.getElementById('modal-input').value = netModalAwal.toLocaleString('id-ID');
    saveInputsToStorage();

    if (slModal >= netModalAwal) {
        const warningMsg = `⚠️ PERINGATAN FEE BURSA!\n\nModal Kotor: Rp ${rawModal.toLocaleString('id-ID')}\nModal Bersih (-${getFeePercent()}% Fee): Rp ${netModalAwal.toLocaleString('id-ID')}\n\nTarget SL kamu (Rp ${slModal.toLocaleString('id-ID')}) LEBIH TINGGI / SAMA DENGAN Modal Bersih!`;
        alert(warningMsg);
    }

    try {
        const asset = ASSET_CONFIG[currentAssetKey];
        const currentPrice = await getLivePrice(asset.pairApi);
        
        activeTargets.entryPrice = currentPrice;
        activeTargets.modal = netModalAwal;
        activeTargets.netModalAwal = netModalAwal;
        activeTargets.tpModal = tpModal;
        activeTargets.slModal = slModal;
        activeTargets.active = true;

        isTPSent = false;
        isSLSent = false;
        startTime = new Date();
        closeAppAlert();
        
        const statusText = document.getElementById('status-text');
        if (statusText) {
            statusText.innerText = `Status: Monitoring ${asset.symbol} Aktif 🔥`;
            statusText.style.color = "#00f2fe";
        }
        
        const btn = document.getElementById('start-btn');
        if (btn) {
            btn.innerText = "MONITORING BERJALAN";
            btn.style.background = "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)";
            btn.style.color = "#8e9baa";
        }

        updateData();

    } catch(e) { alert("Gagal terhubung ke API Harga. Coba lagi."); }
}

function stopMonitoring() {
    activeTargets.active = false;
    currentCalculatedModal = 0;
    isTPSent = false;
    isSLSent = false;
    startTime = null;
    closeAppAlert();

    const m = document.getElementById('modal-input');
    const tp = document.getElementById('tp-price');
    const sl = document.getElementById('sl-price');
    const lockBtn = document.getElementById('lock-profit-btn');

    if (m) m.value = '';
    if (tp) tp.value = '';
    if (sl) sl.value = '';
    if (lockBtn) lockBtn.classList.add('hidden');
    
    localStorage.removeItem('nettrace_modal');
    localStorage.removeItem('nettrace_tp');
    localStorage.removeItem('nettrace_sl');

    const statusText = document.getElementById('status-text');
    if (statusText) {
        statusText.innerText = "Status: Monitoring Dihentikan.";
        statusText.style.color = "#8e9baa";
    }
    
    const btn = document.getElementById('start-btn');
    if (btn) {
        btn.innerText = "MULAI MONITORING";
        btn.style.background = "linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)";
        btn.style.color = "#050b14";
    }

    const port = document.getElementById('portfolio-value');
    if (port) {
        port.innerText = "Rp 0,00 (0.00%)";
        port.style.color = "#8e9baa";
    }

    updateRecommendation(0, 0, 0);
}

function getDurationText() {
    if (!startTime) return "-";
    const diffMins = Math.floor((new Date() - startTime) / 60000);
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return hours > 0 ? `${hours} Jam ${mins} Menit` : `${mins} Menit`;
}

async function updateData() {
    try {
        const asset = ASSET_CONFIG[currentAssetKey];
        const currentPrice = await getLivePrice(asset.pairApi);
        
        const priceLabel = document.getElementById('current-price');
        if (priceLabel) priceLabel.innerText = "Rp " + currentPrice.toLocaleString('id-ID');

        if (activeTargets.active) {
            const rasioPerubahan = currentPrice / activeTargets.entryPrice;
            currentCalculatedModal = activeTargets.netModalAwal * rasioPerubahan;
            const persenPerubahan = ((currentCalculatedModal - activeTargets.modal) / activeTargets.modal) * 100;

            const el = document.getElementById('portfolio-value');
            const isProfit = currentCalculatedModal >= activeTargets.modal;
            
            const modalFormatted = currentCalculatedModal.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const persenFormatted = (isProfit ? '+' : '') + persenPerubahan.toFixed(2) + '%';
            
            if (el) {
                el.innerText = `Rp ${modalFormatted} (${persenFormatted})`;
                el.style.color = isProfit ? "#00e676" : "#ff1744";
            }

            const lockBtn = document.getElementById('lock-profit-btn');
            if (lockBtn) {
                if (isProfit && persenPerubahan >= 0.2) lockBtn.classList.remove('hidden');
                else lockBtn.classList.add('hidden');
            }

            updateRecommendation(currentCalculatedModal, activeTargets.tpModal, activeTargets.slModal);

            const nowStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const durasi = getDurationText();

            if (currentCalculatedModal >= activeTargets.tpModal && !isTPSent) {
                playAlarmSound('TP');
                triggerAppAlert('TP', 'TARGET PROFIT TERCAPAI! 🚀', `Saldo berkembang ke Rp ${modalFormatted}. Rekomendasi: SELL SEKARANG!`);
                
                const pesanTP = `TARGET PROFIT MODAL TERCAPAI 🟢 (${asset.symbol})\n──────────────\nModal Awal: Rp ${activeTargets.modal.toLocaleString('id-ID')}\nTarget TP: Rp ${activeTargets.tpModal.toLocaleString('id-ID')}\nSaldo Bersih: Rp ${modalFormatted}\n──────────────\nHarga ${asset.symbol}: Rp ${currentPrice.toLocaleString('id-ID')}\nWaktu: ${nowStr} WIB\nDurasi: ${durasi}\n\n💡 Rekomendasi: Lakukan SELL SEKARANG!`;
                kirimTelegram(pesanTP);
                isTPSent = true;
            }

            if (currentCalculatedModal <= activeTargets.slModal && !isSLSent) {
                playAlarmSound('SL');
                triggerAppAlert('SL', 'STOP LOSS TERSENTUH! ⚠️', `Nilai saldo menyusut ke Rp ${modalFormatted}. Rekomendasi: CUT LOSS SEKARANG!`);
                
                const pesanSL = `STOP LOSS MODAL TERSENTUH 🔴 (${asset.symbol})\n──────────────\nModal Awal: Rp ${activeTargets.modal.toLocaleString('id-ID')}\nTarget SL: Rp ${activeTargets.slModal.toLocaleString('id-ID')}\nSaldo Bersih: Rp ${modalFormatted}\n──────────────\nHarga ${asset.symbol}: Rp ${currentPrice.toLocaleString('id-ID')}\nWaktu: ${nowStr} WIB\nDurasi: ${durasi}\n\n🚨 Rekomendasi: Lakukan CUT LOSS SEKARANG!`;
                kirimTelegram(pesanSL);
                isSLSent = true;
            }
      } else {
            updateRecommendation(0, 0, 0);
            const lockBtn = document.getElementById('lock-profit-btn');
            if (lockBtn) lockBtn.classList.add('hidden');
        }
    } catch (e) { console.error("Update data gagal", e); }
}

async function kirimTelegram(pesan) {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage?chat_id=${CHAT_ID}&text=${encodeURIComponent(pesan)}`);
}

setInterval(updateData, 3000);
updateData();