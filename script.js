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
    
    // --- YE DO LINES ZAROORI HAIN ---
    if(id === 'loading-slip') { loadVehicleListForSlip(); initWizard(); }
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
                container.insertAdjacentHTML('beforeend', `
                    <div class="recent-item shadow-sm">
                        <div>
                            <div class="fw-bold" style="font-size:14px;">${trip['Vehicle No']}</div>
                            <small class="text-muted">${trip['From']} ➔ ${trip['To']}</small>
                        </div>
                        <div class="text-end">
                            <div class="text-primary fw-bold">₹${Number(amt).toLocaleString('en-IN')}</div>
                            <small style="font-size: 10px;">${trip['Date']}</small>
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


// ✅ WhatsApp Share - FIXED VERSION (Proper Phone Number Validation)
async function shareTrip(phone, vNo, from, to, party, amt, date, material, weight) {
    // 1️⃣ Phone number को properly format करो
    let rawPhone = String(phone || "").trim();
    
    // Step-by-step cleaning करो
    let cleanPhone = rawPhone
        .replace(/^[\+]/g, '')              // + को हटाओ
        .replace(/^00/, '')                 // 00 को हटाओ (0091 case)
        .replace(/^0(?=\d{10})/, '')        // Leading 0 को हटाओ (10 digits के case में)
        .replace(/[\s\-\(\)]/g, '')         // Spaces, dashes, brackets हटाओ
        .replace(/\D/g, '');                // बाकी सब non-digits हटाओ
    
    // Country code add करो (अगर नहीं है)
    if (cleanPhone.length === 10) {
        cleanPhone = '91' + cleanPhone;     // India के लिए
    } else if (cleanPhone.length > 13 || cleanPhone.length < 10) {
        alert(`❌ Invalid phone number: "${rawPhone}"\n\nPlease use format like:\n• 9876543210\n• +919876543210\n• 91-9876543210`);\n        return;\n    }
    
    let last10Digits = cleanPhone.slice(-10);  // matching के लिए last 10 digits लो

    // 2️⃣ History Calculation with Destinations (From/To)
    let historyList = "";\n    let oldPendingAmt = 0;
    let pendingTripsCount = 0;

    if (allTripsData && allTripsData.length > 0) {
        allTripsData.forEach(t => {
            // Driver और Owner दोनों के numbers को properly clean करो
            let tPhoneD = String(t['Driver No'] || "")
                .replace(/[\s\-\(\)]/g, '')
                .replace(/^0(?=\d{10})/, '')
                .replace(/\D/g, '')
                .slice(-10);
            
            let tPhoneO = String(t['_owner'] || "")
                .replace(/[\s\-\(\)]/g, '')
                .replace(/^0(?=\d{10})/, '')
                .replace(/\D/g, '')
                .slice(-10);
            
            let isCollected = (String(t['_colG'] || "").toLowerCase().trim() === "yes");

            // Agar number match kare aur payment pending ho
            if ((tPhoneD === last10Digits || tPhoneO === last10Digits) && !isCollected) {
                // Check करो कि ye current trip तो नहीं है
                if (!(t['Vehicle No'] === vNo && t['Date'] === date)) {
                    let v = String(t['Vehicle No']).replace(/&/g, "and");
                    let f = String(t['From'] || "N/A").replace(/&/g, "and");
                    let rt = String(t['To'] || "N/A").replace(/&/g, "and");
                    let a = parseFloat(t['Amount'] || 0);
                    let dt = t['Date'] || "No Date";

                    // Designing each old trip entry
                    historyList += `▪️ *${v}* (${dt})\n`;
                    historyList += `   📍 ${f} ➔ ${rt}\n`;
                    historyList += `   💰 Fare: ₹${a}\n\n`;

                    oldPendingAmt += a;
                    pendingTripsCount++;
                }
            }
        });
    }

    let currentAmt = parseFloat(amt || 0);
    let totalOutstanding = currentAmt + oldPendingAmt;

    // 3️⃣ Message Body Design
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

    // 4️⃣ Proper Encoding (Taki message na kate)
    let encodedMsg = encodeURIComponent(messageBody);
    
    // 5️⃣ WhatsApp URL - अब cleanPhone पूरी तरह से सही format में है (91 के साथ)
    let whatsappURL = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMsg}`;

    // 6️⃣ Open WhatsApp
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
    const files = Array.from(input.files || []);
    if (!files.length) return;
    const btn = input.closest('.v-item-details').querySelector('.btn-primary');
    uploadFilesDirect(files, vNo, btn);
    input.value = ''; // reset, taaki agli baar same file dubara select ho sake
}

// Drag & Drop se files drop hone par ye chalta hai
function handleFileDrop(e, vNo) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files || []);
    if (!files.length) return;
    const btn = e.currentTarget.closest('.v-item-details').querySelector('.btn-primary');
    uploadFilesDirect(files, vNo, btn);
}

// Ek se zyada files ho to unhe ek-ek karke (sequentially) upload karta hai
async function uploadFilesDirect(files, vNo, btn) {
    const originalText = btn ? btn.innerHTML : '';
    let success = 0, failed = 0;

    for (let i = 0; i < files.length; i++) {
        if (btn) {
            btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> UPLOADING ${i + 1}/${files.length}...`;
            btn.disabled = true;
        }
        try {
            await uploadSingleFile(files[i], vNo);
            success++;
        } catch (e) {
            failed++;
        }
    }

    if (btn) {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }

    alert(failed === 0
        ? `✅ ${success} Document(s) Uploaded Successfully!`
        : `⚠️ ${success} Uploaded, ${failed} Failed. Check connection and retry failed ones.`);

    fetchVehicleDocs(vNo); // Refresh the list
    loadVehicles(); // RC OK/NO RC badge aur sorting refresh ho jaye
}

// Ek single file ko base64 karke server par bhejta hai (Promise wrap)
function uploadSingleFile(file, vNo) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async function() {
            const base64 = reader.result.split(',')[1];
            const payload = {
                action: "uploadDocument",
                vNo: vNo,
                fileName: file.name,
                base64: base64,
                mimeType: file.type
            };
            try {
                await fetch(scriptURL, { method: 'POST', body: JSON.stringify(payload) });
                resolve();
            } catch (e) { reject(e); }
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
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

    await refreshLedgerTable();
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
    let overWeightEl = document.getElementById('slip_overWeight');
    let overWeight = overWeightEl ? (parseFloat(overWeightEl.value) || 0) : 0;  // Extra/overload tons
    let overRateEl = document.getElementById('slip_overRate');
    let overRateInput = overRateEl ? (parseFloat(overRateEl.value) || 0) : 0;   // Overload ka apna rate (agar diya ho)
    let effectiveOverRate = overRateInput > 0 ? overRateInput : rate; // Warna normal Rate hi use hoga

    // Freight = Rate * Weight (Tons)
    let freight_total = Math.round(weight * rate);
    
    // Agar Rate aur Weight dala hai, toh Freight auto-fill karein
    if(rate > 0 && weight > 0) {
        document.getElementById('slip_freight').value = freight_total;
    }

    // Overloading charge: apna (O.Rate) hai to usi se, warna normal Rate se calculate hoga
    if(effectiveOverRate > 0 && overWeight > 0) {
        document.getElementById('slip_overCharge').value = Math.round(overWeight * effectiveOverRate);
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
    let overCharge = parseFloat(document.getElementById('slip_overCharge').value) || 0;
    let adv = parseFloat(document.getElementById('slip_advance').value) || 0;
    let dPrice = parseFloat(document.getElementById('slip_dPrice').value) || 0;

    // Net Payable = Freight + Overloading Charge - Advance + Driver Price
    let toPay = (freight + overCharge - adv) + dPrice;

    document.getElementById('slip_toPay').value = Math.round(toPay);
}

// ================= BEELTY MOBILE WIZARD (Step-by-Step Fill) =================
let currentWizardStep = 1;
const WIZARD_TOTAL_INPUT_STEPS = 5; // 5 input steps + 1 review step
const WIZARD_TITLES = ["Vehicle & Date", "Party Details", "Route & Owner", "Driver Details", "Finance & Total"];

function initWizard() {
    const receipt = document.getElementById('receipt-to-print');
    if (!receipt) return;
    receipt.classList.add('wizard-mode');
    document.getElementById('wizardNavBar').style.display = 'block';
    currentWizardStep = 1;
    renderWizardStep();
}

function renderWizardStep() {
    const allSteps = document.querySelectorAll('[data-wizard-step]');
    allSteps.forEach(el => el.classList.remove('wizard-active'));

    const isReview = currentWizardStep > WIZARD_TOTAL_INPUT_STEPS;

    if (isReview) {
        allSteps.forEach(el => el.classList.add('wizard-active'));
        document.getElementById('receipt-to-print').classList.remove('wizard-mode'); // sab dikhao, full preview
        document.getElementById('wizardStepLabel').innerText = "Review — Print Se Pehle Check Karein";
    } else {
        document.getElementById('receipt-to-print').classList.add('wizard-mode');
        document.querySelectorAll(`[data-wizard-step="${currentWizardStep}"]`).forEach(el => el.classList.add('wizard-active'));
        document.getElementById('wizardStepLabel').innerText = `Step ${currentWizardStep} of ${WIZARD_TOTAL_INPUT_STEPS}: ${WIZARD_TITLES[currentWizardStep - 1]}`;
    }

    document.getElementById('wizardBackBtn').disabled = (currentWizardStep === 1);
    document.getElementById('wizardNextBtn').style.display = isReview ? 'none' : 'block';
    document.getElementById('wizardNextBtn').innerText = (currentWizardStep === WIZARD_TOTAL_INPUT_STEPS) ? 'Preview ➜' : 'Next ➜';
    document.getElementById('slipSubmitBtn').style.display = isReview ? 'block' : 'none';

    document.getElementById('receipt-to-print').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function wizardNext() {
    if (currentWizardStep <= WIZARD_TOTAL_INPUT_STEPS + 1) currentWizardStep++;
    renderWizardStep();
}

function wizardBack() {
    if (currentWizardStep > 1) currentWizardStep--;
    renderWizardStep();
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

    // Wizard ke saare steps PDF capture se pehle dikhne chahiye (chahe abhi kisi step par ruke ho)
    element.classList.remove('wizard-mode');
    document.querySelectorAll('[data-wizard-step]').forEach(el => el.classList.add('wizard-active'));

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
            archiveRow: document.getElementById('slip_archiveRow').value,
            vNo: vNo.toUpperCase(),
            date: document.getElementById('slip_date').value || "NoDate",
            pdfBase64: pdfBase64,
            partyName: document.getElementById('slip_party').value.toUpperCase(),
            from: document.getElementById('slip_from').value.toUpperCase(),
            to: document.getElementById('slip_to').value.toUpperCase(),
            rate: document.getElementById('slip_rate').value,
            weight: document.getElementById('slip_weight').value,
            overWeight: document.getElementById('slip_overWeight').value,
            overRate: document.getElementById('slip_overRate').value,
            overCharge: document.getElementById('slip_overCharge').value,
            advance: document.getElementById('slip_advance').value,
            driverPrice: document.getElementById('slip_dPrice').value,
            toPay: document.getElementById('slip_toPay').value,
            lorryOwner: document.getElementById('slip_lOwner').value.toUpperCase(),
            ownerVillage: document.getElementById('slip_oVillage').value.toUpperCase(),
            ownerMob: document.getElementById('slip_oMob').value.toUpperCase(),
            driverName: document.getElementById('slip_dName').value.toUpperCase(),
            driverVillage: document.getElementById('slip_dVillage').value.toUpperCase(),
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
        'slip_rate', 'slip_weight', 'slip_overWeight', 'slip_overRate', 'slip_overCharge', 'slip_advance', 'slip_dPrice',
        'slip_lOwner', 'slip_oVillage', 'slip_oMob', 'slip_dName', 'slip_dVillage', 'slip_dMob', 
        'slip_licence', 'slip_toPay', 'slip_rowNum', 'slip_archiveRow'
    ];
    
    slipInputs.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = (id.includes('rate') || id.includes('weight') || id.includes('Weight') || id.includes('Charge') || id.includes('advance') || id.includes('Price') || id.includes('Pay')) ? 0 : "";
    });

    // Wizard ko wapas Step 1 par le jayein agli entry ke liye
    initWizard();
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
            autoFillOwnerDriver(vNo); // Village/Licence jaisi details jo trip record me nahi hoti, wo profile se bhar do
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
    autoFillOwnerDriver(vNo); // Purani Owner/Driver details (agar pehle kabhi bhari thi) khud bhar do
}

// --- 1-TAP AUTO-FILL: Owner/Driver details jo pichli baar is gaadi ke liye save hui thi ---
async function autoFillOwnerDriver(vNo) {
    vNo = (vNo || "").toUpperCase().trim();
    if (!vNo) return;
    try {
        const res = await fetch(scriptURL + `?action=getVehicleProfile&vNo=${encodeURIComponent(vNo)}`);
        const profile = await res.json();
        if (!profile || Object.keys(profile).length === 0) return; // Pehli baar hai gaadi, kuch nahi milega

        if (profile.lOwner) document.getElementById('slip_lOwner').value = profile.lOwner;
        if (profile.oVillage) document.getElementById('slip_oVillage').value = profile.oVillage;
        if (profile.oMob) document.getElementById('slip_oMob').value = profile.oMob;
        if (profile.dName) document.getElementById('slip_dName').value = profile.dName;
        if (profile.dVillage) document.getElementById('slip_dVillage').value = profile.dVillage;
        if (profile.dMob) document.getElementById('slip_dMob').value = profile.dMob;
        if (profile.licence) document.getElementById('slip_licence').value = profile.licence;
    } catch (e) {
        console.error("Auto-fill failed:", e);
    }
}

// --- PURANI SAVED BEELTY EDIT KARNA (Mistake fix karne ke liye) ---
function editSavedSlip(rowNumber) {
    const slip = currentSlipHistory.find(s => s.rowNumber === rowNumber);
    if (!slip || !slip.formData) {
        alert("Ye slip purani hai — isme edit ke liye zaroori data save nahi hai. Naya Loading Slip bana lein.");
        return;
    }

    let d;
    try { d = JSON.parse(slip.formData); } catch (e) {
        alert("Data padhne mein error aayi. Dubara try karein.");
        return;
    }

    showSection('loading-slip');

    // Sab fields wapas bhar do
    document.getElementById('slip_vNo').value = d.vNo || "";
    document.getElementById('slip_date').value = d.date || "";
    document.getElementById('slip_party').value = d.partyName || "";
    document.getElementById('slip_from').value = d.from || "";
    document.getElementById('slip_to').value = d.to || "";
    document.getElementById('slip_rate').value = d.rate || 0;
    document.getElementById('slip_weight').value = d.weight || 0;
    document.getElementById('slip_overWeight').value = d.overWeight || 0;
    document.getElementById('slip_overRate').value = d.overRate || 0;
    document.getElementById('slip_overCharge').value = d.overCharge || 0;
    document.getElementById('slip_advance').value = d.advance || 0;
    document.getElementById('slip_dPrice').value = d.driverPrice || 0;
    document.getElementById('slip_lOwner').value = d.lorryOwner || "";
    document.getElementById('slip_oVillage').value = d.ownerVillage || "";
    document.getElementById('slip_oMob').value = d.ownerMob || "";
    document.getElementById('slip_dName').value = d.driverName || "";
    document.getElementById('slip_dVillage').value = d.driverVillage || "";
    document.getElementById('slip_dMob').value = d.driverMob || "";
    document.getElementById('slip_licence').value = d.licenceNo || "";
    document.getElementById('slip_rowNum').value = d.rowNumber || "";
    document.getElementById('slip_archiveRow').value = rowNumber; // Isse pata chalega ke Overwrite karna hai, nayi entry nahi

    calculateSlip();

    // Wizard step-by-step nahi — seedha Review/Full-view mein khol do taaki galti turant dikhe aur fix ho sake
    currentWizardStep = WIZARD_TOTAL_INPUT_STEPS + 1;
    renderWizardStep();
}

// --- DRIVE SE SLIPS LOAD KARNA ---
let currentSlipHistory = []; // Edit button ke liye cache (safe lookup, HTML attribute mein JSON embed nahi karna padta)

async function loadSlipHistory() {
    const container = document.getElementById('slipHistoryList');
    if (!container) return;
    
    // Yahan text change kiya gaya hai
    container.innerHTML = '<div class="text-center w-100 p-4"><div class="spinner-border text-danger spinner-border-sm"></div> Fetching Loading Slips...</div>';
    
    try {
        const response = await fetch(scriptURL + "?action=listSlips");
        const slips = await response.json();
        currentSlipHistory = slips || [];
        
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
                                    <button class="btn btn-sm btn-outline-primary" onclick="editSavedSlip(${slip.rowNumber})"><i class="bi bi-pencil-square"></i></button>
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

        // Jinke documents upload hain unhe upar dikhao (dhundna na pade)
        const sortedVehicles = [...allVehicles].sort((a, b) => {
            const aUp = uploadedList.includes(a);
            const bUp = uploadedList.includes(b);
            if (aUp === bUp) return a.localeCompare(b);
            return aUp ? -1 : 1;
        });

        sortedVehicles.forEach((vNo) => {
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
                            <input type="file" id="file_${vNo}" class="hidden" multiple onchange="uploadFile(this, '${safeAttr(vNo)}')">
                            <button class="btn btn-sm btn-outline-info w-50" onclick="fetchVehicleDocs('${safeAttr(vNo)}')">Docs</button>
                        </div>
                        <div class="upload-drop-zone mb-3 text-center small text-muted"
                             ondragover="event.preventDefault(); this.classList.add('drag-over');"
                             ondragleave="this.classList.remove('drag-over');"
                             ondrop="handleFileDrop(event, '${safeAttr(vNo)}')">
                            <i class="bi bi-cloud-arrow-up"></i> Document yahan drag-drop karein
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