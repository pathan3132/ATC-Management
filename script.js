let allTripsData = []; // Saara data store karne ke liye
// --- LOCAL DATABASE SETUP (IndexedDB) ---
let db;
const request = indexedDB.open("ATC_Slips_DB", 1);

request.onupgradeneeded = (e) => {
    db = e.target.result;
    db.createObjectStore("slips", { keyPath: "id", autoIncrement: true });
};
request.onsuccess = (e) => { db = e.target.result; };

// Function: PDF ko local storage mein save karna
function saveSlipLocally(vNo, date, blob) {
    const transaction = db.transaction(["slips"], "readwrite");
    const store = transaction.objectStore("slips");
    store.add({ vNo, date, pdfBlob: blob, timestamp: new Date() });
}
// --- SECURITY CONFIG ---
const SECRET_PIN = "2026"; // Aap yahan apna 4-digit PIN set karein

// Check if already logged in (Refresh par baar baar lock na dikhe - Optional)
// Agar aap chahte hain ki har baar app khulte hi lock dikhe, toh localStorage mat use karein
function checkLoginStatus() {
    const lockScreen = document.getElementById('lock-screen');
    // Agar session storage use karenge toh browser close hone tak unlocked rahega
    if (sessionStorage.getItem('atc_unlocked') === 'true') {
        lockScreen.classList.add('lock-hidden');
    }
}

// PIN Verification
function verifyPin() {
    const input = document.getElementById('appPin');
    const pin = input.value;
    const errorMsg = document.getElementById('lock-error');
    const lockScreen = document.getElementById('lock-screen');
    const lockCard = document.querySelector('.lock-card');

    if (pin === SECRET_PIN) {
        // Success: Unlock App
        sessionStorage.setItem('atc_unlocked', 'true');
        lockScreen.classList.add('lock-hidden');
        errorMsg.classList.add('hidden');
    } else {
        // Fail: Show Error & Shake
        errorMsg.classList.remove('hidden');
        input.value = "";
        lockCard.classList.add('shake');
        setTimeout(() => lockCard.classList.remove('shake'), 400);
    }
}

// Enter Key se bhi unlock ho jaye
document.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        const lockScreen = document.getElementById('lock-screen');
        if (!lockScreen.classList.contains('lock-hidden')) {
            verifyPin();
        }
    }
});

// Sidebar se Logout karne ka option (Optional)
function logout() {
    if(confirm("Do you want to logout?")) {
        localStorage.removeItem('atc_logged_in');
        location.reload();
    }
}
// IS LINE KO SAHI SE CHECK KAREIN - Sirf URL hona chahiye
const scriptURL = 'https://script.google.com/macros/s/AKfycbzin-51q_OK2kEcEdguAkEhxMQOGgpzuQmyioXL2NTzO4ysvSSZNDXG3pEzw_5wvq46/exec';

window.onload = () => {
    checkLoginStatus();
    updateGreeting();
    loadHomeRecent();
    // Background mein saara data pehle hi kheench lo taaki history turant dikhe
    fetch(scriptURL)
        .then(res => res.json())
        .then(data => { allTripsData = data; })
        .catch(e => console.log("Data load error"));

    setInterval(() => {
        const timeEl = document.getElementById('homeTime');
        if(timeEl) timeEl.innerText = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }, 60000);
};

// Live typing convert to Capital Letters for Beelty slip inputs
document.addEventListener('input', function (e) {
    if (e.target && e.target.closest('#receipt-to-print')) {
        if (e.target.tagName === 'INPUT' && e.target.type !== 'number' && e.target.type !== 'date') {
            let start = e.target.selectionStart;
            let end = e.target.selectionEnd;
            e.target.value = e.target.value.toUpperCase();
            if (start !== null && end !== null) {
                e.target.setSelectionRange(start, end);
            }
        }
    }
});

function updateGreeting() {
    let hrs = new Date().getHours();
    let greet = "Good Morning,";
    if (hrs >= 12 && hrs <= 17) greet = "Good Afternoon,";
    else if (hrs >= 17 && hrs <= 24) greet = "Good Evening,";
    const gElement = document.getElementById('greetingText');
    if(gElement) gElement.innerText = greet;
}

// --- SECTION SWITCHER ---
function showSection(id) {
    document.querySelectorAll('.app-section').forEach(s => s.classList.add('hidden'));
    const target = document.getElementById(id + '-section');
    if(target) target.classList.remove('hidden');
    
    if(id === 'view-trips') loadTrips();
    if(id === 'accounts') updateAccounts();
    if(id === 'home') loadHomeRecent();
    if(id === 'vehicles') loadVehicles(); 
    if(id === 'party-ledger') { 
        loadPartyChips(); 
        document.getElementById('ledgerViewArea').classList.add('hidden'); 
        document.getElementById('partyPickerCard').classList.remove('hidden');
    }
    if(id === 'owner-ledger') {
        loadOwnerChips();
        document.getElementById('ownerLedgerViewArea').classList.add('hidden');
        document.getElementById('ownerPickerCard').classList.remove('hidden');
    }
    
    // --- YE DO LINES ZAROORI HAIN ---
    if(id === 'loading-slip') loadVehicleListForSlip(); 
    if(id === 'slip-history') loadSlipHistory(); // Ye missing tha

    const sidebar = document.getElementById('sidebar');
    const instance = bootstrap.Offcanvas.getInstance(sidebar);
    if(instance) instance.hide();
}

// --- CALCULATION ---
const rateInput = document.getElementById('rate');
const capInput = document.getElementById('capacity');
if(rateInput && capInput) {
    rateInput.addEventListener('input', calculateTotal);
    capInput.addEventListener('input', calculateTotal);
}

function calculateTotal() {
    let rate = parseFloat(document.getElementById('rate').value) || 0;
    let cap = parseFloat(document.getElementById('capacity').value) || 0;
    document.getElementById('amount').value = Math.round(rate * cap);
}

// --- SUBMIT TRIP ---
async function submitTrip() {
    const btn = document.getElementById('submitBtn');
    if(!document.getElementById('date').value || !document.getElementById('vNo').value) {
        alert("Please fill Date and Vehicle Number!"); return;
    }
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> SAVING...'; 
    btn.disabled = true;

    const formData = {
        action: "saveTrip", // Added this
        date: document.getElementById('date').value,
        vNo: document.getElementById('vNo').value.toUpperCase(),
        dNo: document.getElementById('dNo').value,
        from: document.getElementById('from').value,
        to: document.getElementById('to').value,
        amount: document.getElementById('amount').value,
        received: document.getElementById('received').value,
        rate: document.getElementById('rate').value,
        capacity: document.getElementById('capacity').value,
        partyName: document.getElementById('partyName').value,
        material: document.getElementById('material').value,
        remark: document.getElementById('remark').value
    };

    try {
        const response = await fetch(scriptURL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(formData) });
        alert("✅ Trip Saved Successfully!");
        document.getElementById('tripForm').reset();
        showSection('home');
    } catch (e) { alert("Error connecting to server!"); }
    btn.innerHTML = 'SUBMIT TO GOOGLE SHEET'; btn.disabled = false;
}

// --- DATA FETCHING ---
// --- UPDATED HOME DATA & STATS ---
async function loadHomeRecent() {
    const container = document.getElementById('homeRecentTrips');
    const todayBizEl = document.getElementById('todayBiz');
    const todayCountEl = document.getElementById('todayCount');
    const homePendEl = document.getElementById('homePendingCount');
    
    // Set Clock & Date
    const now = new Date();
    document.getElementById('homeTime').innerText = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    document.getElementById('homeDate').innerText = now.toDateString();

    try {
        const response = await fetch(scriptURL);
        const data = await response.json();
        
        container.innerHTML = '';
        let todayBiz = 0;
        let todayCount = 0;
        let pendingCount = 0;
        
        const todayStr = new Date().toLocaleDateString('en-GB').replace(/\//g, '-'); // DD-MM-YYYY format match karein

       data.forEach((trip, index) => {
    let isCollected = (String(trip['_colG'] || "").toLowerCase().trim() === "yes");
    let amt = parseFloat(trip['Amount']) || 0;
    
    // Date comparison (Sheet date string vs Today's string)
    let tripDateStr = String(trip['Date']).replace(/-/g, '/'); // Dash ko slash me badlein
    if(tripDateStr === todayFormatted) {
        todayBiz += amt;
        todayCount++;
    }

            if(!isCollected) pendingCount++;

            // Sirf aakhri 5 trips Home par dikhao
            if(index < 5) {
                const statusClass = isCollected ? 'status-received' : 'status-pending';
                const badge = isCollected
                    ? '<span class="badge bg-success-subtle text-success" style="font-size:9px;">RECEIVED</span>'
                    : '<span class="badge bg-danger-subtle text-danger" style="font-size:9px;">PENDING</span>';
                container.insertAdjacentHTML('beforeend', `
                    <div class="recent-item shadow-sm ${statusClass}">
                        <div>
                            <div class="fw-bold" style="font-size:14px;">${trip['Vehicle No']}</div>
                            <small class="text-muted">${trip['From']} ➔ ${trip['To']}</small>
                        </div>
                        <div class="text-end">
                            <div class="text-primary fw-bold">₹${Number(amt).toLocaleString('en-IN')}</div>
                            <small style="font-size: 10px;" class="d-block mb-1">${trip['Date']}</small>
                            ${badge}
                        </div>
                    </div>`);
            }
        });

        // Update UI Badges
        todayBizEl.innerText = "₹" + todayBiz.toLocaleString('en-IN');
        todayCountEl.innerText = todayCount;
        homePendEl.innerText = pendingCount;

    } catch (e) { container.innerHTML = '<div class="text-center p-3 small text-muted">Please refresh to load data.</div>'; }
}


function toggleAmountVisibility() {
    const amtEl = document.getElementById('sumAmount');
    const eyeIcon = document.getElementById('eyeIcon');
    isAmountVisible = !isAmountVisible;
    
    if (isAmountVisible) {
        amtEl.classList.remove('amount-hidden');
        eyeIcon.classList.replace('bi-eye-slash', 'bi-eye');
    } else {
        amtEl.classList.add('amount-hidden');
        eyeIcon.classList.replace('bi-eye', 'bi-eye-slash');
    }
}

// --- VIEW ALL TRIPS ---
// Date ko sahi format mein badalne ke liye helper function
function parseSheetDate(dateStr) {
    if (!dateStr) return null;
    // Agar date string hai, to use / ya - se split karein
    let parts = String(dateStr).split(/[-/]/);
    if (parts.length === 3) {
        // Parts order: [DD, MM, YYYY]
        // Note: Month 0-indexed hota hai isliye -1 kiya hai
        return new Date(parts[2], parts[1] - 1, parts[0]);
    }
    let d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
}


// WhatsApp Share
async function shareTrip(phone, vNo, from, to, party, amt, date, material, weight) {
    // 1. Phone number cleaning
    let cleanPhone = String(phone || "").replace(/\D/g, '');
    let last10Digits = cleanPhone.slice(-10);

    // 2. History Calculation with Destinations (From/To)
    let historyList = "";
    let oldPendingAmt = 0;
    let pendingTripsCount = 0;

    if (allTripsData && allTripsData.length > 0) {
        allTripsData.forEach(t => {
            let tPhoneD = String(t['Driver No'] || "").replace(/\D/g, '').slice(-10);
            let tPhoneO = String(t['_owner'] || "").replace(/\D/g, '').slice(-10);
            let isCollected = (String(t['_colG'] || "").toLowerCase().trim() === "yes");

            // Agar number match kare aur payment pending ho
            if ((tPhoneD === last10Digits || tPhoneO === last10Digits) && !isCollected) {
                // Check karein ki ye current trip toh nahi hai
                if (!(t['Vehicle No'] === vNo && t['Date'] === date)) {
                    let v = String(t['Vehicle No']).replace(/&/g, "and");
                    let f = String(t['From'] || "N/A").replace(/&/g, "and");
                    let rt = String(t['To'] || "N/A").replace(/&/g, "and");
                    let a = parseFloat(t['Amount'] || 0);
                    let dt = t['Date'] || "No Date";

                    // Designing each old trip entry
                    historyList += `▪️ *${v}* (${dt})\n`;
                    historyList += `   📍 ${f} ➔ ${rt}\n`; // Destinations added here
                    historyList += `   💰 Fare: ₹${a}\n\n`;

                    oldPendingAmt += a;
                    pendingTripsCount++;
                }
            }
        });
    }

    let currentAmt = parseFloat(amt || 0);
    let totalOutstanding = currentAmt + oldPendingAmt;

    // 3. Message Body Design
    let messageBody = `🏢 *ATC ALLINDIA TRANSPORT*
_Munna Bhai & Asif Bhai_
==========================
📍 *CURRENT TRIP DETAILS*
📅 Date: ${date}
🚚 Vehicle: *${vNo}*
🛣️ Route: ${from} To ${to}
💰 Fare: *₹${currentAmt}*

${pendingTripsCount > 0 ? `⚠️ *OLD PENDING TRIPS (${pendingTripsCount})*
--------------------------
${historyList}--------------------------` : ''}

📊 *FINANCIAL SUMMARY*
Old Balance: ₹${oldPendingAmt}
Current Fare: ₹${currentAmt}
━━━━━━━━━━━━━━━━━━
🛑 *TOTAL PAYABLE: ₹${totalOutstanding}*
━━━━━━━━━━━━━━━━━━

💸 *PAYMENT INSTRUCTIONS*
Commission bhej kar SS dein:
📲 UPI: *8888664019*

_Thank you for choosing ATC!_`;

    // 4. Proper Encoding (Taki message na kate)
    let encodedMsg = encodeURIComponent(messageBody);
    let whatsappURL = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMsg}`;

    // 5. Open WhatsApp
    try {
        window.location.href = whatsappURL;
    } catch (e) {
        window.open(whatsappURL, '_blank');
    }
}

// --- VEHICLE SECTION LOGIC ---

async function loadTrips() {
    const container = document.getElementById('tripCardsContainer');
    const summaryBar = document.getElementById('tripSummaryBar');
    
    // Filter Inputs se value lena
    const startVal = document.getElementById('trip-start-date') ? document.getElementById('trip-start-date').value : '';
    const endVal = document.getElementById('trip-end-date') ? document.getElementById('trip-end-date').value : '';

    container.innerHTML = '<div class="text-center p-5"><div class="spinner-border text-primary spinner-border-sm"></div><br>Filtering Sheet Data...</div>';
    
    try {
        const response = await fetch(scriptURL);
        const allData = await response.json();
        allTripsData = allData;
        
        // --- DATE FILTER LOGIC ---
        const data = allData.filter(trip => isDateInRange(trip['Date'], startVal, endVal));

        container.innerHTML = '';
        summaryBar.classList.remove('hidden');

        if(data.length === 0) {
            container.innerHTML = '<div class="text-center p-5 text-muted">No records found for selected dates.</div>';
            return;
        }

        // Vehicle Counting Logic (Badges ke liye)
        const vCountMap = {};
        allData.forEach(t => {
            let v = t['Vehicle No'];
            vCountMap[v] = (vCountMap[v] || 0) + 1;
        });

        let tCount = 0, colCount = 0, penCount = 0;
        const today = new Date();
const todayFormatted = today.toLocaleDateString('en-GB'); // Ye "DD/MM/YYYY" deta hai


        data.forEach(trip => {
            // Data Mapping as per your Sheet Headers
            let isCollected = (String(trip['_colG'] || "").toLowerCase().trim() === "yes"); // Column G: Recived or Not
            let collectorName = trip['_colH'] || "Not Specified"; // Column H: collected name
            let amt = trip['Amount'] || 0;
            let vNo = trip['Vehicle No'];
            let driverNo = trip['Driver No'] || "";
            let ownerNo = trip['_owner'] || ""; // Column I: Lorry Owner Contact
            let tDate = trip['Date'];
            let tFrom = trip['From'];
            let tTo = trip['To'];
            let tParty = trip['Party Name'];
            let tMaterial = trip['Material'];
            let tWeight = trip['Capacity Ton'];
            let tRate = trip['Rate'];
            
            // Badge Logic
            let vCount = vCountMap[vNo];
            let vBadge = vCount === 1 
                ? `<span class="badge bg-info text-dark" style="font-size: 9px; vertical-align: middle; margin-left: 5px; border-radius: 4px;">NEW VEHICLE</span>`
                : `<span class="badge bg-secondary" style="font-size: 9px; vertical-align: middle; margin-left: 5px; border-radius: 4px;">${vCount} TRIPS</span>`;

            // Overdue Logic
            let daysText = "";
            let tripDate = parseSheetDate(tDate);
            if (tripDate && !isCollected) {
                tripDate.setHours(0, 0, 0, 0);
                let diffDays = Math.floor((today - tripDate) / (1000 * 60 * 60 * 24));
                if (diffDays >= 1) {
                    daysText = diffDays > 15 
                        ? `<span class="overdue-tag bg-danger text-white"><i class="bi bi-exclamation-triangle"></i> ${diffDays} Days Overdue</span>`
                        : `<span class="overdue-tag bg-warning text-dark"><i class="bi bi-clock"></i> ${diffDays} Days Pending</span>`;
                }
            }

            tCount++;
            if(isCollected) colCount++; else penCount++;

            // TRIP CARD HTML
            container.insertAdjacentHTML('beforeend', `
                <div class="trip-card shadow-sm ${isCollected ? 'status-collected' : 'status-pending'} mb-4">
                    <div class="d-flex justify-content-between align-items-start border-bottom pb-2 mb-2">
                        <div>
                            <h5 class="fw-bold mb-0 text-primary d-inline-block">${vNo}</h5>
                            ${vBadge}
                            <br>
                            <small class="text-muted"><i class="bi bi-calendar3"></i> ${tDate}</small>
                        </div>
                        <div class="text-end">
                            <span class="badge ${isCollected ? 'bg-success' : 'bg-danger'} mb-1">
                                ${isCollected ? 'COLLECTED' : 'PENDING'}
                            </span>
                            ${isCollected ? `<div class="collector-tag"><i class="bi bi-person-check-fill"></i> ${collectorName}</div>` : ''}
                            <div class="fw-bold h5 mb-0 mt-1" style="color:#003366;">₹${Number(amt).toLocaleString('en-IN')}</div>
                        </div>
                    </div>

                    <div class="route-timeline">
                        <div class="point point-start"></div>
                        <div class="small fw-bold text-uppercase">${tFrom || 'N/A'}</div>
                        <div style="height:15px"></div>
                        <div class="point point-end"></div>
                        <div class="small fw-bold text-uppercase">${tTo || 'N/A'}</div>
                    </div>

                   <div class="details-grid row g-0 text-center mb-2 mt-3">
                        <div class="col-4 border-end">
                            <small class="text-muted d-block" style="font-size:10px;">MATERIAL</small>
                            <span class="fw-bold small">${tMaterial || '-'}</span>
                        </div>
                        <div class="col-4 border-end">
                            <small class="text-muted d-block" style="font-size:10px;">RATE</small>
                            <span class="fw-bold small">${tRate || '0'}</span>
                        </div>
                        <div class="col-4">
                            <small class="text-muted d-block" style="font-size:10px;">WEIGHT/TON</small>
                            <span class="fw-bold small">${tWeight || '0'}</span> 
                        </div>
                    </div>

                    <div class="mt-2 p-2 rounded" style="background: rgba(0,0,0,0.03); font-size: 12px;">
                        <div class="d-flex justify-content-between mb-1">
                            <span><i class="bi bi-person text-muted"></i> Party:</span>
                            <span class="fw-bold">${tParty || '-'}</span>
                        </div>
                        
                        <!-- DRIVER -->
                        <div class="d-flex justify-content-between mb-1 align-items-center">
                            <span><i class="bi bi-telephone text-muted"></i> Driver:</span>
                            <div class="d-flex align-items-center gap-3">
                                <span class="fw-bold">${driverNo || '-'}</span>
                                <div class="d-flex gap-2">
                                    ${driverNo ? `<a href="tel:${driverNo}" class="text-primary"><i class="bi bi-telephone-fill"></i></a>` : ''}
                                    ${driverNo ? `<a href="#" onclick="shareTrip('${safeAttr(driverNo)}', '${safeAttr(vNo)}', '${safeAttr(tFrom)}', '${safeAttr(tTo)}', '${safeAttr(tParty)}', '${safeAttr(amt)}', '${safeAttr(tDate)}', '${safeAttr(tMaterial)}', '${safeAttr(tWeight)}')" class="text-success"><i class="bi bi-whatsapp"></i></a>` : ''}
                                </div>
                            </div>
                        </div>

                        <!-- OWNER -->
                        <div class="d-flex justify-content-between mb-1 align-items-center">
                            <span><i class="bi bi-person-badge text-muted"></i> Owner:</span>
                            <div class="d-flex align-items-center gap-3">
                                <span class="fw-bold">${ownerNo || '-'}</span>
                                <div class="d-flex gap-2">
                                    ${ownerNo ? `<a href="tel:${ownerNo}" class="text-primary"><i class="bi bi-telephone-fill"></i></a>` : ''}
                                    ${ownerNo ? `<a href="#" onclick="shareTrip('${safeAttr(ownerNo)}', '${safeAttr(vNo)}', '${safeAttr(tFrom)}', '${safeAttr(tTo)}', '${safeAttr(tParty)}', '${safeAttr(amt)}', '${safeAttr(tDate)}', '${safeAttr(tMaterial)}', '${safeAttr(tWeight)}')" class="text-success"><i class="bi bi-whatsapp"></i></a>` : ''}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="mt-3">
                        ${daysText}
                    </div>
                </div>
            `);
        });

        // Summary Bar Update
        document.getElementById('sumCount').innerText = tCount;
        document.getElementById('sumColCount').innerText = colCount;
        document.getElementById('sumPenCount').innerText = penCount;

    } catch (e) { 
        container.innerHTML = '<div class="text-center p-5 text-danger">Error loading data. Check Connection.</div>';
    }
}

// --- HELPER: DATE RANGE CHECK ---
function isDateInRange(dateStr, start, end) {
    if (!start && !end) return true;
    let tripDate = parseSheetDate(dateStr);
    if (!tripDate) return false;

    let sDate = start ? new Date(start) : new Date("2000-01-01");
    let eDate = end ? new Date(end) : new Date("2099-12-31");
    
    tripDate.setHours(0,0,0,0);
    sDate.setHours(0,0,0,0);
    eDate.setHours(0,0,0,0);

    return tripDate >= sDate && tripDate <= eDate;
}

async function fetchVehicleHistory(vNo) {
    const safeId = vNo.replace(/\s+/g, '_');
    const histContainer = document.getElementById(`historyList_${safeId}`);
    const statsContainer = document.getElementById(`stats_${safeId}`);
    
    try {
        const res = await fetch(scriptURL + `?action=getVehicleHistory&vNo=${encodeURIComponent(vNo)}`);
        const history = await res.json();
        
        if(!history || history.length === 0) {
            histContainer.innerHTML = '<div class="text-center p-3 text-muted small">No history found for this vehicle</div>';
            statsContainer.innerHTML = '<div class="col-12 text-center small opacity-50">No Data</div>';
            return;
        }

        // --- 1. CALCULATE TOTALS ---
        let totalBus = 0;
        let pendingAmt = 0;
        history.forEach(t => { 
            let amt = parseFloat(t['Amount']) || 0;
            totalBus += amt;
            if(String(t['_status']).toLowerCase() !== 'yes') {
                pendingAmt += amt;
            }
        });

        // --- 2. PREMIUM STATS CARDS ---
        statsContainer.innerHTML = `
            <div class="col-4">
                <div class="p-2 border rounded bg-white shadow-sm">
                    <small class="d-block text-muted" style="font-size:9px">TRIPS</small>
                    <b class="text-primary">${history.length}</b>
                </div>
            </div>
            <div class="col-4">
                <div class="p-2 border rounded bg-white shadow-sm">
                    <small class="d-block text-muted" style="font-size:9px">TOTAL BIZ</small>
                    <b class="text-success">₹${totalBus.toLocaleString('en-IN')}</b>
                </div>
            </div>
            <div class="col-4">
                <div class="p-2 border rounded bg-white shadow-sm">
                    <small class="d-block text-muted" style="font-size:9px">BALANCE</small>
                    <b class="text-danger">₹${pendingAmt.toLocaleString('en-IN')}</b>
                </div>
            </div>
        `;

        // --- 3. STYLISH HISTORY ITEMS ---
        histContainer.innerHTML = history.map(trip => {
            const isRec = String(trip['_status']).toLowerCase() === 'yes';
            return `
            <div class="card mb-2 border-0 shadow-sm overflow-hidden" style="border-left: 4px solid ${isRec ? '#28a745' : '#dc3545'} !important;">
                <div class="card-body p-2" style="font-size: 12px;">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <span class="fw-bold text-dark">${trip['From']} <i class="bi bi-arrow-right text-muted"></i> ${trip['To']}</span>
                            <div class="text-muted" style="font-size: 10px;">
                                <i class="bi bi-calendar3"></i> ${trip['Date']} | <i class="bi bi-person"></i> ${trip['Party Name'] || 'No Party'}
                            </div>
                        </div>
                        <div class="text-end">
                            <div class="fw-bold text-primary">₹${(trip['Amount'] || 0).toLocaleString('en-IN')}</div>
                            <span class="badge ${isRec ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'}" style="font-size: 9px;">
                                ${isRec ? 'RECEIVED' : 'PENDING'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
            `;
        }).join('');

    } catch (e) { 
        histContainer.innerHTML = '<div class="text-danger small p-2">Failed to load history.</div>'; 
    }
}


async function fetchVehicleDocs(vNo) {
    const safeId = vNo.replace(/\s+/g, '_'); // ID dhoondhne ke liye space hatayein
    const docContainer = document.getElementById(`docList_${safeId}`);
    if(!docContainer) return;

    docContainer.innerHTML = 'Loading docs...';
    
    try {
        const res = await fetch(scriptURL + `?action=getDocs&vNo=${encodeURIComponent(vNo)}`);
        const docs = await res.json();
        docContainer.innerHTML = '';
        
        if(!docs || docs.length === 0) {
            docContainer.innerHTML = '<small class="text-muted">No documents found.</small>';
        } else {
            docs.forEach(doc => {
                docContainer.insertAdjacentHTML('beforeend', `
                    <a href="${doc.url}" target="_blank" class="doc-link-item d-block p-1 small">
                        <i class="bi bi-file-earmark-text"></i> ${doc.name}
                    </a>
                `);
            });
        }
    } catch (e) { docContainer.innerHTML = 'Error loading docs.'; }
}

function triggerUpload(vNo) { document.getElementById(`file_${vNo}`).click(); }

async function uploadFile(input, vNo) {
    const file = input.files[0];
    if (!file) return;

    // Button state change
    const btn = input.closest('.v-item-details').querySelector('.btn-primary');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> UPLOADING...';
    btn.disabled = true;

    const reader = new FileReader();
    reader.onload = async function() {
        const base64 = reader.result.split(',')[1];
        
        // PAYLOAD (Aapke purane Code.gs ke hisaab se)
        const payload = {
            action: "uploadDocument", // Sahi action name
            vNo: vNo,
            fileName: file.name,
            base64: base64,
            mimeType: file.type
        };

        try {
            const response = await fetch(scriptURL, { 
                method: 'POST', 
                body: JSON.stringify(payload) 
            });
            alert("✅ Document Uploaded Successfully!");
            fetchVehicleDocs(vNo); // Refresh the list
        } catch (e) {
            alert("Upload failed! Check connection.");
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    };
    reader.readAsDataURL(file);
}

// --- ACCOUNTS CALCULATION (Hisaab-Kitaab) ---
async function updateAccounts() {
    const bizEl = document.getElementById('acc-total-business');
    const pendEl = document.getElementById('acc-total-pending');
    const recdEl = document.getElementById('acc-total-received');
    const listEl = document.getElementById('collector-list');

    const startVal = document.getElementById('acc-start-date').value;
    const endVal = document.getElementById('acc-end-date').value;

    bizEl.innerText = "Loading...";

    try {
        const response = await fetch(scriptURL);
        const allData = await response.json();
        
        // Filter Apply
        const data = allData.filter(trip => isDateInRange(trip['Date'], startVal, endVal));

        let totalBus = 0, totalPend = 0, totalRecd = 0;
        let collectorMap = {};

        data.forEach(trip => {
            let amt = parseFloat(String(trip['Amount'] || "0").replace(/[^0-9.]/g, '')) || 0;
            totalBus += amt;

            let status = String(trip['_colG'] || "").toLowerCase().trim();
            if (status === "yes") {
                totalRecd += amt;
                let name = String(trip['_colH'] || "Other").trim();
                collectorMap[name] = (collectorMap[name] || 0) + amt;
            } else {
                totalPend += amt;
            }
        });

        bizEl.innerText = "₹" + totalBus.toLocaleString('en-IN');
        pendEl.innerText = "₹" + totalPend.toLocaleString('en-IN');
        recdEl.innerText = "₹" + totalRecd.toLocaleString('en-IN');

        let listHtml = "";
        for (let name in collectorMap) {
            listHtml += `
                <div class="list-group-item d-flex justify-content-between align-items-center small">
                    <span><i class="bi bi-person-circle me-2"></i>${name}</span>
                    <b class="text-success">₹${collectorMap[name].toLocaleString('en-IN')}</b>
                </div>`;
        }
        listEl.innerHTML = listHtml || '<div class="p-3 text-center small text-muted">No data for this range</div>';

    } catch (e) { console.error(e); }
}

// ================= PARTY LEDGER (KHATA / TALLY STYLE) =================
let currentLedgerParty = null;
let allPartiesData = [];      // Party list cache (search/filter ke liye)
let currentLedgerEntries = []; // Khuli hui party ki entries cache (CSV/Share/Search ke liye)

// Party datalist + quick chips load karna, aur sabhi parties ka overall total nikalna
async function loadPartyChips() {
    const chipsRow = document.getElementById('partyChipsRow');
    const dataList = document.getElementById('partyListOptions');
    chipsRow.innerHTML = '<small class="text-muted">Loading parties...</small>';

    try {
        const res = await fetch(scriptURL + "?action=getPartyList");
        const parties = await res.json();
        allPartiesData = parties;

        dataList.innerHTML = parties.map(p => `<option value="${p.name}">`).join('');

        // Overall summary (sabhi parties milakar)
        let totalReceivable = 0, totalPayable = 0;
        parties.forEach(p => {
            if (p.balance > 0) totalReceivable += p.balance;
            else totalPayable += Math.abs(p.balance);
        });
        document.getElementById('ledgerAllReceivable').innerText = "₹" + totalReceivable.toLocaleString('en-IN');
        document.getElementById('ledgerAllPayable').innerText = "₹" + totalPayable.toLocaleString('en-IN');

        renderPartyChips(parties);
    } catch (e) {
        chipsRow.innerHTML = '<small class="text-danger">Party list load nahi ho saki.</small>';
    }
}

function renderPartyChips(parties) {
    const chipsRow = document.getElementById('partyChipsRow');
    if (parties.length === 0) {
        chipsRow.innerHTML = '<small class="text-muted">Abhi tak koi party nahi hai. Naam likh kar shuru karein.</small>';
        return;
    }
    chipsRow.innerHTML = parties.map(p => {
        const bal = p.balance;
        const balClass = bal > 0 ? 'text-danger' : (bal < 0 ? 'text-success' : 'text-muted');
        return `<span class="party-chip" onclick="document.getElementById('ledgerPartyInput').value='${safeAttr(p.name)}'; openPartyLedger();">
                    ${safeAttr(p.name)} <b class="${balClass}">₹${Math.abs(bal).toLocaleString('en-IN')}</b>
                </span>`;
    }).join('');
}

// Party chips ko search box se filter karna
function filterPartyChips() {
    const val = document.getElementById('partyChipSearch').value.toUpperCase();
    const filtered = allPartiesData.filter(p => p.name.toUpperCase().includes(val));
    renderPartyChips(filtered);
}

// Ek party ka ledger khol kar dikhana
async function openPartyLedger() {
    const nameInput = document.getElementById('ledgerPartyInput');
    const party = nameInput.value.trim().toUpperCase();
    if (!party) { alert("Pehle party ka naam likhein!"); return; }

    currentLedgerParty = party;
    document.getElementById('partyPickerCard').classList.add('hidden');
    document.getElementById('ledgerViewArea').classList.remove('hidden');
    document.getElementById('ledgerPartyName').innerText = party;
    document.getElementById('ledgerDate').value = new Date().toISOString().split('T')[0];
    cancelLedgerEdit();
    resetLedgerPdfFilter();

    await refreshLedgerTable();
}

// Naya party khulte hi statement filter "All Time" par reset ho jaaye
function resetLedgerPdfFilter() {
    const periodSel = document.getElementById('ledgerPdfPeriod');
    const fromInput = document.getElementById('ledgerPdfFrom');
    const toInput = document.getElementById('ledgerPdfTo');
    if (periodSel) periodSel.value = 'all';
    if (fromInput) fromInput.value = '';
    if (toInput) toInput.value = '';
    toggleLedgerCustomRange();
}

// Custom Date Range select karne par date inputs dikhayein
function toggleLedgerCustomRange() {
    const sel = document.getElementById('ledgerPdfPeriod');
    const box = document.getElementById('ledgerCustomRangeBox');
    if (!sel || !box) return;
    if (sel.value === 'custom') box.classList.remove('hidden'); else box.classList.add('hidden');
}

// Ledger ki har entry ki date ko ek asli Date object mein badalta hai
// (sheet se kabhi "dd-mm-yyyy" text aata hai, kabhi ISO datetime string).
function parseLedgerDateValue(val) {
    if (!val) return null;
    const str = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
        const d = new Date(str);
        return isNaN(d.getTime()) ? null : d;
    }
    const m = str.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
    if (m) return new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
    const d2 = new Date(str);
    return isNaN(d2.getTime()) ? null : d2;
}

// Selected "Statement Period" filter ke hisaab se currentLedgerEntries mein se
// entries chunta hai, aur PDF header ke liye ek readable label deta hai.
// Returns null (aur khud hi alert dikha ke) agar selection invalid ho.
function getLedgerPdfFilteredEntries() {
    const periodSel = document.getElementById('ledgerPdfPeriod');
    const period = periodSel ? periodSel.value : 'all';

    if (period === 'this_year' || period === 'last_year') {
        const year = new Date().getFullYear() - (period === 'last_year' ? 1 : 0);
        const boundary = new Date(year, 0, 1);
        const entries = currentLedgerEntries.filter(row => {
            const d = parseLedgerDateValue(row.date);
            return d && d.getFullYear() === year;
        });
        const openingBalance = currentLedgerEntries.reduce((sum, row) => {
            const d = parseLedgerDateValue(row.date);
            if (d && d < boundary) sum += (parseFloat(row.debit) || 0) - (parseFloat(row.credit) || 0);
            return sum;
        }, 0);
        return { entries, label: `Year ${year}`, openingBalance, showOpening: true };
    }

    if (period === 'custom') {
        const fromVal = document.getElementById('ledgerPdfFrom').value;
        const toVal = document.getElementById('ledgerPdfTo').value;
        if (!fromVal || !toVal) {
            alert("Custom range ke liye From aur To, dono dates select karein.");
            return null;
        }
        const from = new Date(fromVal);
        const to = new Date(toVal);
        to.setHours(23, 59, 59, 999);
        if (from > to) {
            alert("'From' date, 'To' date se pehle honi chahiye.");
            return null;
        }
        const entries = currentLedgerEntries.filter(row => {
            const d = parseLedgerDateValue(row.date);
            return d && d >= from && d <= to;
        });
        const openingBalance = currentLedgerEntries.reduce((sum, row) => {
            const d = parseLedgerDateValue(row.date);
            if (d && d < from) sum += (parseFloat(row.debit) || 0) - (parseFloat(row.credit) || 0);
            return sum;
        }, 0);
        const label = `${from.toLocaleDateString('en-GB')} to ${to.toLocaleDateString('en-GB')}`;
        return { entries, label, openingBalance, showOpening: true };
    }

    return { entries: currentLedgerEntries, label: 'All Time', openingBalance: 0, showOpening: false };
}

// Party badalne ke liye wapas list par jaana
function closePartyLedger() {
    currentLedgerParty = null;
    currentLedgerEntries = [];
    document.getElementById('ledgerViewArea').classList.add('hidden');
    document.getElementById('partyPickerCard').classList.remove('hidden');
    document.getElementById('ledgerPartyInput').value = '';
    loadPartyChips(); // Balances refresh karein
}

// Table + summary refresh karna
async function refreshLedgerTable() {
    if (!currentLedgerParty) return;
    const tbody = document.getElementById('ledgerTableBody');
    tbody.innerHTML = '<tr><td colspan="7" class="text-center p-3"><div class="spinner-border spinner-border-sm text-primary"></div></td></tr>';

    try {
        const res = await fetch(scriptURL + `?action=getPartyLedger&party=${encodeURIComponent(currentLedgerParty)}`);
        const entries = await res.json();
        currentLedgerEntries = entries;
        renderLedgerRows(entries);
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center p-3 text-danger">Ledger load nahi ho saka.</td></tr>';
    }
}

// Rows ko table mein draw karna (running balance ke saath) - search filter ke baad bhi reuse hota hai
function renderLedgerRows(entries) {
    const tbody = document.getElementById('ledgerTableBody');
    let totalDebit = 0, totalCredit = 0, runningBalance = 0, rowsHtml = "";

    entries.forEach((row, idx) => {
        totalDebit += row.debit;
        totalCredit += row.credit;
        runningBalance += (row.debit - row.credit);

        const balColor = runningBalance > 0 ? 'text-danger' : (runningBalance < 0 ? 'text-success' : 'text-muted');

        rowsHtml += `
            <tr>
                <td>${idx + 1}</td>
                <td>${row.date}</td>
                <td>
                    ${row.vNo ? `<b>${safeAttr(row.vNo)}</b><br>` : ''}<small class="text-muted">${row.description || ''}</small>
                </td>
                <td class="text-end text-danger">${row.debit ? '₹' + row.debit.toLocaleString('en-IN') : ''}</td>
                <td class="text-end text-success">${row.credit ? '₹' + row.credit.toLocaleString('en-IN') : ''}</td>
                <td class="text-end fw-bold ${balColor}">₹${Math.abs(runningBalance).toLocaleString('en-IN')}</td>
                <td class="text-end text-nowrap">
                    <i class="bi bi-pencil-square text-primary me-2" style="cursor:pointer;" onclick='startLedgerEdit(${row.rowNumber})'></i>
                    <i class="bi bi-trash text-danger" style="cursor:pointer;" onclick="deleteLedgerEntry(${row.rowNumber})"></i>
                </td>
            </tr>`;
    });

    tbody.innerHTML = rowsHtml || '<tr><td colspan="7" class="text-center p-3 text-muted">Is party ka koi entry nahi hai. Neeche se add karein.</td></tr>';

    document.getElementById('ledgerTotalDebit').innerText = "₹" + totalDebit.toLocaleString('en-IN');
    document.getElementById('ledgerTotalCredit').innerText = "₹" + totalCredit.toLocaleString('en-IN');
    document.getElementById('ledgerBalance').innerText = "₹" + Math.abs(runningBalance).toLocaleString('en-IN') + (runningBalance > 0 ? ' (Lena Hai)' : runningBalance < 0 ? ' (Dena Hai)' : '');
}

// Is party ki entries ke andar hi search karna (vehicle / description)
function filterLedgerRows() {
    const val = document.getElementById('ledgerSearch').value.toUpperCase();
    if (!val) { renderLedgerRows(currentLedgerEntries); return; }
    const filtered = currentLedgerEntries.filter(row =>
        String(row.vNo || '').toUpperCase().includes(val) ||
        String(row.description || '').toUpperCase().includes(val) ||
        String(row.date || '').toUpperCase().includes(val)
    );
    renderLedgerRows(filtered);
}

// Nayi entry add karna, YA edit mode mein ho to update karna
async function addLedgerEntry() {
    if (!currentLedgerParty) { alert("Pehle party select karein!"); return; }

    const date = document.getElementById('ledgerDate').value;
    const vNo = document.getElementById('ledgerVNo').value;
    const desc = document.getElementById('ledgerDesc').value;
    const debit = document.getElementById('ledgerDebit').value;
    const credit = document.getElementById('ledgerCredit').value;
    const editRow = document.getElementById('ledgerEditRow').value;

    if (!date) { alert("Date select karein!"); return; }
    if (!debit && !credit) { alert("Debit ya Credit mein se koi ek amount daalein!"); return; }

    const btn = document.getElementById('ledgerAddBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> SAVING...';

    const payload = {
        action: editRow ? "updateLedgerEntry" : "addLedgerEntry",
        rowNumber: editRow,
        date: date,
        party: currentLedgerParty,
        vNo: vNo,
        description: desc,
        debit: debit || 0,
        credit: credit || 0
    };

    try {
        await fetch(scriptURL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload) });
        cancelLedgerEdit();
        await refreshLedgerTable();
    } catch (e) {
        alert("Entry save nahi ho saki. Internet check karein.");
    }
    btn.disabled = false;
}

// Ek entry ko edit mode mein kholna (form mein values bhar dena)
function startLedgerEdit(rowNumber) {
    const row = currentLedgerEntries.find(r => r.rowNumber === rowNumber);
    if (!row) return;

    document.getElementById('ledgerEditRow').value = rowNumber;
    document.getElementById('ledgerVNo').value = row.vNo || '';
    document.getElementById('ledgerDesc').value = row.description || '';
    document.getElementById('ledgerDebit').value = row.debit || '';
    document.getElementById('ledgerCredit').value = row.credit || '';
    // Date input ko YYYY-MM-DD chahiye
    const parsedDate = new Date(row.date);
    if (!isNaN(parsedDate.getTime())) {
        document.getElementById('ledgerDate').value = parsedDate.toISOString().split('T')[0];
    }

    document.getElementById('ledgerFormTitle').innerHTML = '<i class="bi bi-pencil-square text-primary me-1"></i>Edit Entry';
    document.getElementById('ledgerAddBtn').innerHTML = '<i class="bi bi-check-circle me-1"></i> Update Entry';
    document.getElementById('ledgerCancelEditBtn').classList.remove('hidden');
    document.getElementById('ledgerDate').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Edit mode cancel karke wapas "New Entry" par aana
function cancelLedgerEdit() {
    document.getElementById('ledgerEditRow').value = '';
    document.getElementById('ledgerVNo').value = '';
    document.getElementById('ledgerDesc').value = '';
    document.getElementById('ledgerDebit').value = '';
    document.getElementById('ledgerCredit').value = '';
    document.getElementById('ledgerFormTitle').innerHTML = '<i class="bi bi-plus-circle text-primary me-1"></i>New Entry';
    document.getElementById('ledgerAddBtn').innerHTML = '<i class="bi bi-check-circle me-1"></i> Add To Ledger';
    document.getElementById('ledgerCancelEditBtn').classList.add('hidden');
}

// Ek entry delete karna
async function deleteLedgerEntry(rowNumber) {
    if (!confirm("Kya aap ye entry delete karna chahte hain?")) return;
    try {
        await fetch(scriptURL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ action: "deleteLedgerEntry", rowNumber: rowNumber }) });
        await refreshLedgerTable();
    } catch (e) {
        alert("Delete nahi ho saka. Internet check karein.");
    }
}

// Party ka poora statement WhatsApp par bhejna (text summary)
function shareLedgerStatement() {
    if (!currentLedgerParty || currentLedgerEntries.length === 0) { alert("Is party ki koi entry nahi hai."); return; }

    let totalDebit = 0, totalCredit = 0;
    let lines = "";
    currentLedgerEntries.forEach(row => {
        totalDebit += row.debit;
        totalCredit += row.credit;
        let desc = row.vNo ? `${row.vNo} - ${row.description || ''}` : (row.description || 'Entry');
        if (row.debit) lines += `${row.date} | ${desc} | Dr ₹${row.debit.toLocaleString('en-IN')}\n`;
        if (row.credit) lines += `${row.date} | ${desc} | Cr ₹${row.credit.toLocaleString('en-IN')}\n`;
    });

    const balance = totalDebit - totalCredit;
    const balanceText = balance > 0 ? `₹${balance.toLocaleString('en-IN')} (LENA HAI)` : balance < 0 ? `₹${Math.abs(balance).toLocaleString('en-IN')} (DENA HAI)` : "₹0 (CLEAR)";

    const message = `🏢 *ATC ALLINDIA TRANSPORT*\nParty Statement: *${currentLedgerParty}*\n==========================\n${lines}--------------------------\nTotal Debit: ₹${totalDebit.toLocaleString('en-IN')}\nTotal Credit: ₹${totalCredit.toLocaleString('en-IN')}\n🛑 *BALANCE: ${balanceText}*\n\n_ATC AllIndia Transport_`;

    const encodedMsg = encodeURIComponent(message);
    window.open(`https://api.whatsapp.com/send?text=${encodedMsg}`, '_blank');
}

// Party ki ledger CSV file mein export karna (Excel mein khul jaati hai)
function exportLedgerCSV() {
    if (!currentLedgerParty || currentLedgerEntries.length === 0) { alert("Export karne ke liye koi entry nahi hai."); return; }

    let csv = "Sr No,Date,Vehicle No,Description,Debit,Credit\n";
    currentLedgerEntries.forEach((row, idx) => {
        const desc = String(row.description || '').replace(/"/g, '""');
        csv += `${idx + 1},"${row.date}","${row.vNo || ''}","${desc}",${row.debit},${row.credit}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Ledger_${currentLedgerParty}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
// ================= END PARTY LEDGER =================

// ================= OWNER LEDGER (LORRY MALIK - COMBINED PROFESSIONAL STATEMENT) =================
let currentLedgerOwner = null;
let allOwnersData = [];             // Owner list cache (search/filter ke liye)
let currentOwnerLedgerEntries = []; // Khuli hui owner ki advance entries (raw, backend se)
let currentOwnerCommissionEntries = []; // Khuli hui owner ki pending commission entries (raw, backend se)
let currentOwnerStatement = [];     // Combined + sorted statement (advance + commission ek saath), running balance ke saath

// Owner datalist + quick chips load karna, aur sabhi owners ka combined outstanding (advance + commission) nikalna
async function loadOwnerChips() {
    const chipsRow = document.getElementById('ownerChipsRow');
    const dataList = document.getElementById('ownerListOptions');
    chipsRow.innerHTML = '<small class="text-muted">Loading owners...</small>';

    try {
        const res = await fetch(scriptURL + "?action=getOwnerList");
        const owners = await res.json();
        allOwnersData = owners;

        dataList.innerHTML = owners.map(o => `<option value="${o.name}">`).join('');

        // Overall summary (sabhi owners milakar) - Advance + Commission Pending combined
        let totalReceivable = 0, totalPayable = 0;
        owners.forEach(o => {
            const combined = (o.balance || 0) + (o.pendingCommission || 0);
            // FIX: Debit (advance diya / commission pending) = owner se LENA hai (receivable),
            // Credit zyada hone par = owner ko DENA hai (payable). Pehle ye ulta tha.
            if (combined > 0) totalReceivable += combined;     // Owner se lena hai
            else totalPayable += Math.abs(combined);           // Owner ko dena hai
        });
        document.getElementById('ownerAllReceivable').innerText = "₹" + totalReceivable.toLocaleString('en-IN');
        document.getElementById('ownerAllPayable').innerText = "₹" + totalPayable.toLocaleString('en-IN');

        renderOwnerChips(owners);
    } catch (e) {
        chipsRow.innerHTML = '<small class="text-danger">Owner list load nahi ho saki.</small>';
    }
}

function renderOwnerChips(owners) {
    const chipsRow = document.getElementById('ownerChipsRow');
    if (owners.length === 0) {
        chipsRow.innerHTML = '<small class="text-muted">Abhi tak koi owner nahi hai. Naam likh kar shuru karein.</small>';
        return;
    }
    chipsRow.innerHTML = owners.map(o => {
        const combined = (o.balance || 0) + (o.pendingCommission || 0);
        const balClass = combined > 0 ? 'text-danger' : (combined < 0 ? 'text-success' : 'text-muted');
        return `<span class="party-chip" onclick="document.getElementById('ledgerOwnerInput').value='${safeAttr(o.name)}'; openOwnerLedger();">
                    ${safeAttr(o.name)} <b class="${balClass}">₹${Math.abs(combined).toLocaleString('en-IN')}</b>
                </span>`;
    }).join('');
}

// Owner chips ko search box se filter karna
function filterOwnerChips() {
    const val = document.getElementById('ownerChipSearch').value.toUpperCase();
    const filtered = allOwnersData.filter(o => o.name.toUpperCase().includes(val));
    renderOwnerChips(filtered);
}

// Ek owner ka combined statement khol kar dikhana
async function openOwnerLedger() {
    const nameInput = document.getElementById('ledgerOwnerInput');
    const owner = nameInput.value.trim().toUpperCase();
    if (!owner) { alert("Pehle owner ka naam likhein!"); return; }

    currentLedgerOwner = owner;
    document.getElementById('ownerPickerCard').classList.add('hidden');
    document.getElementById('ownerLedgerViewArea').classList.remove('hidden');
    document.getElementById('ledgerOwnerName').innerText = owner;
    document.getElementById('ownerLedgerDate').value = new Date().toISOString().split('T')[0];
    cancelOwnerLedgerEdit();

    await refreshOwnerStatement();
}

// Owner badalne ke liye wapas list par jaana
function closeOwnerLedger() {
    currentLedgerOwner = null;
    currentOwnerLedgerEntries = [];
    currentOwnerCommissionEntries = [];
    currentOwnerStatement = [];
    document.getElementById('ownerLedgerViewArea').classList.add('hidden');
    document.getElementById('ownerPickerCard').classList.remove('hidden');
    document.getElementById('ledgerOwnerInput').value = '';
    loadOwnerChips(); // Balances refresh karein
}

// Ledger date value ko asli Date object mein badalta hai (dd-mm-yyyy text ya ISO string, dono handle karta hai)
function parseOwnerDateValue(val) {
    if (!val) return null;
    const str = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
        const d = new Date(str);
        return isNaN(d.getTime()) ? null : d;
    }
    const m = str.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
    if (m) return new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
    const d2 = new Date(str);
    return isNaN(d2.getTime()) ? null : d2;
}

// Advance entries + Commission pending entries — dono ko fetch karke ek hi
// professional statement mein jodta hai, date ke hisaab se sort karke running balance nikalta hai
async function refreshOwnerStatement() {
    if (!currentLedgerOwner) return;
    const tbody = document.getElementById('ownerStatementTableBody');
    tbody.innerHTML = '<tr><td colspan="7" class="text-center p-3"><div class="spinner-border spinner-border-sm text-primary"></div></td></tr>';

    try {
        const [advRes, comRes] = await Promise.all([
            fetch(scriptURL + `?action=getOwnerLedger&owner=${encodeURIComponent(currentLedgerOwner)}`),
            fetch(scriptURL + `?action=getOwnerCommission&owner=${encodeURIComponent(currentLedgerOwner)}`)
        ]);
        const advEntries = await advRes.json();
        const comEntries = await comRes.json();
        currentOwnerLedgerEntries = advEntries;
        currentOwnerCommissionEntries = comEntries;

        // Combine dono ko ek common shape mein: {date, type, vNo, description, debit, credit, rowNumber}
        const combined = [];
        advEntries.forEach(row => {
            combined.push({
                type: 'advance',
                date: row.date,
                vNo: row.vNo,
                description: row.description || '',
                debit: row.debit || 0,
                credit: row.credit || 0,
                rowNumber: row.rowNumber
            });
        });
        comEntries.forEach(row => {
            combined.push({
                type: 'commission',
                date: row.date,
                vNo: row.vNo,
                description: `${row.from || ''} → ${row.to || ''}${row.partyName ? ' | ' + row.partyName : ''}`,
                debit: row.amount || 0,   // Commission = owner ko dena hai jab tak settle na ho
                credit: 0,
                rowNumber: row.rowNumber
            });
        });

        // Chronological order (purani entry pehle) taaki running balance sahi bane
        combined.sort((a, b) => {
            const dA = parseOwnerDateValue(a.date), dB = parseOwnerDateValue(b.date);
            if (dA && dB && dA.getTime() !== dB.getTime()) return dA - dB;
            return 0;
        });

        currentOwnerStatement = combined;
        renderOwnerStatement(combined);
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center p-3 text-danger">Statement load nahi ho saka.</td></tr>';
    }
}

// Combined statement table draw karna (running balance ke saath) - search filter ke baad bhi reuse hota hai
function renderOwnerStatement(entries) {
    const tbody = document.getElementById('ownerStatementTableBody');
    let totalAdvanceDebit = 0, totalAdvanceCredit = 0, totalCommission = 0, runningBalance = 0, rowsHtml = "";

    entries.forEach(row => {
        runningBalance += (row.debit - row.credit);
        if (row.type === 'advance') {
            totalAdvanceDebit += row.debit;
            totalAdvanceCredit += row.credit;
        } else {
            totalCommission += row.debit;
        }

        const balColor = runningBalance > 0 ? 'text-danger' : (runningBalance < 0 ? 'text-success' : 'text-muted');
        const typeBadge = row.type === 'commission'
            ? '<span class="badge bg-warning-subtle text-warning border border-warning-subtle">COMMISSION</span>'
            : '<span class="badge bg-primary-subtle text-primary border border-primary-subtle">ADVANCE</span>';

        const actionHtml = row.type === 'commission'
            ? `<button class="btn btn-sm btn-outline-success" onclick="markCommissionReceived(${row.rowNumber})"><i class="bi bi-check2-circle"></i> Mila</button>`
            : `<i class="bi bi-pencil-square text-primary me-2" style="cursor:pointer;" onclick='startOwnerLedgerEdit(${row.rowNumber})'></i>
               <i class="bi bi-trash text-danger" style="cursor:pointer;" onclick="deleteOwnerLedgerEntry(${row.rowNumber})"></i>`;

        rowsHtml += `
            <tr>
                <td class="text-nowrap">${row.date}</td>
                <td>${typeBadge}</td>
                <td>
                    ${row.vNo ? `<b>${safeAttr(row.vNo)}</b><br>` : ''}<small class="text-muted">${row.description || ''}</small>
                </td>
                <td class="text-end text-danger">${row.debit ? '₹' + row.debit.toLocaleString('en-IN') : ''}</td>
                <td class="text-end text-success">${row.credit ? '₹' + row.credit.toLocaleString('en-IN') : ''}</td>
                <td class="text-end fw-bold ${balColor}">₹${Math.abs(runningBalance).toLocaleString('en-IN')}</td>
                <td class="text-end text-nowrap">${actionHtml}</td>
            </tr>`;
    });

    tbody.innerHTML = rowsHtml || '<tr><td colspan="7" class="text-center p-3 text-muted">Is owner ki koi entry nahi hai. Neeche se advance add karein.</td></tr>';

    const advanceBalance = totalAdvanceDebit - totalAdvanceCredit;
    const grandTotal = advanceBalance + totalCommission;

    // FIX: Debit > Credit (positive) = owner ne humse advance liya hai / commission owner se
    // aana baaki hai => ye hume "LENA" hai, na ki "Dena". Pehle ye labels ulte the.
    document.getElementById('ownerAdvanceBalance').innerText = "₹" + Math.abs(advanceBalance).toLocaleString('en-IN') + (advanceBalance > 0 ? ' (Lena)' : advanceBalance < 0 ? ' (Dena)' : '');
    document.getElementById('ownerCommissionPending').innerText = "₹" + totalCommission.toLocaleString('en-IN');
    document.getElementById('ownerGrandTotal').innerText = "₹" + Math.abs(grandTotal).toLocaleString('en-IN') + (grandTotal > 0 ? ' (Lena Hai)' : grandTotal < 0 ? ' (Dena Hai)' : '');
}

// Is owner ke statement mein hi search karna (vehicle / description / type)
function filterOwnerStatement() {
    const val = document.getElementById('ownerStatementSearch').value.toUpperCase();
    if (!val) { renderOwnerStatement(currentOwnerStatement); return; }
    const filtered = currentOwnerStatement.filter(row =>
        String(row.vNo || '').toUpperCase().includes(val) ||
        String(row.description || '').toUpperCase().includes(val) ||
        String(row.type || '').toUpperCase().includes(val)
    );
    renderOwnerStatement(filtered);
}

// ---- ADVANCE ENTRY (manual debit/credit) ----

// Nayi advance entry add karna, YA edit mode mein ho to update karna
async function addOwnerLedgerEntry() {
    if (!currentLedgerOwner) { alert("Pehle owner select karein!"); return; }

    const date = document.getElementById('ownerLedgerDate').value;
    const vNo = document.getElementById('ownerLedgerVNo').value;
    const desc = document.getElementById('ownerLedgerDesc').value;
    const debit = document.getElementById('ownerLedgerDebit').value;
    const credit = document.getElementById('ownerLedgerCredit').value;
    const editRow = document.getElementById('ownerLedgerEditRow').value;

    if (!date) { alert("Date select karein!"); return; }
    if (!debit && !credit) { alert("Debit ya Credit mein se koi ek amount daalein!"); return; }

    const btn = document.getElementById('ownerLedgerAddBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> SAVING...';

    const payload = {
        action: editRow ? "updateOwnerLedgerEntry" : "addOwnerLedgerEntry",
        rowNumber: editRow,
        date: date,
        owner: currentLedgerOwner,
        vNo: vNo,
        description: desc,
        debit: debit || 0,
        credit: credit || 0
    };

    try {
        await fetch(scriptURL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload) });
        cancelOwnerLedgerEdit();
        await refreshOwnerStatement();
        loadOwnerChips();
    } catch (e) {
        alert("Entry save nahi ho saki. Internet check karein.");
    }
    btn.disabled = false;
}

function startOwnerLedgerEdit(rowNumber) {
    const row = currentOwnerLedgerEntries.find(r => r.rowNumber === rowNumber);
    if (!row) return;

    document.getElementById('ownerLedgerEditRow').value = rowNumber;
    document.getElementById('ownerLedgerVNo').value = row.vNo || '';
    document.getElementById('ownerLedgerDesc').value = row.description || '';
    document.getElementById('ownerLedgerDebit').value = row.debit || '';
    document.getElementById('ownerLedgerCredit').value = row.credit || '';
    const parsedDate = new Date(row.date);
    if (!isNaN(parsedDate.getTime())) {
        document.getElementById('ownerLedgerDate').value = parsedDate.toISOString().split('T')[0];
    }

    document.getElementById('ownerLedgerFormTitle').innerHTML = '<i class="bi bi-pencil-square text-primary me-1"></i>Edit Advance Entry';
    document.getElementById('ownerLedgerAddBtn').innerHTML = '<i class="bi bi-check-circle me-1"></i> Update Entry';
    document.getElementById('ownerLedgerCancelEditBtn').classList.remove('hidden');
    document.getElementById('ownerLedgerDate').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function cancelOwnerLedgerEdit() {
    document.getElementById('ownerLedgerEditRow').value = '';
    document.getElementById('ownerLedgerVNo').value = '';
    document.getElementById('ownerLedgerDesc').value = '';
    document.getElementById('ownerLedgerDebit').value = '';
    document.getElementById('ownerLedgerCredit').value = '';
    document.getElementById('ownerLedgerFormTitle').innerHTML = '<i class="bi bi-plus-circle text-primary me-1"></i>New Advance Entry';
    document.getElementById('ownerLedgerAddBtn').innerHTML = '<i class="bi bi-check-circle me-1"></i> Add To Statement';
    document.getElementById('ownerLedgerCancelEditBtn').classList.add('hidden');
}

async function deleteOwnerLedgerEntry(rowNumber) {
    if (!confirm("Kya aap ye advance entry delete karna chahte hain?")) return;
    try {
        await fetch(scriptURL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ action: "deleteOwnerLedgerEntry", rowNumber: rowNumber }) });
        await refreshOwnerStatement();
        loadOwnerChips();
    } catch (e) {
        alert("Delete nahi ho saka. Internet check karein.");
    }
}

// ---- COMMISSION SETTLEMENT (Data_log col G/H update, auto-computed) ----

// Owner ki commission mil jaane par settle karna (Data_log col G/H update)
async function markCommissionReceived(rowNumber) {
    const collectedBy = prompt("Ye commission kisne collect ki? (Naam likhein)", currentLedgerOwner || "");
    if (collectedBy === null) return; // user cancelled

    try {
        await fetch(scriptURL, {
            method: 'POST', mode: 'no-cors',
            body: JSON.stringify({ action: "markCommissionReceived", rowNumber: rowNumber, collectedBy: collectedBy })
        });
        await refreshOwnerStatement();
        loadOwnerChips(); // overall chip totals refresh karein
    } catch (e) {
        alert("Update nahi ho saka. Internet check karein.");
    }
}

// ---- WHATSAPP SHARE (poora professional statement text ke roop mein) ----

function shareOwnerStatement() {
    if (!currentLedgerOwner || currentOwnerStatement.length === 0) { alert("Is owner ki koi entry nahi hai."); return; }

    let totalAdvanceDebit = 0, totalAdvanceCredit = 0, totalCommission = 0, runningBalance = 0;
    let lines = "";
    currentOwnerStatement.forEach(row => {
        runningBalance += (row.debit - row.credit);
        if (row.type === 'advance') { totalAdvanceDebit += row.debit; totalAdvanceCredit += row.credit; }
        else { totalCommission += row.debit; }

        const tag = row.type === 'commission' ? '[COMMISSION]' : '[ADVANCE]';
        const amt = row.debit ? `Dr ₹${row.debit.toLocaleString('en-IN')}` : `Cr ₹${row.credit.toLocaleString('en-IN')}`;
        lines += `${row.date} ${tag} ${row.description || row.vNo || ''} — ${amt}\n`;
    });

    const advanceBalance = totalAdvanceDebit - totalAdvanceCredit;
    const grandTotal = advanceBalance + totalCommission;
    const grandText = grandTotal > 0 ? `₹${grandTotal.toLocaleString('en-IN')} (Lena Hai)` : grandTotal < 0 ? `₹${Math.abs(grandTotal).toLocaleString('en-IN')} (Dena Hai)` : '₹0';

    const message = `🏢 *ATC ALLINDIA TRANSPORT*\nOwner Statement: *${currentLedgerOwner}*\n==========================\n${lines}--------------------------\nAdvance Balance: ₹${Math.abs(advanceBalance).toLocaleString('en-IN')}\nCommission Pending: ₹${totalCommission.toLocaleString('en-IN')}\n🛑 *GRAND TOTAL: ${grandText}*\n\n_ATC AllIndia Transport_`;

    const encodedMsg = encodeURIComponent(message);
    window.open(`https://api.whatsapp.com/send?text=${encodedMsg}`, '_blank');
}
// ---- PDF STATEMENT (Download / WhatsApp Share) — same design as Party Ledger PDF ----
async function generateOwnerLedgerPDF(isShare = false) {
    if (!currentLedgerOwner || currentOwnerStatement.length === 0) {
        alert("Statement khali hai!"); return;
    }
    if (!window.jspdf || !window.jspdf.jsPDF) {
        alert("PDF library load nahi ho payi. Internet connection check karein aur page refresh karein.");
        return;
    }

    const trigerBtn = isShare
        ? document.querySelector('#ownerLedgerViewArea .btn-outline-success')
        : document.querySelector('#ownerLedgerViewArea .btn-outline-danger');
    const originalBtnHtml = trigerBtn ? trigerBtn.innerHTML : null;
    if (trigerBtn) {
        trigerBtn.disabled = true;
        trigerBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Generating...';
    }

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const marginX = 14;

        const COLORS = {
            navy: [0, 35, 71], gold: [179, 139, 0], gray: [100, 116, 139],
            lightGray: [148, 163, 184], border: [203, 213, 225], panel: [248, 250, 252],
            panel2: [241, 245, 249], red: [183, 28, 28], green: [27, 94, 32], black: [15, 23, 42]
        };

        let totalDebit = 0, totalCredit = 0, totalCommission = 0, runningBal = 0;
        const bodyRows = [];
        const balanceSigns = [];

        currentOwnerStatement.forEach((row, idx) => {
            const debit = parseFloat(row.debit) || 0;
            const credit = parseFloat(row.credit) || 0;
            totalDebit += debit;
            totalCredit += credit;
            if (row.type === 'commission') totalCommission += debit;
            runningBal += (debit - credit);
            balanceSigns.push(runningBal);
            bodyRows.push([
                idx + 1,
                formatLedgerDateForPdf(row.date),
                row.type === 'commission' ? 'COMMISSION' : 'ADVANCE',
                row.vNo || 'GENERAL',
                row.description || '-',
                debit ? formatMoneyForPdf(debit) : '-',
                credit ? formatMoneyForPdf(credit) : '-',
                formatMoneyForPdf(Math.abs(runningBal))
            ]);
        });

        const advanceBalance = totalDebit - totalCredit - totalCommission; // pure advance part (excl. commission rows)
        const netBalance = runningBal; // advance + commission combined = Grand Total
        // Positive = owner se LENA hai (receivable), Negative = owner ko DENA hai (payable)
        const netStatus = netBalance > 0 ? "RECEIVABLE" : netBalance < 0 ? "PAYABLE" : "CLEAR";
        const netColor = netBalance > 0 ? COLORS.red : (netBalance < 0 ? COLORS.green : COLORS.navy);
        const netFillColor = netBalance > 0 ? [253, 235, 235] : (netBalance < 0 ? [232, 245, 233] : COLORS.panel2);

        let logoImg = null;
        try { logoImg = await loadImageForPdf('Images/ATC_Logo.png'); } catch (e) { /* no logo, that's fine */ }

        function drawHeader() {
            if (logoImg) { try { doc.addImage(logoImg, 'PNG', marginX, 10, 18, 18); } catch (e) {} }
            const textX = logoImg ? marginX + 22 : marginX;
            doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(...COLORS.navy);
            doc.text('ATC ALLINDIA TRANSPORT', textX, 17);
            doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...COLORS.gold);
            doc.text('VEGETABLE SUPPLIERS & COMMISSION AGENT', textX, 22);
            doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...COLORS.gray);
            doc.text('Solapur-Dhule Road, Aurangabad (MH) 431002  |  9673732113', textX, 27);

            const boxW = 46, boxH = 16, boxX = pageWidth - marginX - boxW, boxY = 9;
            doc.setFillColor(...COLORS.panel); doc.setDrawColor(...COLORS.border);
            doc.roundedRect(boxX, boxY, boxW, boxH, 1.5, 1.5, 'FD');
            doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...COLORS.gray);
            doc.text('STATEMENT DATE', boxX + boxW / 2, boxY + 6, { align: 'center' });
            doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...COLORS.navy);
            doc.text(new Date().toLocaleDateString('en-GB'), boxX + boxW / 2, boxY + 12.5, { align: 'center' });

            doc.setDrawColor(...COLORS.navy); doc.setLineWidth(0.8);
            doc.line(marginX, 32, pageWidth - marginX, 32);
        }

        drawHeader();

        // ================= OWNER + NET BALANCE SUMMARY (first page only) =================
        const panelY = 37, panelH = 22, panelW = pageWidth - marginX * 2;
        doc.setFillColor(...COLORS.panel); doc.setDrawColor(...COLORS.border);
        doc.roundedRect(marginX, panelY, panelW, panelH, 2, 2, 'FD');

        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...COLORS.gray);
        doc.text('OWNER ACCOUNT (GADI MALIK)', marginX + 6, panelY + 8);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...COLORS.black);
        doc.text(String(currentLedgerOwner), marginX + 6, panelY + 16);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...COLORS.gray);
        doc.text(`${currentOwnerStatement.length} Entries  |  Advance + Commission Combined`, marginX + 6, panelY + 20);

        const rightEdge = pageWidth - marginX - 6;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...COLORS.gray);
        doc.text('GRAND TOTAL', rightEdge, panelY + 7, { align: 'right' });
        doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(...netColor);
        doc.text(formatMoneyForPdf(Math.abs(netBalance)), rightEdge, panelY + 14, { align: 'right' });

        doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
        const badgeW = doc.getTextWidth(netStatus) + 8;
        const badgeH = 5.5, badgeX = rightEdge - badgeW, badgeY = panelY + 16.5;
        doc.setFillColor(...netFillColor);
        doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 2.5, 2.5, 'F');
        doc.setTextColor(...netColor);
        doc.text(netStatus, rightEdge - badgeW / 2, badgeY + 3.8, { align: 'center' });

        // ================= TABLE =================
        doc.autoTable({
            startY: panelY + panelH + 6,
            margin: { left: marginX, right: marginX, top: 34 },
            head: [['#', 'DATE', 'TYPE', 'VEHICLE NO', 'DESCRIPTION', 'DEBIT (Dr)', 'CREDIT (Cr)', 'BALANCE']],
            body: bodyRows,
            foot: [[
                '', '', '', '', 'TOTAL:',
                formatMoneyForPdf(totalDebit),
                formatMoneyForPdf(totalCredit),
                formatMoneyForPdf(Math.abs(netBalance))
            ]],
            styles: {
                font: 'helvetica', fontSize: 8, cellPadding: 2, lineColor: COLORS.border,
                lineWidth: 0.1, textColor: COLORS.black, valign: 'middle'
            },
            headStyles: { fillColor: COLORS.navy, textColor: 255, fontStyle: 'bold', halign: 'center' },
            footStyles: { fillColor: COLORS.panel2, textColor: COLORS.black, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [252, 253, 254] },
            columnStyles: {
                0: { cellWidth: 8, halign: 'center' },
                1: { cellWidth: 18 },
                2: { cellWidth: 20, halign: 'center' },
                3: { cellWidth: 22 },
                4: { cellWidth: 'auto' },
                5: { cellWidth: 22, halign: 'right' },
                6: { cellWidth: 22, halign: 'right' },
                7: { cellWidth: 24, halign: 'right', fontStyle: 'bold' }
            },
            didParseCell: function (data) {
                if (data.section === 'body') {
                    if (data.column.index === 5 && data.cell.raw !== '-') data.cell.styles.textColor = COLORS.red;
                    if (data.column.index === 6 && data.cell.raw !== '-') data.cell.styles.textColor = COLORS.green;
                    if (data.column.index === 7) {
                        const bal = balanceSigns[data.row.index];
                        data.cell.styles.textColor = bal > 0 ? COLORS.red : (bal < 0 ? COLORS.green : COLORS.gray);
                    }
                }
                if (data.section === 'foot') {
                    if (data.column.index === 5) data.cell.styles.textColor = COLORS.red;
                    if (data.column.index === 6) data.cell.styles.textColor = COLORS.green;
                    if (data.column.index === 7) data.cell.styles.textColor = netColor;
                }
            },
            didDrawPage: function (data) {
                if (data.pageNumber > 1) drawHeader();
                doc.setDrawColor(...COLORS.border); doc.setLineWidth(0.2);
                doc.line(marginX, pageHeight - 13, pageWidth - marginX, pageHeight - 13);
                doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...COLORS.lightGray);
                doc.text(`ATC ALLINDIA TRANSPORT — Owner Statement (All Time)`, marginX, pageHeight - 8);
                doc.text(`Page ${data.pageNumber} of {total_pages_count_string}`, pageWidth - marginX, pageHeight - 8, { align: 'right' });
            }
        });

        if (typeof doc.putTotalPages === 'function') { doc.putTotalPages('{total_pages_count_string}'); }

        // ================= SIGNATURE + DISCLAIMER =================
        let finalY = doc.lastAutoTable.finalY + 8;
        if (finalY > pageHeight - 48) { doc.addPage(); drawHeader(); finalY = 40; }

        doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...COLORS.gray);
        doc.text('AMOUNT IN WORDS:', marginX, finalY);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...COLORS.black);
        const netTag = netBalance > 0 ? 'Receivable From Owner' : netBalance < 0 ? 'Payable To Owner' : 'Clear';
        const wordsText = `Rupees ${numberToWordsIndian(Math.abs(netBalance))} Only (${netTag})`;
        const wrappedWords = doc.splitTextToSize(wordsText, pageWidth - marginX * 2);
        doc.text(wrappedWords, marginX, finalY + 5);
        finalY += 5 + wrappedWords.length * 4.2 + 8;

        doc.setDrawColor(...COLORS.navy); doc.setLineWidth(0.3);
        doc.line(pageWidth - marginX - 60, finalY + 8, pageWidth - marginX, finalY + 8);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...COLORS.navy);
        doc.text('For, ATC ALLINDIA TRANSPORT', pageWidth - marginX, finalY + 13, { align: 'right' });
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...COLORS.gray);
        doc.text('Authorised Signatory', pageWidth - marginX, finalY + 17, { align: 'right' });

        const discY = finalY + 26;
        doc.setDrawColor(...COLORS.border); doc.setLineWidth(0.2);
        doc.line(marginX, discY - 5, pageWidth - marginX, discY - 5);
        doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5); doc.setTextColor(...COLORS.lightGray);
        doc.text('This is a computer-generated statement and does not require a physical signature.', pageWidth / 2, discY, { align: 'center' });
        doc.text('For any discrepancy in the above statement, please contact us within 7 days of receipt.', pageWidth / 2, discY + 4, { align: 'center' });
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...COLORS.navy);
        doc.text('Thank you for your business with ATC AllIndia Transport', pageWidth / 2, discY + 10, { align: 'center' });

        // ================= SAVE / SHARE =================
        const fileName = `OwnerLedger_${currentLedgerOwner}.pdf`;
        if (isShare) {
            const pdfBlob = doc.output('blob');
            const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title: 'ATC Owner Ledger Statement' });
            } else {
                doc.save(fileName);
            }
        } else {
            doc.save(fileName);
        }
    } catch (err) {
        console.error(err);
        alert("PDF banane mein error aayi: " + err.message);
    } finally {
        if (trigerBtn) {
            trigerBtn.disabled = false;
            trigerBtn.innerHTML = originalBtnHtml;
        }
    }
}
// ================= END OWNER LEDGER =================

// --- FILTERS & HELPERS ---
function filterTrips() {
    let val = document.getElementById("tripSearch").value.toUpperCase();
    let cards = document.getElementsByClassName("trip-card");
    for (let c of cards) { c.style.display = c.innerText.toUpperCase().includes(val) ? "" : "none"; }
}

function filterVehicles() {
    let val = document.getElementById("vSearch").value.toUpperCase();
    let cards = document.getElementsByClassName("v-list-item"); 
    for (let c of cards) { 
        c.style.display = c.innerText.toUpperCase().includes(val) ? "" : "none"; 
    }
}

let currentVehicleTrips = [];



// 2. Fill Logic
function fillSlipFromSelection() {
    const idx = document.getElementById('tripSelectDropdown').value;
    const trip = currentVehicleTrips[idx];
    
    if(!trip) return;

    // Header Data
    document.getElementById('slip_vNo').value = (trip['Vehicle No'] || "").toUpperCase();
    document.getElementById('slip_date').value = (trip['Date'] || "").toUpperCase();
    document.getElementById('slip_party').value = (trip['Party Name'] || "").toUpperCase();
    document.getElementById('slip_from').value = (trip['From'] || "").toUpperCase();
    document.getElementById('slip_to').value = (trip['To'] || "").toUpperCase();
    
    // Finance Data
    document.getElementById('slip_rate').value = trip['Rate'] || 0;
    document.getElementById('slip_weight').value = (trip['Capacity Ton'] ? trip['Capacity Ton'] * 1000 : 0);
    document.getElementById('slip_advance').value = trip['Advance'] || 0;
    document.getElementById('slip_dPrice').value = trip['Driver Prize'] || trip['Driver Price'] || 0;
    
    // Contacts & Details
    document.getElementById('slip_lOwner').value = (trip['Lorry Owner Name'] || "").toUpperCase();
    document.getElementById('slip_oMob').value = (trip['Lorry Owner Contact'] || trip['_owner'] || "").toUpperCase();
    document.getElementById('slip_dName').value = (trip['Driver Name'] || "").toUpperCase();
    document.getElementById('slip_dMob').value = (trip['Driver No'] || "").toUpperCase();
    document.getElementById('slip_licence').value = (trip['Licence No'] || "").toUpperCase();
    
    const rowInput = document.getElementById('slip_rowNum');
    if(rowInput) rowInput.value = trip.rowNumber;

    calculateSlip(); 
}

// 3. Calculation
// --- UPDATED LOADING SLIP CALCULATION ---
function calculateSlip() {
    let rate = parseFloat(document.getElementById('slip_rate').value) || 0;     // Per Ton Rate
    let weight = parseFloat(document.getElementById('slip_weight').value) || 0; // In Tons (e.g. 30.250)
    
    // Freight = Rate * Weight (Tons)
    let freight_total = Math.round(weight * rate);
    
    // Agar Rate aur Weight dala hai, toh Freight auto-fill karein
    if(rate > 0 && weight > 0) {
        document.getElementById('slip_freight').value = freight_total;
    }
    
    updateFinalNetPayable();
}

// 2. Agar user direct Bhada (Freight) likhna chahe toh ye kaam karega
function calculateTotalFromManual() {
    updateFinalNetPayable();
}

// 3. Final calculation logic
function updateFinalNetPayable() {
    let freight = parseFloat(document.getElementById('slip_freight').value) || 0;
    let adv = parseFloat(document.getElementById('slip_advance').value) || 0;
    let dPrice = parseFloat(document.getElementById('slip_dPrice').value) || 0;

    // Net Payable = Freight - Advance + Driver Price
    let toPay = (freight - adv) + dPrice;

    document.getElementById('slip_toPay').value = Math.round(toPay);
}

// --- AUTOMATIC CAPITAL DATA SAVE ---
// Sabhi inputs ko save karte waqt capital mein convert karne ke liye function
function getInputValueCaps(id) {
    let val = document.getElementById(id).value;
    return val ? val.toUpperCase().trim() : "";
}

// Timing Suffix (Auto 'Hr' add karna)
const timingInput = document.getElementById('slip_timing');
if(timingInput) {
    timingInput.addEventListener('blur', function() {
        let val = this.value.trim();
        if(val !== "" && !val.toUpperCase().includes('HR')) {
            this.value = val + " Hr";
        }
    });
}

// 4. Generate & Save
// script.js mein generateBeeltyPDF function ko update karein

async function generateBeeltyPDF() {
    const btn = document.getElementById('slipSubmitBtn');
    const element = document.getElementById('receipt-to-print');

    // --- FIX: ENFORCE CAPITAL LETTERS IN ALL DOM INPUT VALUES & ATTRIBUTES FOR PDF CAPTURE ---
    const allInputs = element.querySelectorAll('input');
    allInputs.forEach(input => {
        if (input.type !== 'number' && input.type !== 'date') {
            input.value = (input.value || "").toUpperCase();
        }
        // HTML attribute update karein taaki html2canvas ise Capital read kare
        input.setAttribute('value', input.value); 
    });

    const vNo = document.getElementById('slip_vNo').value || "N/A";

    if(!vNo || vNo === "N/A") return alert("Data select karein!");

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Generating PDF...';

    // --- FIX: MOBILE SCALING ISSUES ---
    const originalTransform = element.style.transform;
    const originalMargin = element.style.margin;
    const originalPosition = element.style.position;

    element.style.transform = "none"; // Scale reset to 100%
    element.style.margin = "0 auto";
    element.style.position = "relative";
    element.style.width = "794px"; // Standard A4 Width

    const opt = {
        margin: 0,
        filename: `Slip_${vNo}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
            scale: 2,
            useCORS: true, 
            logging: false,
            letterRendering: true,
            scrollX: 0,
            scrollY: 0,
            width: 794
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
        // PDF Generate karein
        const pdfWorker = html2pdf().set(opt).from(element);
        const pdfBase64 = await pdfWorker.outputPdf('datauristring').then(res => res.split(',')[1]);
        
        // Save PDF to Device
        await pdfWorker.save();

        // Google Sheet payload (Caps ensured)
        const payload = {
            action: "saveLoadingSlip",
            rowNumber: document.getElementById('slip_rowNum').value,
            vNo: vNo.toUpperCase(),
            date: document.getElementById('slip_date').value || "NoDate",
            pdfBase64: pdfBase64,
            partyName: document.getElementById('slip_party').value.toUpperCase(),
            from: document.getElementById('slip_from').value.toUpperCase(),
            to: document.getElementById('slip_to').value.toUpperCase(),
            rate: document.getElementById('slip_rate').value,
            weight: document.getElementById('slip_weight').value,
            advance: document.getElementById('slip_advance').value,
            driverPrice: document.getElementById('slip_dPrice').value,
            toPay: document.getElementById('slip_toPay').value,
            lorryOwner: document.getElementById('slip_lOwner').value.toUpperCase(),
            ownerMob: document.getElementById('slip_oMob').value.toUpperCase(),
            driverName: document.getElementById('slip_dName').value.toUpperCase(),
            driverMob: document.getElementById('slip_dMob').value.toUpperCase(),
            licenceNo: document.getElementById('slip_licence').value.toUpperCase()
        };

        // Server par bhejein
        await fetch(scriptURL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload) });

        alert("✅ PDF Saved Successfully!");
        resetBeeltyForm();
        showSection('slip-history');

    } catch (e) {
        console.error(e);
        alert("Error: " + e.message);
    } finally {
        element.style.transform = originalTransform;
        element.style.margin = originalMargin;
        element.style.position = originalPosition;

        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-cloud-arrow-up-fill me-2"></i> FINALIZE, SAVE & WHATSAPP';
    }
}


// Search field aur form reset karne ka naya function
function resetBeeltyForm() {
    // 1. Search fields clear karein
    document.getElementById('slipSearchVNo').value = "";
    document.getElementById('tripSelectionArea').classList.add('hidden');
    document.getElementById('newVehicleAlert').classList.add('hidden');
    
    // 2. Beelty Form clear karein (Inputs)
    const slipInputs = [
        'slip_vNo', 'slip_date', 'slip_party', 'slip_from', 'slip_to',
        'slip_rate', 'slip_weight', 'slip_advance', 'slip_dPrice',
        'slip_lOwner', 'slip_oMob', 'slip_dName', 'slip_dMob', 
        'slip_licence', 'slip_toPay', 'slip_rowNum'
    ];
    
    slipInputs.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = (id.includes('rate') || id.includes('weight') || id.includes('advance') || id.includes('Price') || id.includes('Pay')) ? 0 : "";
    });
}

// Loading Slip ke liye gaadiyon ki list load karna
// 1. Datalist ko load karna (Autocomplete ke liye)
async function loadVehicleListForSlip() {
    const list = document.getElementById('vehicleListOptions');
    if (!list) return;

    try {
        const response = await fetch(scriptURL + "?action=getVehicles");
        const vehicles = await response.json();
        // Datalist mein saari gaadiyan add karein
        list.innerHTML = vehicles.map(v => `<option value="${v}">`).join('');
    } catch (e) {
        console.error("Datalist error:", e);
    }
}

// 2. Search ya New Entry handle karna
async function searchVehicleForSlip() {
    const vNo = document.getElementById('slipSearchVNo').value.toUpperCase().trim();
    if(!vNo) return alert("Please enter a Vehicle Number!");
    
    const btn = document.querySelector('[onclick="searchVehicleForSlip()"]');
    const selectionArea = document.getElementById('tripSelectionArea');
    const newVAlert = document.getElementById('newVehicleAlert');
    
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
    selectionArea.classList.add('hidden');
    newVAlert.classList.add('hidden');

    try {
        const res = await fetch(scriptURL + "?action=getTripsByVehicle&vNo=" + encodeURIComponent(vNo));
        currentVehicleTrips = await res.json();
        
        if(!currentVehicleTrips || currentVehicleTrips.length === 0) {
            // CASE: Nayi Gaadi (Record mein nahi hai)
            newVAlert.classList.remove('hidden');
            clearSlipForNewEntry(vNo);
        } else {
            // CASE: Record mil gaya
            const dropdown = document.getElementById('tripSelectDropdown');
            dropdown.innerHTML = currentVehicleTrips.map((t, i) => 
                `<option value="${i}">${t['Date']} | ${t['From']} to ${t['To']}</option>`
            ).join('');
            selectionArea.classList.remove('hidden');
            fillSlipFromSelection(); // Pehli trip auto-fill karein
        }
    } catch(e) { 
        alert("Server error. Please try again."); 
    } finally {
        btn.innerHTML = '<i class="bi bi-search me-1"></i> GO';
    }
}

// 3. Agar gaadi nayi hai toh form khali karke sirf number daalna
function clearSlipForNewEntry(vNo) {
    // Beelty ke fields ko khali karein
    document.getElementById('slip_vNo').value = vNo;
    document.getElementById('slip_date').value = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
    document.getElementById('slip_party').value = "";
    document.getElementById('slip_from').value = "";
    document.getElementById('slip_to').value = "";
    document.getElementById('slip_rate').value = 0;
    document.getElementById('slip_weight').value = 0;
    document.getElementById('slip_advance').value = 0;
    document.getElementById('slip_dPrice').value = 0;
    document.getElementById('slip_lOwner').value = "";
    document.getElementById('slip_oMob').value = "";
    document.getElementById('slip_dName').value = "";
    document.getElementById('slip_dMob').value = "";
    document.getElementById('slip_licence').value = "";
    document.getElementById('slip_rowNum').value = ""; // Nayi entry ke liye row number khali
    
    calculateSlip();
}

// --- DRIVE SE SLIPS LOAD KARNA ---
async function loadSlipHistory() {
    const container = document.getElementById('slipHistoryList');
    if (!container) return;
    
    // Yahan text change kiya gaya hai
    container.innerHTML = '<div class="text-center w-100 p-4"><div class="spinner-border text-danger spinner-border-sm"></div> Fetching Loading Slips...</div>';
    
    try {
        const response = await fetch(scriptURL + "?action=listSlips");
        const slips = await response.json();
        
        container.innerHTML = ""; 

        if (!slips || slips.length === 0) {
            container.innerHTML = '<div class="text-center w-100 p-5 text-muted">No Loading Slips found.</div>';
            return;
        }

        slips.forEach(slip => {
            container.insertAdjacentHTML('beforeend', `
                <div class="col-12 col-md-6 mb-2">
                    <div class="card shadow-sm border-0" style="border-radius:12px; border-left: 5px solid #dc3545;">
                        <div class="card-body p-2 px-3">
                            <div class="d-flex justify-content-between align-items-center">
                                <div class="text-truncate" style="max-width: 65%;">
                                    <h6 class="fw-bold mb-0" style="font-size:13px;">${slip.name}</h6>
                                    <small class="text-muted" style="font-size:10px;">${slip.date}</small>
                                </div>
                                <div class="d-flex gap-2">
                                    <a href="${slip.url}" target="_blank" class="btn btn-sm btn-light text-danger"><i class="bi bi-file-pdf"></i></a>
                                    <button class="btn btn-sm btn-success" onclick="shareFileFromDrive('${slip.id}', '${slip.name}')"><i class="bi bi-whatsapp"></i></button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>`);
        });
    } catch (e) {
        container.innerHTML = '<div class="alert alert-danger">Archive load failed.</div>';
    }
}

// --- DRIVE SE ASLI PDF FILE SHARE KARNA ---
// --- DRIVE SE PDF SHARE/DOWNLOAD KARNA (PRO VERSION) ---
async function shareFileFromDrive(fileId, fileName) {
    const originalBtn = event.currentTarget;
    const originalHtml = originalBtn.innerHTML;
    
    // UI Feedback: Loading dikhayein
    originalBtn.disabled = true;
    originalBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

    try {
        // 1. Google Script se File Content mangwayein
        const response = await fetch(scriptURL + `?action=getFileContent&fileId=${fileId}`);
        if (!response.ok) throw new Error("Server response error");
        
        const base64Data = await response.text();
        if(!base64Data || base64Data.length < 100) throw new Error("Empty file data");

        // 2. Base64 ko Blob mein convert karein
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);

        // 3. File Object banayein (Share ke liye)
        const file = new File([blob], `${fileName}.pdf`, { type: 'application/pdf' });

        // 4. Try SHARE (Mobile Share Menu)
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                files: [file],
                title: 'ATC Loading Slip',
                text: 'Vehicle: ' + fileName
            });
        } 
        else {
            // 5. FALLBACK: Direct Download (Agar share support nahi hai)
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = `${fileName}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            alert("Share system block hai. File DOWNLOAD ho gayi hai, ab aap bhej sakte hain.");
        }
    } catch (err) {
        console.error("Error:", err);
        alert("File load nahi ho saki. Internet check karein ya manual download karein.");
    } finally {
        originalBtn.disabled = false;
        originalBtn.innerHTML = originalHtml;
    }
}

// PDF View karne ke liye
function viewSlip(id) {
    const transaction = db.transaction(["slips"], "readonly");
    const store = transaction.objectStore("slips");
    store.get(id).onsuccess = (e) => {
        const fileURL = URL.createObjectURL(e.target.result.pdfBlob);
        window.open(fileURL, '_blank');
    };
}

// ASLI PDF FILE WHATSAPP PAR BHEJNA (Native Share)
async function shareActualFile(id) {
    const transaction = db.transaction(["slips"], "readonly");
    const store = transaction.objectStore("slips");
    
    store.get(id).onsuccess = async (e) => {
        const slip = e.target.result;
        const file = new File([slip.pdfBlob], `Slip_${slip.vNo}.pdf`, { type: 'application/pdf' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({
                    files: [file],
                    title: 'ATC Loading Slip',
                    text: `Loading Slip for Vehicle: ${slip.vNo}`
                });
            } catch (err) { console.error("Share failed", err); }
        } else {
            alert("Your browser does not support direct file sharing. Please 'View' and then download/share.");
        }
    };
}

// --- GAADI MASTER: VEHICLE LIST LOAD KARNA ---
async function loadVehicles() {
    const container = document.getElementById('vehicleCardsContainer');
    if(!container) return;

    container.innerHTML = '<div class="text-center p-5"><div class="spinner-border text-primary spinner-border-sm"></div><br>Checking Documents...</div>';
    
    try {
        // 1. Gaadiyon ki list aur Uploaded list dono ek saath mangwayein
        const [resVehicles, resUploaded] = await Promise.all([
            fetch(scriptURL + "?action=getVehicles"),
            fetch(scriptURL + "?action=getUploadedList")
        ]);

        const allVehicles = await resVehicles.json();
        const uploadedList = await resUploaded.json();

        // 2. Counters Calculate karein
        let done = 0;
        let pending = 0;
        container.innerHTML = '';

        allVehicles.forEach((vNo) => {
            const safeId = vNo.replace(/\s+/g, '_'); 
            const isUploaded = uploadedList.includes(vNo); // Check if uploaded
            
            if(isUploaded) done++; else pending++;

            // 3. Gaadi Number par Mark lagayein
            const statusMark = isUploaded 
                ? '<span class="badge bg-success-subtle text-success ms-2" style="font-size:10px;"><i class="bi bi-check-circle-fill"></i> RC OK</span>' 
                : '<span class="badge bg-danger-subtle text-danger ms-2" style="font-size:10px;"><i class="bi bi-exclamation-circle"></i> NO RC</span>';

            container.insertAdjacentHTML('beforeend', `
                <div class="v-list-item shadow-sm mb-3" style="background: white; border-radius: 12px; border-left: 5px solid ${isUploaded ? '#28a745' : '#dc3545'}; overflow: hidden;">
                    <div class="v-item-header p-3 d-flex justify-content-between align-items-center" onclick="toggleDetails('details_${safeId}', '${safeAttr(vNo)}')" style="cursor:pointer;">
                        <div>
                            <span class="fw-bold" style="color: #003366;"><i class="bi bi-truck me-1"></i> ${vNo}</span>
                            ${statusMark}
                        </div>
                        <i class="bi bi-chevron-down text-muted"></i>
                    </div>
                    
                    <div id="details_${safeId}" class="v-item-details hidden p-3 border-top bg-light">
                        <div id="stats_${safeId}" class="row g-2 mb-3 mt-1 text-center small text-muted">Calculating...</div>
                        <div class="d-flex gap-2 mb-3">
                            <button class="btn btn-sm btn-primary w-50" onclick="triggerUpload('${safeAttr(vNo)}')">Update RC</button>
                            <input type="file" id="file_${vNo}" class="hidden" onchange="uploadFile(this, '${safeAttr(vNo)}')">
                            <button class="btn btn-sm btn-outline-info w-50" onclick="fetchVehicleDocs('${safeAttr(vNo)}')">Docs</button>
                        </div>
                        <div id="docList_${safeId}" class="mb-3"></div>
                        <h6 class="fw-bold small border-bottom pb-1">History</h6>
                        <div id="historyList_${safeId}" class="history-container small text-muted">Loading...</div>
                    </div>
                </div>
            `);
        });

        // Counters Update karein
        document.getElementById('count-done').innerText = done;
        document.getElementById('count-pending').innerText = pending;

    } catch (e) { 
        container.innerHTML = '<div class="text-center p-3 text-danger">Error: Sheet "Vehicle_Docs" check karein ya Deploy firse karein.</div>'; 
    }
}

// Toggle logic (Simple & Auto-load)
function toggleDetails(id, vNo) {
    const el = document.getElementById(id);
    if(el.classList.contains('hidden')) {
        el.classList.remove('hidden');
        // Click karte hi apne aap load hoga
        fetchVehicleDocs(vNo);
        fetchVehicleHistory(vNo);
    } else {
        el.classList.add('hidden');
    }
}

// Data ko onclick="...('...')" ke andar surakshit tarike se daalne ke liye
// (agar naam mein ' ya " ho toh ye HTML/JS ko tootne se bachata hai)
function safeAttr(val) {
    return String(val == null ? "" : val)
        .replace(/&/g, "&amp;")
        .replace(/'/g, "&#39;")
        .replace(/"/g, "&quot;");
}

function formatINR(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(amount);
}

// --- PRO CORPORATE LEDGER PDF GENERATOR ---
// NOTE: Pehle ye html2canvas se ek off-screen <div> ka "screenshot" leta tha.
// Off-screen (document mein append hi nahi kiya gaya) element ka height/layout
// browser sahi se calculate nahi kar pata, isi wajah se PDF slices mein toot raha tha
// / khali jagah aa rahi thi. Ab hum jsPDF + autoTable use kar rahe hain jo seedha
// vector text/lines draw karta hai (koi screenshot nahi) — is wajah se ye hamesha
// crisp, chhota size (sirf text hai, image nahi), aur multi-page par bhi header
// harr page par sahi se repeat hota hai.
async function generateLedgerPDF(isShare = false) {
    if (!currentLedgerParty || currentLedgerEntries.length === 0) {
        alert("Statement khali hai!"); return;
    }
    if (!window.jspdf || !window.jspdf.jsPDF) {
        alert("PDF library load nahi ho payi. Internet connection check karein aur page refresh karein.");
        return;
    }

    const filterResult = getLedgerPdfFilteredEntries();
    if (!filterResult) return; // invalid filter selection, alert already shown
    const { entries: filteredEntries, label: periodLabel, openingBalance, showOpening } = filterResult;
    if (filteredEntries.length === 0) {
        alert(`Selected period (${periodLabel}) mein is party ki koi entry nahi hai.`);
        return;
    }

    const trigerBtn = isShare
        ? document.querySelector('#ledgerViewArea .btn-outline-success')
        : document.querySelector('#ledgerViewArea .btn-outline-danger');
    const originalBtnHtml = trigerBtn ? trigerBtn.innerHTML : null;
    if (trigerBtn) {
        trigerBtn.disabled = true;
        trigerBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Generating...';
    }

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
        const pageWidth = doc.internal.pageSize.getWidth();   // 210
        const pageHeight = doc.internal.pageSize.getHeight(); // 297
        const marginX = 14;

        const COLORS = {
            navy: [0, 35, 71],
            gold: [179, 139, 0],
            gray: [100, 116, 139],
            lightGray: [148, 163, 184],
            border: [203, 213, 225],
            panel: [248, 250, 252],
            panel2: [241, 245, 249],
            red: [183, 28, 28],
            green: [27, 94, 32],
            black: [15, 23, 42]
        };

        // ---- Totals (computed once, then re-used for header + table + footer) ----
        // NOTE: jsPDF ke built-in fonts (helvetica/times/courier) mein ₹ ka glyph
        // exist nahi karta, isliye wo garbled character banke print ho raha tha.
        // "Rs." prefix use kar rahe hain — ye har PDF viewer/printer mein sahi dikhega.
        let totalDebit = 0, totalCredit = 0, runningBal = showOpening ? openingBalance : 0;
        const bodyRows = [];
        const balanceSigns = []; // aligned 1:1 with bodyRows, for coloring the Balance column

        if (showOpening) {
            bodyRows.push(['', '', '', 'OPENING BALANCE B/F', '-', '-', formatMoneyForPdf(Math.abs(openingBalance))]);
            balanceSigns.push(openingBalance);
        }

        filteredEntries.forEach((row, idx) => {
            const debit = parseFloat(row.debit) || 0;
            const credit = parseFloat(row.credit) || 0;
            totalDebit += debit;
            totalCredit += credit;
            runningBal += (debit - credit);
            balanceSigns.push(runningBal);
            bodyRows.push([
                idx + 1,
                formatLedgerDateForPdf(row.date),
                row.vNo || 'GENERAL',
                row.description || '-',
                debit ? formatMoneyForPdf(debit) : '-',
                credit ? formatMoneyForPdf(credit) : '-',
                formatMoneyForPdf(Math.abs(runningBal))
            ]);
        });

        const netBalance = runningBal; // closing balance = opening (if any) + period debits - period credits
        const netStatus = netBalance > 0 ? "RECEIVABLE" : netBalance < 0 ? "PAYABLE" : "CLEAR";
        const netColor = netBalance > 0 ? COLORS.red : (netBalance < 0 ? COLORS.green : COLORS.navy);
        const netFillColor = netBalance > 0 ? [253, 235, 235] : (netBalance < 0 ? [232, 245, 233] : COLORS.panel2);

        // ---- Try to load the company logo (skipped silently if not reachable) ----
        let logoImg = null;
        try {
            logoImg = await loadImageForPdf('Images/ATC_Logo.png');
        } catch (e) { /* no logo, that's fine */ }

        // ================= HEADER (drawn once; repeated per page in didDrawPage) =================
        function drawHeader() {
            if (logoImg) {
                try { doc.addImage(logoImg, 'PNG', marginX, 10, 18, 18); } catch (e) {}
            }
            const textX = logoImg ? marginX + 22 : marginX;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(16);
            doc.setTextColor(...COLORS.navy);
            doc.text('ATC ALLINDIA TRANSPORT', textX, 17);

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(...COLORS.gold);
            doc.text('VEGETABLE SUPPLIERS & COMMISSION AGENT', textX, 22);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(...COLORS.gray);
            doc.text('Solapur-Dhule Road, Aurangabad (MH) 431002  |  9673732113', textX, 27);

            // Statement date box (top-right)
            const boxW = 46, boxH = 16, boxX = pageWidth - marginX - boxW, boxY = 9;
            doc.setFillColor(...COLORS.panel);
            doc.setDrawColor(...COLORS.border);
            doc.roundedRect(boxX, boxY, boxW, boxH, 1.5, 1.5, 'FD');
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(...COLORS.gray);
            doc.text('STATEMENT DATE', boxX + boxW / 2, boxY + 6, { align: 'center' });
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(...COLORS.navy);
            doc.text(new Date().toLocaleDateString('en-GB'), boxX + boxW / 2, boxY + 12.5, { align: 'center' });

            doc.setDrawColor(...COLORS.navy);
            doc.setLineWidth(0.8);
            doc.line(marginX, 32, pageWidth - marginX, 32);
        }

        drawHeader();

        // ================= PARTY + NET BALANCE SUMMARY (first page only) =================
        const panelY = 37, panelH = 22, panelW = pageWidth - marginX * 2;
        doc.setFillColor(...COLORS.panel);
        doc.setDrawColor(...COLORS.border);
        doc.roundedRect(marginX, panelY, panelW, panelH, 2, 2, 'FD');

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...COLORS.gray);
        doc.text('PARTY ACCOUNT', marginX + 6, panelY + 8);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(...COLORS.black);
        doc.text(String(currentLedgerParty), marginX + 6, panelY + 16);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...COLORS.gray);
        doc.text(`${filteredEntries.length} Entries  |  Period: ${periodLabel}`, marginX + 6, panelY + 20);

        const rightEdge = pageWidth - marginX - 6;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...COLORS.gray);
        doc.text('NET BALANCE', rightEdge, panelY + 7, { align: 'right' });
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(15);
        doc.setTextColor(...netColor);
        doc.text(formatMoneyForPdf(Math.abs(netBalance)), rightEdge, panelY + 14, { align: 'right' });

        // Status badge (rounded pill instead of plain text)
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        const badgeW = doc.getTextWidth(netStatus) + 8;
        const badgeH = 5.5, badgeX = rightEdge - badgeW, badgeY = panelY + 16.5;
        doc.setFillColor(...netFillColor);
        doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 2.5, 2.5, 'F');
        doc.setTextColor(...netColor);
        doc.text(netStatus, rightEdge - badgeW / 2, badgeY + 3.8, { align: 'center' });

        // ================= TABLE =================
        doc.autoTable({
            startY: panelY + panelH + 6,
            margin: { left: marginX, right: marginX, top: 34 },
            head: [['#', 'DATE', 'VEHICLE NO', 'DESCRIPTION', 'DEBIT (Dr)', 'CREDIT (Cr)', 'BALANCE']],
            body: bodyRows,
            foot: [[
                '', '', '', 'TOTAL:',
                formatMoneyForPdf(totalDebit),
                formatMoneyForPdf(totalCredit),
                formatMoneyForPdf(Math.abs(netBalance))
            ]],
            styles: {
                font: 'helvetica',
                fontSize: 8.5,
                cellPadding: 2.2,
                lineColor: COLORS.border,
                lineWidth: 0.1,
                textColor: COLORS.black,
                valign: 'middle'
            },
            headStyles: {
                fillColor: COLORS.navy,
                textColor: 255,
                fontStyle: 'bold',
                halign: 'center'
            },
            footStyles: {
                fillColor: COLORS.panel2,
                textColor: COLORS.black,
                fontStyle: 'bold'
            },
            alternateRowStyles: { fillColor: [252, 253, 254] },
            columnStyles: {
                0: { cellWidth: 9, halign: 'center' },
                1: { cellWidth: 20 },
                2: { cellWidth: 26 },
                3: { cellWidth: 'auto' },
                4: { cellWidth: 24, halign: 'right' },
                5: { cellWidth: 24, halign: 'right' },
                6: { cellWidth: 26, halign: 'right', fontStyle: 'bold' }
            },
            didParseCell: function (data) {
                const isOpeningRow = data.section === 'body' && data.row.raw[3] === 'OPENING BALANCE B/F';
                if (isOpeningRow) {
                    data.cell.styles.fillColor = COLORS.panel2;
                    data.cell.styles.fontStyle = 'bold';
                    if (data.column.index === 6) {
                        data.cell.styles.textColor = balanceSigns[data.row.index] > 0 ? COLORS.red : (balanceSigns[data.row.index] < 0 ? COLORS.green : COLORS.gray);
                    }
                    return;
                }
                if (data.section === 'body') {
                    if (data.column.index === 4 && data.cell.raw !== '-') data.cell.styles.textColor = COLORS.red;
                    if (data.column.index === 5 && data.cell.raw !== '-') data.cell.styles.textColor = COLORS.green;
                    if (data.column.index === 6) {
                        const bal = balanceSigns[data.row.index];
                        data.cell.styles.textColor = bal > 0 ? COLORS.red : (bal < 0 ? COLORS.green : COLORS.gray);
                    }
                }
                if (data.section === 'foot') {
                    if (data.column.index === 4) data.cell.styles.textColor = COLORS.red;
                    if (data.column.index === 5) data.cell.styles.textColor = COLORS.green;
                    if (data.column.index === 6) data.cell.styles.textColor = netColor;
                }
            },
            didDrawPage: function (data) {
                if (data.pageNumber > 1) drawHeader();
                // Footer: page numbers on every page
                doc.setDrawColor(...COLORS.border);
                doc.setLineWidth(0.2);
                doc.line(marginX, pageHeight - 13, pageWidth - marginX, pageHeight - 13);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7.5);
                doc.setTextColor(...COLORS.lightGray);
                doc.text(
                    `ATC ALLINDIA TRANSPORT — Party Statement (${periodLabel})`,
                    marginX, pageHeight - 8
                );
                doc.text(
                    `Page ${data.pageNumber} of {total_pages_count_string}`,
                    pageWidth - marginX, pageHeight - 8, { align: 'right' }
                );
            }
        });

        // "Page X of Y" ke Y ko sahi total page count se replace karta hai
        // (autoTable ko generate karte waqt total pages pata nahi hoti).
        if (typeof doc.putTotalPages === 'function') {
            doc.putTotalPages('{total_pages_count_string}');
        }

        // ================= SIGNATURE + DISCLAIMER (after table, on last page) =================
        let finalY = doc.lastAutoTable.finalY + 8;
        if (finalY > pageHeight - 48) { doc.addPage(); drawHeader(); finalY = 40; }

        // Amount in words (professional statement touch)
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(...COLORS.gray);
        doc.text('AMOUNT IN WORDS:', marginX, finalY);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(...COLORS.black);
        const wordsText = `Rupees ${numberToWordsIndian(Math.abs(netBalance))} Only (${netStatus.split(' ')[0]})`;
        const wrappedWords = doc.splitTextToSize(wordsText, pageWidth - marginX * 2);
        doc.text(wrappedWords, marginX, finalY + 5);
        finalY += 5 + wrappedWords.length * 4.2 + 8;

        doc.setDrawColor(...COLORS.navy);
        doc.setLineWidth(0.3);
        doc.line(pageWidth - marginX - 60, finalY + 8, pageWidth - marginX, finalY + 8);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(...COLORS.navy);
        doc.text('For, ATC ALLINDIA TRANSPORT', pageWidth - marginX, finalY + 13, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...COLORS.gray);
        doc.text('Authorised Signatory', pageWidth - marginX, finalY + 17, { align: 'right' });

        // Professional closing block: disclaimer + thank-you note, centered like a real bill
        const discY = finalY + 26;
        doc.setDrawColor(...COLORS.border);
        doc.setLineWidth(0.2);
        doc.line(marginX, discY - 5, pageWidth - marginX, discY - 5);
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7.5);
        doc.setTextColor(...COLORS.lightGray);
        doc.text('This is a computer-generated statement and does not require a physical signature.', pageWidth / 2, discY, { align: 'center' });
        doc.text('For any discrepancy in the above statement, please contact us within 7 days of receipt.', pageWidth / 2, discY + 4, { align: 'center' });
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(...COLORS.navy);
        doc.text('Thank you for your business with ATC AllIndia Transport', pageWidth / 2, discY + 10, { align: 'center' });

        // ================= SAVE / SHARE =================
        const fileName = `Ledger_${currentLedgerParty}.pdf`;
        if (isShare) {
            const pdfBlob = doc.output('blob');
            const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title: 'ATC Ledger Statement' });
            } else {
                doc.save(fileName);
            }
        } else {
            doc.save(fileName);
        }
    } catch (err) {
        console.error(err);
        alert("PDF banane mein error aayi: " + err.message);
    } finally {
        if (trigerBtn) {
            trigerBtn.disabled = false;
            trigerBtn.innerHTML = originalBtnHtml;
        }
    }
}

// PDF ke andar amount hamesha "Rs. 1,80,010" jaise ASCII format mein dikhega
// (₹ glyph jsPDF ke standard fonts mein missing hone ki wajah se garbled aa raha tha).
function formatMoneyForPdf(amount) {
    const n = Number(amount) || 0;
    return 'Rs. ' + n.toLocaleString('en-IN');
}

// Sheet se date kabhi "14-05-2026" (text) aata hai, kabhi Google Sheets ke Date
// cell se ISO string ("2026-07-04T18:30:00.000Z") ban ke aata hai. Ye function
// dono cases ko sahi se "dd-mm-yyyy" mein normalize karta hai.
function formatLedgerDateForPdf(val) {
    if (!val) return '-';
    const str = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
        const d = new Date(str);
        if (!isNaN(d.getTime())) {
            const dd = String(d.getUTCDate()).padStart(2, '0');
            const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
            const yyyy = d.getUTCFullYear();
            return `${dd}-${mm}-${yyyy}`;
        }
    }
    if (/^\d{1,2}[-\/]\d{1,2}[-\/]\d{4}$/.test(str)) return str.replace(/\//g, '-');
    return str; // fallback: jo bhi text hai wahi dikha do
}

// Indian numbering system (Crore/Lakh/Thousand) mein number ko words mein convert karta hai.
// Statement ke neeche "Amount in Words" line ke liye use hota hai.
function numberToWordsIndian(num) {
    num = Math.floor(Number(num) || 0);
    if (num === 0) return 'Zero';
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
        'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    function twoDigits(n) {
        if (n < 20) return ones[n];
        return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    }
    function threeDigits(n) {
        let str = '';
        if (n >= 100) { str += ones[Math.floor(n / 100)] + ' Hundred'; n %= 100; if (n) str += ' '; }
        if (n) str += twoDigits(n);
        return str;
    }
    const crore = Math.floor(num / 10000000); num %= 10000000;
    const lakh = Math.floor(num / 100000); num %= 100000;
    const thousand = Math.floor(num / 1000); num %= 1000;
    const rest = num;
    const parts = [];
    if (crore) parts.push(threeDigits(crore) + ' Crore');
    if (lakh) parts.push(threeDigits(lakh) + ' Lakh');
    if (thousand) parts.push(threeDigits(thousand) + ' Thousand');
    if (rest) parts.push(threeDigits(rest));
    return parts.join(' ') || 'Zero';
}

// Logo (ya koi bhi image) ko jsPDF ke addImage() ke liye load karta hai.
// Fails silently agar file exist nahi karti — PDF logo ke bina bhi ban jaayega.
function loadImageForPdf(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
    });
}