// ============================================================
// CONFIG & STATE MANAGEMENT
// ============================================================
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzHlXZ2VU3GHGqcDam9ls19UeyfyLvxuQRTkizCqOqU6Di8lgb2jZKA8B_fgoe-cQJq/exec";

const ASSET_CONFIG = {
    btc: { symbol: "BTC", label: "HARGA LIVE BITCOIN (IDR)", geckoId: "bitcoin", tvSymbol: "BINANCE:BTCIDR", indodaxPair: "btc_idr" },
    eth: { symbol: "ETH", label: "HARGA LIVE ETHEREUM (IDR)", geckoId: "ethereum", tvSymbol: "BINANCE:ETHIDR", indodaxPair: "eth_idr" },
    sol: { symbol: "SOL", label: "HARGA LIVE SOLANA (IDR)", geckoId: "solana", tvSymbol: "BINANCE:SOLIDR", indodaxPair: "sol_idr" },
    doge: { symbol: "DOGE", label: "HARGA LIVE DOGECOIN (IDR)", geckoId: "dogecoin", tvSymbol: "BINANCE:DOGEIDR", indodaxPair: "doge_idr" },
    xrp: { symbol: "XRP", label: "HARGA LIVE XRP (IDR)", geckoId: "ripple", tvSymbol: "BINANCE:XRPIDR", indodaxPair: "xrp_idr" }
};

let currentAssetKey = 'btc';
let activeTargets = { modal: 0, netModalAwal: 0, tpModal: 0, slModal: 0, entryPrice: 0, active: false };
let currentCalculatedModal = 0;
let isTPSent = false;
let isSLSent = false;

// Audio Context
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playAlertSound(type) {
    try {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        if (type === 'TP') {
            osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); 
            osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.15); 
            gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.4);
        } else {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(300, audioCtx.currentTime);
            osc.frequency.setValueAtTime(150, audioCtx.currentTime + 0.2);
            gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.5);
        }
    } catch(e) { console.error("Gagal memutar audio:", e); }
}

// LOGIKA HELPER VISIBILITAS TOMBOL NON-TRADING
function toggleTradingUI(isTradingActive) {
    const elementsToToggle = [
        document.querySelector('.header-right'),
        document.querySelector('.btn-fee'),
        document.querySelector('.info-btn')
    ];

    elementsToToggle.forEach(el => {
        if (el) {
            el.style.display = isTradingActive ? 'none' : '';
        }
    });
}

// LOGIKA LOGIN & USERNAME PROTEKSI
function checkUserLogin() {
    const activeUser = localStorage.getItem('nettrace_active_user');
    if (!activeUser) {
        openLoginModal();
    } else {
        closeLoginModal();
    }
}

function openLoginModal() {
    const modal = document.getElementById('login-modal');
    if (modal) modal.classList.add('active');
}

function closeLoginModal() {
    const modal = document.getElementById('login-modal');
    if (modal) modal.classList.remove('active');
}

function handleAuth() {
    const userIn = document.getElementById('auth-username').value.trim();
    const passIn = document.getElementById('auth-password').value.trim();

    if (!userIn || !passIn) {
        showAuthError("Username & Password wajib diisi!");
        return;
    }

    const savedUsers = JSON.parse(localStorage.getItem('nettrace_users_db') || '{}');

    if (savedUsers[userIn]) {
        if (savedUsers[userIn].password === passIn) {
            localStorage.setItem('nettrace_active_user', userIn);
            if (savedUsers[userIn].botToken) localStorage.setItem('nettrace_bot_token', savedUsers[userIn].botToken);
            if (savedUsers[userIn].chatId) localStorage.setItem('nettrace_chat_id', savedUsers[userIn].chatId);
            
            loadSavedInputs();
            closeLoginModal();
            openSettingsModal();
        } else {
            showAuthError("⚠️ Username sudah terpakai! Password salah.");
        }
    } else {
        savedUsers[userIn] = { password: passIn, botToken: '', chatId: '' };
        localStorage.setItem('nettrace_users_db', JSON.stringify(savedUsers));
        localStorage.setItem('nettrace_active_user', userIn);
        
        closeLoginModal();
        openSettingsModal();
    }
}

function showAuthError(msg) {
    const errEl = document.getElementById('auth-error-msg');
    if (errEl) {
        errEl.innerText = msg;
        errEl.style.display = 'block';
    }
}

function logoutUser() {
    localStorage.removeItem('nettrace_active_user');
    location.reload();
}

// MODAL PENGATURAN UTAMA
function openSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (modal) modal.classList.add('active');
}

function closeSettingsModal() {
    saveTelegramConfig();
    const modal = document.getElementById('settings-modal');
    if (modal) modal.classList.remove('active');
}

function getTelegramConfig() {
    const token = localStorage.getItem('nettrace_bot_token') || document.getElementById('bot-token-input')?.value || '';
    const chatId = localStorage.getItem('nettrace_chat_id') || document.getElementById('chat-id-input')?.value || '';
    return { token: token.trim(), chatId: chatId.trim() };
}

function saveTelegramConfig() {
    const tokenInput = document.getElementById('bot-token-input');
    const chatIdInput = document.getElementById('chat-id-input');
    const activeUser = localStorage.getItem('nettrace_active_user');

    if (tokenInput) localStorage.setItem('nettrace_bot_token', tokenInput.value.trim());
    if (chatIdInput) localStorage.setItem('nettrace_chat_id', chatIdInput.value.trim());

    if (activeUser) {
        const savedUsers = JSON.parse(localStorage.getItem('nettrace_users_db') || '{}');
        if (savedUsers[activeUser]) {
            savedUsers[activeUser].botToken = tokenInput ? tokenInput.value.trim() : '';
            savedUsers[activeUser].chatId = chatIdInput ? chatIdInput.value.trim() : '';
            localStorage.setItem('nettrace_users_db', JSON.stringify(savedUsers));
        }
    }
}

async function sendTelegramMessage(message) {
    const { token, chatId } = getTelegramConfig();
    if (!token || !chatId) return;

    try {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' })
        });
    } catch (e) { console.error("Gagal notifikasi Telegram:", e); }
}

// FUNGSI INTEGRASI SERVER GOOGLE APPS SCRIPT (24/7)
function sendDataToGoogleServer(pairAsset, tpPrice, slPrice) {
    if (!GOOGLE_SCRIPT_URL) return;
    const { token, chatId } = getTelegramConfig();

    fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            pair: pairAsset,
            tp: tpPrice,
            sl: slPrice,
            token: token,
            chatId: chatId
        })
    })
    .then(() => {
        console.log("Data & Kredensial Telegram sukses tersinkronisasi ke Server Google 24/7.");
    })
    .catch(err => {
        console.error("Gagal sinkronisasi ke Server Google:", err);
    });
}

// Format Input Rupiah & Local Storage
function formatRupiahInput(input) {
    if (!input) return;
    let value = input.value.replace(/\D/g, ''); 
    input.value = value ? parseInt(value, 10).toLocaleString('id-ID') : '';
    saveInputsToStorage();
}

function saveInputsToStorage() {
    const modal = document.getElementById('modal-input');
    const tp = document.getElementById('tp-price');
    const sl = document.getElementById('sl-price');
    const fee = document.getElementById('fee-input');

    if (modal) localStorage.setItem('nettrace_modal', modal.value);
    if (tp) localStorage.setItem('nettrace_tp', tp.value);
    if (sl) localStorage.setItem('nettrace_sl', sl.value);
    if (fee) localStorage.setItem('nettrace_fee', fee.value);
    
    saveTelegramConfig();
}
// ============================================================
// DATA LOADING, ALERTS & MONITORING LOGIC
// ============================================================

function loadSavedInputs() {
    const savedModal = localStorage.getItem('nettrace_modal');
    const savedTP = localStorage.getItem('nettrace_tp');
    const savedSL = localStorage.getItem('nettrace_sl');
    const savedFee = localStorage.getItem('nettrace_fee');
    const savedToken = localStorage.getItem('nettrace_bot_token');
    const savedChatId = localStorage.getItem('nettrace_chat_id');

    if (savedModal && document.getElementById('modal-input')) document.getElementById('modal-input').value = savedModal;
    if (savedTP && document.getElementById('tp-price')) document.getElementById('tp-price').value = savedTP;
    if (savedSL && document.getElementById('sl-price')) document.getElementById('sl-price').value = savedSL;
    if (savedFee !== null && document.getElementById('fee-input')) document.getElementById('fee-input').value = savedFee;
    
    if (savedToken && document.getElementById('bot-token-input')) document.getElementById('bot-token-input').value = savedToken;
    if (savedChatId && document.getElementById('chat-id-input')) document.getElementById('chat-id-input').value = savedChatId;
}

function setQuickPercent(type, percent) {
    const rawModal = getCleanNumber('modal-input');
    if (rawModal <= 0) { alert("Masukkan Modal Beli terlebih dahulu!"); return; }

    const feePercent = getFeePercent() / 100;
    const netModalAwal = Math.round(rawModal - (rawModal * feePercent));

    if (type === 'TP') {
        const targetValue = Math.round(netModalAwal * (1 + (percent / 100)));
        const tpInput = document.getElementById('tp-price');
        if (tpInput) { tpInput.value = targetValue.toLocaleString('id-ID'); formatRupiahInput(tpInput); }
    } else if (type === 'SL') {
        const targetValue = Math.round(netModalAwal * (1 - (percent / 100)));
        const slInput = document.getElementById('sl-price');
        if (slInput) { slInput.value = targetValue.toLocaleString('id-ID'); formatRupiahInput(slInput); }
    }
}

function showAppAlert(title, desc, theme = 'tp') {
    const alertEl = document.getElementById('app-alert');
    const titleEl = document.getElementById('alert-title');
    const descEl = document.getElementById('alert-desc');
    const iconEl = document.getElementById('alert-icon');

    if (!alertEl || !titleEl || !descEl) return;

    titleEl.innerText = title;
    descEl.innerText = desc;
    alertEl.className = `app-alert show ${theme}-theme`;
    if (iconEl) iconEl.innerText = theme === 'tp' ? '🎯' : '🚨';

    const notifBody = document.getElementById('notif-pop-body');
    const notifDot = document.getElementById('notif-dot');
    if (notifBody) notifBody.innerText = `${title}: ${desc}`;
    if (notifDot) notifDot.classList.remove('hidden');
}

function closeAppAlert() {
    const alertEl = document.getElementById('app-alert');
    if (alertEl) alertEl.classList.remove('show');
}

function toggleNotifPop() {
    const pop = document.getElementById('notif-pop');
    const dot = document.getElementById('notif-dot');
    if (pop) pop.classList.toggle('show');
    if (dot) dot.classList.add('hidden');
}

async function getLivePrice(geckoId) {
    try {
        const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${geckoId}&vs_currencies=idr`);
        const data = await response.json();
        return data[geckoId] ? data[geckoId].idr : 0;
    } catch (e) { return 0; }
}

function checkDisclaimerStatus() {
    if (!localStorage.getItem('nettrace_disclaimer_accepted')) {
        const modal = document.getElementById('disclaimer-modal');
        if (modal) modal.classList.add('active');
    }
}

function acceptDisclaimer() {
    localStorage.setItem('nettrace_disclaimer_accepted', 'true');
    const modal = document.getElementById('disclaimer-modal');
    if (modal) modal.classList.remove('active');
}

function openFeeModal() {
    const m = document.getElementById('fee-modal');
    if (m) m.classList.add('active');
}

function closeFeeModal() {
    const m = document.getElementById('fee-modal');
    if (m) m.classList.remove('active');
    updateData();
}

function openInfoModal() {
    const m = document.getElementById('info-modal');
    if (m) m.classList.add('active');
}

function closeInfoModal() {
    const m = document.getElementById('info-modal');
    if (m) m.classList.remove('active');
}

function getFeePercent() {
    const el = document.getElementById('fee-input');
    if (!el || !el.value) return 0;
    return parseFloat(el.value.replace(',', '.')) || 0;
}

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
        alert(`Monitoring dihentikan karena Anda mengganti aset ke ${asset.symbol}.`);
    } else { updateData(); }
}

function initTradingViewChart(tvSymbol) {
    const container = document.getElementById('tradingview_chart') || document.getElementById('tradingview_widget');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (typeof TradingView === 'undefined') {
        container.innerHTML = '<p style="color:#8e9baa; text-align:center; padding-top:20px; font-size:12px;">Grafik gagal dimuat (Cek koneksi CDN TradingView)</p>';
        return;
    }

    try {
        new TradingView.widget({
            "autosize": true,
            "symbol": tvSymbol,
            "theme": "dark",
            "container_id": container.id,
            "interval": "D",
            "locale": "id"
        });
    } catch (e) { console.error("TradingView Error:", e); }
}

function getCleanNumber(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return 0;
    return parseFloat(el.value.replace(/\./g, '')) || 0;
}

async function startMonitoring() {
    saveTelegramConfig();
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

    try {
        const asset = ASSET_CONFIG[currentAssetKey];
        const currentPrice = await getLivePrice(asset.geckoId);
        
        if (!currentPrice || isNaN(currentPrice)) {
            alert("Gagal terhubung ke API Harga. Periksa koneksi internet.");
            return;
        }

        activeTargets.entryPrice = currentPrice;
        activeTargets.modal = netModalAwal;
        activeTargets.netModalAwal = netModalAwal;
        activeTargets.tpModal = tpModal;
        activeTargets.slModal = slModal;
        activeTargets.active = true;

        isTPSent = false;
        isSLSent = false;
        
        // Simpan status monitoring ke memori browser
        localStorage.setItem('nettrace_is_monitoring', 'true');
        localStorage.setItem('nettrace_entry_price', currentPrice);
        localStorage.setItem('nettrace_asset_key', currentAssetKey);

        toggleTradingUI(true);

        const statusText = document.getElementById('status-text');
        if (statusText) {
            statusText.innerText = `Status: Monitoring Server 24/7 Aktif 🔥`;
            statusText.style.color = "#00f2fe";
        }
        
        const btn = document.getElementById('start-btn');
        if (btn) {
            btn.innerText = "MONITORING BERJALAN";
            btn.style.background = "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)";
            btn.style.color = "#8e9baa";
        }

        const startMsg = `🚀 <b>MONITORING AKTIF!</b>\n\nAset: <b>${asset.symbol}/IDR</b>\nHarga Entry: <b>Rp ${currentPrice.toLocaleString('id-ID')}</b>\nModal Beli: <b>Rp ${netModalAwal.toLocaleString('id-ID')}</b>\nTarget TP: <b>Rp ${tpModal.toLocaleString('id-ID')}</b>\nTarget SL: <b>Rp ${slModal.toLocaleString('id-ID')}</b>`;
        sendTelegramMessage(startMsg);

        // KIRIM DATA KE SERVER GOOGLE
        sendDataToGoogleServer(asset.indodaxPair, tpModal, slModal);

        updateData();
    } catch(e) { alert("Gagal terhubung ke API Harga."); }
}

function stopMonitoring() {
    activeTargets.active = false;
    currentCalculatedModal = 0;
    isTPSent = false;
    isSLSent = false;

    // Hapus status monitoring di memori browser
    localStorage.removeItem('nettrace_is_monitoring');
    localStorage.removeItem('nettrace_entry_price');
    localStorage.removeItem('nettrace_asset_key');

    toggleTradingUI(false);

    const m = document.getElementById('modal-input');
    const tp = document.getElementById('tp-price');
    const sl = document.getElementById('sl-price');

    if (m) m.value = '';
    if (tp) tp.value = '';
    if (sl) sl.value = '';
    
    localStorage.removeItem('nettrace_modal');
    localStorage.removeItem('nettrace_tp');
    localStorage.removeItem('nettrace_sl');

    const statusText = document.getElementById('status-text');
    if (statusText) {
        statusText.innerText = "Status: Siap monitoring.";
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
        port.innerText = "Rp 0 (0.00%)";
        port.style.color = "#8e9baa";
    }

    const lockBtn = document.getElementById('lock-profit-btn');
    if (lockBtn) lockBtn.classList.add('hidden');

    closeAppAlert();
    updateRecommendation(0, 0, 0);
}

function lockProfitAndUpdateModal() {
    if (!activeTargets.active || currentCalculatedModal <= 0) return;
    
    const roundedModal = Math.round(currentCalculatedModal);
    activeTargets.modal = roundedModal;
    activeTargets.netModalAwal = roundedModal;
    
    const asset = ASSET_CONFIG[currentAssetKey];
    getLivePrice(asset.geckoId).then(price => {
        if (price > 0) {
            activeTargets.entryPrice = price;
            localStorage.setItem('nettrace_entry_price', price);
        }
    });

    const inputModal = document.getElementById('modal-input');
    if (inputModal) inputModal.value = roundedModal.toLocaleString('id-ID');
    saveInputsToStorage();

    const lockBtn = document.getElementById('lock-profit-btn');
    if (lockBtn) lockBtn.classList.add('hidden');

    alert("Profit Berhasil Dikunci! Modal acuan baru telah diperbarui.");
    
    sendDataToGoogleServer(asset.indodaxPair, activeTargets.tpModal, activeTargets.slModal);

    updateData();
}

async function updateData() {
    try {
        const asset = ASSET_CONFIG[currentAssetKey];
        const currentPrice = await getLivePrice(asset.geckoId);
        
        const priceLabel = document.getElementById('current-price');
        if (priceLabel && currentPrice > 0) {
            priceLabel.innerText = "Rp " + currentPrice.toLocaleString('id-ID');
        }

        if (activeTargets.active && activeTargets.entryPrice > 0 && currentPrice > 0) {
            const rasioPerubahan = currentPrice / activeTargets.entryPrice;
            currentCalculatedModal = activeTargets.netModalAwal * rasioPerubahan;
            
            const roundedModal = Math.round(currentCalculatedModal);
            
            let persenPerubahan = activeTargets.modal > 0 
                ? ((currentCalculatedModal - activeTargets.modal) / activeTargets.modal) * 100 
                : 0;

            if (Math.abs(persenPerubahan) < 0.001) persenPerubahan = 0;

            const el = document.getElementById('portfolio-value');
            const isProfit = roundedModal >= activeTargets.modal;
            
            const modalFormatted = roundedModal.toLocaleString('id-ID');
            let persenFormatted = persenPerubahan.toFixed(2) + '%';
            if (persenPerubahan > 0) persenFormatted = '+' + persenFormatted;

            if (el) {
                el.innerText = `Rp ${modalFormatted} (${persenFormatted})`;
                el.style.color = isProfit ? "#00e676" : "#ff1744";
            }

            const lockBtn = document.getElementById('lock-profit-btn');
            if (lockBtn) {
                if (roundedModal > activeTargets.modal) lockBtn.classList.remove('hidden');
                else lockBtn.classList.add('hidden');
            }

            if (roundedModal >= activeTargets.tpModal && !isTPSent) {
                isTPSent = true;
                playAlertSound('TP');
                const msg = `🎯 <b>TARGET TAKE PROFIT TERSENTUH!</b>\n\nAset: <b>${asset.symbol}</b>\nEstimasi Modal: <b>Rp ${modalFormatted}</b>\nTarget TP: <b>Rp ${activeTargets.tpModal.toLocaleString('id-ID')}</b>\nKeuntungan: <b>${persenFormatted}</b>`;
                sendTelegramMessage(msg);
                showAppAlert("TAKE PROFIT!", `Modal menyentuh target Rp ${activeTargets.tpModal.toLocaleString('id-ID')}`, 'tp');
            } else if (roundedModal <= activeTargets.slModal && !isSLSent) {
                isSLSent = true;
                playAlertSound('SL');
                const msg = `🚨 <b>STOP LOSS TERSENTUH!</b>\n\nAset: <b>${asset.symbol}</b>\nEstimasi Modal: <b>Rp ${modalFormatted}</b>\nTarget SL: <b>Rp ${activeTargets.slModal.toLocaleString('id-ID')}</b>\nKerugian: <b>${persenFormatted}</b>`;
                sendTelegramMessage(msg);
                showAppAlert("STOP LOSS!", `Modal menyentuh batas Rp ${activeTargets.slModal.toLocaleString('id-ID')}`, 'sl');
            }

            updateRecommendation(roundedModal, activeTargets.tpModal, activeTargets.slModal);
        } else if (!activeTargets.active) {
            updateRecommendation(0, 0, 0);
        }
    } catch (e) {}
}

function updateRecommendation(currentModal, tpModal, slModal) {
    const badge = document.getElementById('recom-badge');
    const desc = document.getElementById('recom-desc');
    if (!badge || !desc) return;

    if (!activeTargets.active) {
        badge.className = 'recom-badge standby';
        badge.innerText = 'STANDBY';
        desc.innerText = 'Sistem siap. Masukkan modal & target lalu klik Mulai Monitor.';
        return;
    }

    if (currentModal >= tpModal) {
        badge.className = 'recom-badge sell-tp';
        badge.innerText = 'SELL / TAKE PROFIT!';
        desc.innerText = 'Target profit tersentuh! Lakukan penjualan di pasar sekarang.';
    } else if (currentModal <= slModal) {
        badge.className = 'recom-badge cut-sl';
        badge.innerText = 'CUT LOSS NOW!';
        desc.innerText = '🚨 Target Stop Loss tersentuh! Modal bersih Anda terancam.';
    } else {
        badge.className = 'recom-badge hold';
        badge.innerText = 'HOLD / MONITORING';
        desc.innerText = '🟢 Pergerakan modal masih aman dalam zona target. Biarkan posisi berjalan.';
    }
}

// ============================================================
// EVENT LISTENERS & INITIALIZATION
// ============================================================

window.addEventListener('DOMContentLoaded', () => {
    // 1. Inisialisasi Loading Bar
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
                checkUserLogin();
                checkDisclaimerStatus();
                initTradingViewChart(ASSET_CONFIG[currentAssetKey].tvSymbol);
            }, 200);
        } else {
            if (bar) bar.style.width = progress + '%';
            if (text) text.innerText = progress + '%';
        }
    }, 25);

    try { 
        loadSavedInputs(); 
        
        // RECOVERY STATUS MONITORING JIKA HALAMAN DI-REFRESH / DIBUKA KEMBALI
        const isMonitoring = localStorage.getItem('nettrace_is_monitoring');
        if (isMonitoring === 'true') {
            const savedModal = getCleanNumber('modal-input');
            const savedTP = getCleanNumber('tp-price');
            const savedSL = getCleanNumber('sl-price');
            const savedEntryPrice = parseFloat(localStorage.getItem('nettrace_entry_price')) || 0;
            const savedAssetKey = localStorage.getItem('nettrace_asset_key') || 'btc';

            if (savedModal > 0 && savedTP > 0 && savedSL > 0) {
                currentAssetKey = savedAssetKey;
                activeTargets.entryPrice = savedEntryPrice;
                activeTargets.modal = savedModal;
                activeTargets.netModalAwal = savedModal;
                activeTargets.tpModal = savedTP;
                activeTargets.slModal = savedSL;
                activeTargets.active = true;

                toggleTradingUI(true);

                const statusText = document.getElementById('status-text');
                if (statusText) {
                    statusText.innerText = `Status: Monitoring Server 24/7 Aktif 🔥`;
                    statusText.style.color = "#00f2fe";
                }

                const btn = document.getElementById('start-btn');
                if (btn) {
                    btn.innerText = "MONITORING BERJALAN";
                    btn.style.background = "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)";
                    btn.style.color = "#8e9baa";
                }
            }
        }
    } catch(e) {}

    // 2. Listener Input Formatting Titik Rupiah Otomatis
    const modalInput = document.getElementById('modal-input');
    const tpInput = document.getElementById('tp-price');
    const slInput = document.getElementById('sl-price');

    if (modalInput) {
        modalInput.addEventListener('input', (e) => formatRupiahInput(e.target));
    }
    if (tpInput) {
        tpInput.addEventListener('input', (e) => formatRupiahInput(e.target));
    }
    if (slInput) {
        slInput.addEventListener('input', (e) => formatRupiahInput(e.target));
    }

    // 3. Listener Tombol Mulai / Stop Monitoring
    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            if (activeTargets.active) {
                stopMonitoring();
            } else {
                startMonitoring();
            }
        });
    }

    // 4. Listener Dropdown Ganti Aset
    const assetSelect = document.getElementById('asset-select') || document.getElementById('assetSelect');
    if (assetSelect) {
        assetSelect.addEventListener('change', (e) => changeAsset(e.target.value));
    }
});

// Loop Pembaruan Data Secara Real-Time (Setiap 5 Detik)
setInterval(updateData, 5000);
updateData();
