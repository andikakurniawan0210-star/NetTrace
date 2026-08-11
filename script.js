/* =========================================
   TP/SL MONITOR
   FRONTEND VERSION
========================================= */


let monitors =
    JSON.parse(
        localStorage.getItem("tpSlMonitors")
    ) || [];

let notifications =
    JSON.parse(
        localStorage.getItem("tpSlNotifications")
    ) || [];


/* ELEMENTS */

const form =
    document.getElementById("monitorForm");

const pair =
    document.getElementById("pair");

const side =
    document.getElementById("side");

const entry =
    document.getElementById("entry");

const tp =
    document.getElementById("tp");

const sl =
    document.getElementById("sl");

const formMessage =
    document.getElementById("formMessage");

const monitorList =
    document.getElementById("monitorList");

const notificationList =
    document.getElementById("notificationList");

const activeCounter =
    document.getElementById("activeCounter");

const livePrice =
    document.getElementById("livePrice");

const lastUpdate =
    document.getElementById("lastUpdate");

const toast =
    document.getElementById("toast");

const toastIcon =
    document.getElementById("toastIcon");

const toastTitle =
    document.getElementById("toastTitle");

const toastText =
    document.getElementById("toastText");


/* =========================================
   BUY / SELL
========================================= */

document.querySelectorAll(".side-btn")
.forEach(button => {

    button.addEventListener(
        "click",
        () => {

            document
                .querySelectorAll(".side-btn")
                .forEach(btn =>
                    btn.classList.remove("active")
                );

            button.classList.add("active");

            side.value =
                button.dataset.side;

        }
    );

});


/* =========================================
   CREATE MONITOR
========================================= */

form.addEventListener(
    "submit",
    event => {

        event.preventDefault();

        formMessage.textContent = "";

        const selectedPair =
            pair.value;

        const selectedSide =
            side.value;

        const entryPrice =
            Number(entry.value);

        const tpPrice =
            Number(tp.value);

        const slPrice =
            Number(sl.value);


        if (
            !entryPrice ||
            !tpPrice ||
            !slPrice
        ) {

            formMessage.textContent =
                "Semua harga harus diisi.";

            return;
        }


        /*
            BUY:
            TP > ENTRY
            SL < ENTRY

            SELL:
            TP < ENTRY
            SL > ENTRY
        */

        if (selectedSide === "BUY") {

            if (tpPrice <= entryPrice) {

                formMessage.textContent =
                    "Untuk BUY, TP harus di atas Entry.";

                return;
            }

            if (slPrice >= entryPrice) {

                formMessage.textContent =
                    "Untuk BUY, SL harus di bawah Entry.";

                return;
            }

        } else {

            if (tpPrice >= entryPrice) {

                formMessage.textContent =
                    "Untuk SELL, TP harus di bawah Entry.";

                return;
            }

            if (slPrice <= entryPrice) {

                formMessage.textContent =
                    "Untuk SELL, SL harus di atas Entry.";

                return;
            }

        }


        const monitor = {

            id: Date.now(),

            pair: selectedPair,

            side: selectedSide,

            entry: entryPrice,

            tp: tpPrice,

            sl: slPrice,

            currentPrice: entryPrice,

            status: "ACTIVE",

            createdAt:
                new Date().toISOString()

        };


        monitors.unshift(monitor);

        save();

        render();


        form.reset();

        side.value = "BUY";

        document
            .querySelectorAll(".side-btn")
            .forEach(btn =>
                btn.classList.remove("active")
            );

        document
            .querySelector(".side-btn.buy")
            .classList.add("active");


        showToast(
            "✓",
            "Monitoring dibuat",
            `${selectedPair} sedang dipantau.`
        );

    }
);


/* =========================================
   RENDER MONITOR
========================================= */

function renderMonitors() {

    const active =
        monitors.filter(
            item =>
                item.status === "ACTIVE"
        );


    activeCounter.textContent =
        active.length;


    if (active.length === 0) {

        monitorList.innerHTML = `
            <div class="empty-state">

                <div class="empty-icon">
                    ◌
                </div>

                <strong>
                    Belum ada monitoring
                </strong>

                <p>
                    Buat monitoring TP/SL untuk
                    mulai memantau harga.
                </p>

            </div>
        `;

        return;
    }


    monitorList.innerHTML =
        active.map(item => {

            const progress =
                calculateProgress(item);


            return `
                <div class="monitor-card">

                    <div class="monitor-top">

                        <div class="monitor-pair">

                            <div class="coin-icon">
                                ◈
                            </div>

                            <div>

                                <strong>
                                    ${item.pair}
                                </strong>

                                <small>
                                    ${item.side} Position
                                </small>

                            </div>

                        </div>

                        <span class="active-label">
                            ● ACTIVE
                        </span>

                    </div>


                    <div class="monitor-prices">

                        <div class="monitor-price entry">

                            <span>ENTRY</span>

                            <strong>
                                ${formatPrice(item.entry)}
                            </strong>

                        </div>


                        <div class="monitor-price tp">

                            <span>TAKE PROFIT</span>

                            <strong>
                                ${formatPrice(item.tp)}
                            </strong>

                        </div>


                        <div class="monitor-price sl">

                            <span>STOP LOSS</span>

                            <strong>
                                ${formatPrice(item.sl)}
                            </strong>

                        </div>

                    </div>


                    <div class="progress-info">

                        <span>
                            Distance to target
                        </span>

                        <span>
                            ${progress}%
                        </span>

                    </div>


                    <div class="progress">

                        <div
                            class="progress-bar"
                            style="width:${progress}%"
                        ></div>

                    </div>


                    <div class="monitor-bottom">

                        <div class="current-price">

                            Current

                            <strong>
                                ${formatPrice(item.currentPrice)}
                            </strong>

                        </div>


                        <button
                            class="stop-button"
                            onclick="stopMonitor(${item.id})"
                        >
                            STOP MONITORING
                        </button>

                    </div>

                </div>
            `;

        }).join("");

}


/* =========================================
   PROGRESS
========================================= */

function calculateProgress(item) {

    const distance =
        Math.abs(
            item.tp - item.sl
        );

    if (!distance) {
        return 0;
    }


    const traveled =
        Math.abs(
            item.currentPrice - item.sl
        );


    let percentage =
        (traveled / distance) * 100;


    percentage =
        Math.max(
            0,
            Math.min(
                100,
                percentage
            )
        );


    return Math.round(
        percentage
    );

}


/* =========================================
   STOP MONITOR
========================================= */

function stopMonitor(id) {

    const monitor =
        monitors.find(
            item => item.id === id
        );

    if (!monitor) {
        return;
    }


    monitor.status =
        "STOPPED";


    save();

    render();


    showToast(
        "✓",
        "Monitoring dihentikan",
        monitor.pair
    );

}


/* =========================================
   SIMULATE PRICE
   Untuk testing frontend
========================================= */

function simulatePrice(
    id,
    price
) {

    const monitor =
        monitors.find(
            item => item.id === id
        );

    if (!monitor) {
        return;
    }


    monitor.currentPrice =
        Number(price);


    /*
       BUY
    */

    if (
        monitor.side === "BUY"
    ) {

        if (
            price >= monitor.tp
        ) {

            triggerMonitor(
                monitor,
                "TP"
            );

            return;
        }


        if (
            price <= monitor.sl
        ) {

            triggerMonitor(
                monitor,
                "SL"
            );

            return;
        }

    }


    /*
       SELL
    */

    if (
        monitor.side === "SELL"
    ) {

        if (
            price <= monitor.tp
        ) {

            triggerMonitor(
                monitor,
                "TP"
            );

            return;
        }


        if (
            price >= monitor.sl
        ) {

            triggerMonitor(
                monitor,
                "SL"
            );

            return;
        }

    }


    save();

    render();

}


/* =========================================
   TRIGGER TP / SL
========================================= */

function triggerMonitor(
    monitor,
    type
) {

    monitor.status =
        type === "TP"
            ? "TP HIT"
            : "SL HIT";


    const notification = {

        id: Date.now(),

        pair: monitor.pair,

        side: monitor.side,

        type: type,

        price:
            type === "TP"
                ? monitor.tp
                : monitor.sl,

        createdAt:
            new Date().toISOString()

    };


    notifications.unshift(
        notification
    );


    save();

    render();


    if (type === "TP") {

        showToast(
            "✓",
            "TAKE PROFIT HIT",
            `${monitor.pair} • ${formatPrice(notification.price)}`
        );

    } else {

        showToast(
            "!",
            "STOP LOSS HIT",
            `${monitor.pair} • ${formatPrice(notification.price)}`
        );

    }


    requestNotification(
        notification
    );


    /*
        NANTI DI SINI KITA HUBUNGKAN
        KE BACKEND / TELEGRAM.

        Contoh konsep:

        fetch("/api/telegram", {
            method: "POST",
            body: JSON.stringify(notification)
        });
    */

}


/* =========================================
   NOTIFICATIONS
========================================= */

function renderNotifications() {

    if (
        notifications.length === 0
    ) {

        notificationList.innerHTML = `
            <div class="empty-state small">
                Belum ada notification.
            </div>
        `;

        return;
    }


    notificationList.innerHTML =
        notifications.map(
            item => {

                const isTP =
                    item.type === "TP";


                return `
                    <div
                        class="notification ${isTP ? "tp" : "sl"}"
                    >

                        <div class="notification-icon">

                            ${isTP ? "✓" : "!"}

                        </div>


                        <div>

                            <strong>

                                ${item.pair}
                                —
                                ${isTP
                                    ? "TAKE PROFIT HIT"
                                    : "STOP LOSS HIT"}

                            </strong>

                            <p>

                                ${item.side}
                                •
                                ${formatPrice(item.price)}

                            </p>

                        </div>


                        <div class="notification-time">

                            ${formatDate(
                                item.createdAt
                            )}

                        </div>

                    </div>
                `;

            }
        ).join("");

}


/* =========================================
   CLEAR NOTIFICATIONS
========================================= */

document
    .getElementById("clearHistory")
    .addEventListener(
        "click",
        () => {

            notifications = [];

            save();

            render();

        }
    );


/* =========================================
   TOAST
========================================= */

function showToast(
    icon,
    title,
    text
) {

    toastIcon.textContent =
        icon;

    toastTitle.textContent =
        title;

    toastText.textContent =
        text;


    toast.classList.add("show");


    clearTimeout(
        window.toastTimer
    );


    window.toastTimer =
        setTimeout(
            () => {

                toast.classList.remove(
                    "show"
                );

            },
            3500
        );

}


/* =========================================
   BROWSER NOTIFICATION
========================================= */

function requestNotification(
    notification
) {

    if (
        !("Notification" in window)
    ) {
        return;
    }


    if (
        Notification.permission ===
        "granted"
    ) {

        createNotification(
            notification
        );

        return;
    }


    if (
        Notification.permission !==
        "denied"
    ) {

        Notification
            .requestPermission()
            .then(
                permission => {

                    if (
                        permission ===
                        "granted"
                    ) {

                        createNotification(
                            notification
                        );

                    }

                }
            );

    }

}


function createNotification(
    notification
) {

    new Notification(

        notification.type === "TP"
            ? "🟢 TAKE PROFIT HIT"
            : "🔴 STOP LOSS HIT",

        {

            body:
                `${notification.pair}\n` +
                `${formatPrice(notification.price)}`

        }

    );

}


/* =========================================
   PRICE
========================================= */

function formatPrice(
    value
) {

    return Number(value)
        .toLocaleString(
            "id-ID",
            {
                maximumFractionDigits: 2
            }
        );

}


/* =========================================
   DATE
========================================= */

function formatDate(
    value
) {

    return new Date(value)
        .toLocaleTimeString(
            "id-ID",
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        );

}


/* =========================================
   SAVE
========================================= */

function save() {

    localStorage.setItem(
        "tpSlMonitors",
        JSON.stringify(
            monitors
        )
    );

    localStorage.setItem(
        "tpSlNotifications",
        JSON.stringify(
            notifications
        )
    );

}


/* =========================================
   RENDER
========================================= */

function render() {

    renderMonitors();

    renderNotifications();

}


/* =========================================
   DEMO LIVE CLOCK
========================================= */

function updateClock() {

    const now =
        new Date();

    lastUpdate.textContent =
        now.toLocaleTimeString(
            "id-ID",
            {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit"
            }
        );

}

setInterval(
    updateClock,
    1000
);

updateClock();


/* =========================================
   INITIAL
========================================= */

render();