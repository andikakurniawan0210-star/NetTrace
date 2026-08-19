// ============================================================
// CONFIG & STATE MANAGEMENT
// ============================================================
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzUiul4OrYMnDOgi_sw6xEvaduit-NyZDwbSwjrTzjhCJkKlKDMJnI6wFq_1rsWSH2h/exec";

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
// CORE TRADING LOGIC & UI UPDATES
// ============================================================
async function fetchCryptoPrice(assetKey) {
    const asset = ASSET_CONFIG[assetKey];
    if (!asset) return null;
    
    try {
        const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${asset.geckoId}&vs_currencies=idr`);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        return data[asset.geckoId].idr;
    } catch (error) {
        console.error("Gagal mengambil harga:", error);
        return null;
    }
}

function startUpdatingPrice() {
    updatePriceUI();
    setInterval(updatePriceUI, 5000);
}

async function updatePriceUI() {
    const currentPrice = await fetchCryptoPrice(currentAssetKey);
    const priceDisplay = document.getElementById('crypto-price');
    
    if (currentPrice !== null) {
        priceDisplay.innerText = `Rp ${currentPrice.toLocaleString('id-ID')}`;
        
        if (activeTargets.active) {
            checkTargets(currentPrice);
        }
    } else {
        priceDisplay.innerText = 'Gagal memuat harga';
    }
}

function updateAssetUI(assetKey) {
    currentAssetKey = assetKey;
    const asset = ASSET_CONFIG[assetKey];
    
    document.querySelectorAll('.koin-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`btn-${assetKey}`).classList.add('active');
    
    const tvWidgetUrl = `https://s.tradingview.com/widgetembed/?frameElementId=tradingview_widget&symbol=${asset.tvSymbol}&interval=1&hidesidetoolbar=1&symboledit=1&saveimage=1&toolbarbg=f1f3f6&studies=%5B%5D&theme=dark&style=1&timezone=Asia%2FJakarta&studies_overrides=%7B%7D&overrides=%7B%7D&enabled_features=%5B%5D&disabled_features=%5B%5D&locale=id&utm_source=localhost&utm_medium=widget_new&utm_campaign=chart&utm_term=${asset.tvSymbol}`;
    document.getElementById('tv-iframe').src = tvWidgetUrl;
    document.getElementById('asset-label').innerText = asset.label;
    
    updatePriceUI();
}

function startMonitoring() {
    const modalInput = document.getElementById('modal-input').value.replace(/\D/g, '');
    const tpInput = document.getElementById('tp-price').value.replace(/\D/g, '');
    const slInput = document.getElementById('sl-price').value.replace(/\D/g, '');
    const feeInput = document.getElementById('fee-input').value.replace(/\D/g, '');
    const feePercent = parseFloat(feeInput) || 0;

    if (!modalInput || !tpInput || !slInput) {
        alert("Harap isi Modal, TP, dan SL!");
        return;
    }

    const modal = parseInt(modalInput, 10);
    const tp = parseInt(tpInput, 10);
    const sl = parseInt(slInput, 10);
    const feeAmount = modal * (feePercent / 100);
    const netModal = modal - feeAmount;

    activeTargets = { 
        modal: modal, 
        netModalAwal: netModal, 
        tpModal: tp, 
        slModal: sl, 
        entryPrice: 0,
        active: true 
    };
    currentCalculatedModal = netModal;
    isTPSent = false;
    isSLSent = false;
    
    toggleTradingUI(true);

    document.getElementById('display-modal').innerText = `Rp ${currentCalculatedModal.toLocaleString('id-ID')}`;
    document.getElementById('display-tp').innerText = `Rp ${tp.toLocaleString('id-ID')}`;
    document.getElementById('display-sl').innerText = `Rp ${sl.toLocaleString('id-ID')}`;
    
    document.getElementById('status-indicator').classList.add('active');
    document.getElementById('status-text').innerText = 'MONITORING AKTIF';
    
    document.getElementById('btn-start').style.display = 'none';
    document.getElementById('btn-stop').style.display = 'block';

    const { token, chatId } = getTelegramConfig();
    const assetPair = ASSET_CONFIG[currentAssetKey].indodaxPair;
    
    if (token && chatId) {
        sendDataToGoogleServer(assetPair, tp, sl);
        sendTelegramMessage(`🟢 <b>NETTRACE MONITORING DIMULAI (WEB+SERVER)</b>\n\nAsset: <b>${ASSET_CONFIG[currentAssetKey].symbol}</b>\nModal Bersih: Rp ${netModal.toLocaleString('id-ID')}\nTarget TP: Rp ${tp.toLocaleString('id-ID')}\nTarget SL: Rp ${sl.toLocaleString('id-ID')}`);
    } else {
        alert("Monitoring berjalan lokal. Token Bot / Chat ID Telegram belum diisi di Pengaturan.");
    }
}

function stopMonitoring() {
    activeTargets.active = false;
    toggleTradingUI(false);
    
    document.getElementById('status-indicator').classList.remove('active');
    document.getElementById('status-text').innerText = 'TIDAK AKTIF';
    
    document.getElementById('btn-start').style.display = 'block';
    document.getElementById('btn-stop').style.display = 'none';

    document.getElementById('display-modal').innerText = '-';
    document.getElementById('display-tp').innerText = '-';
    document.getElementById('display-sl').innerText = '-';

    const { token, chatId } = getTelegramConfig();
    const assetPair = ASSET_CONFIG[currentAssetKey].indodaxPair;

    if (token && chatId) {
        sendDataToGoogleServer(assetPair, 0, 0);
        sendTelegramMessage(`🔴 <b>NETTRACE MONITORING DIHENTIKAN</b>\n\nPemantauan untuk <b>${ASSET_CONFIG[currentAssetKey].symbol}</b> telah dimatikan dari Web.`);
    }
}

function checkTargets(currentPrice) {
    if (activeTargets.entryPrice === 0) activeTargets.entryPrice = currentPrice;

    let growthPercentage = ((currentPrice - activeTargets.entryPrice) / activeTargets.entryPrice);
    currentCalculatedModal = activeTargets.netModalAwal + (activeTargets.netModalAwal * growthPercentage);
    
    document.getElementById('display-modal').innerText = `Rp ${Math.round(currentCalculatedModal).toLocaleString('id-ID')}`;

    if (currentCalculatedModal >= activeTargets.tpModal && !isTPSent) {
        isTPSent = true;
        playAlertSound('TP');
        sendTelegramMessage(`🚀 <b>TARGET TP TERCAPAI (WEB ALERT)!</b>\n\nAsset: <b>${ASSET_CONFIG[currentAssetKey].symbol}</b>\nModal Saat Ini: Rp ${Math.round(currentCalculatedModal).toLocaleString('id-ID')}\nTarget TP: Rp ${activeTargets.tpModal.toLocaleString('id-ID')}`);
        setTimeout(() => {
            alert("🚀 TARGET TP TERCAPAI!");
            stopMonitoring();
        }, 500);
    } else if (currentCalculatedModal <= activeTargets.slModal && !isSLSent) {
        isSLSent = true;
        playAlertSound('SL');
        sendTelegramMessage(`⚠️ <b>TARGET SL TERCAPAI (WEB ALERT)!</b>\n\nAsset: <b>${ASSET_CONFIG[currentAssetKey].symbol}</b>\nModal Saat Ini: Rp ${Math.round(currentCalculatedModal).toLocaleString('id-ID')}\nTarget SL: Rp ${activeTargets.slModal.toLocaleString('id-ID')}`);
        setTimeout(() => {
            alert("⚠️ TARGET SL TERCAPAI!");
            stopMonitoring();
        }, 500);
    }
}

function loadSavedInputs() {
    const modal = localStorage.getItem('nettrace_modal');
    const tp = localStorage.getItem('nettrace_tp');
    const sl = localStorage.getItem('nettrace_sl');
    const fee = localStorage.getItem('nettrace_fee');
    const token = localStorage.getItem('nettrace_bot_token');
    const chatId = localStorage.getItem('nettrace_chat_id');

    if (modal) document.getElementById('modal-input').value = modal;
    if (tp) document.getElementById('tp-price').value = tp;
    if (sl) document.getElementById('sl-price').value = sl;
    if (fee) document.getElementById('fee-input').value = fee;
    if (token) {
        const tokenInput = document.getElementById('bot-token-input');
        if(tokenInput) tokenInput.value = token;
    }
    if (chatId) {
        const chatIdInput = document.getElementById('chat-id-input');
        if(chatIdInput) chatIdInput.value = chatId;
    }
}

// ============================================================
// INITIALIZATION
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    checkUserLogin();
    
    const activeUser = localStorage.getItem('nettrace_active_user');
    if (activeUser) {
        const elUsername = document.getElementById('display-username');
        if (elUsername) elUsername.innerText = activeUser;
    }
    
    document.querySelectorAll('.koin-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            updateAssetUI(e.target.dataset.asset);
        });
    });

    updateAssetUI('btc');
    startUpdatingPrice();
});
