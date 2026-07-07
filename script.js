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
                container.insertAdjacentHTML('beforeend', `
                    <div class="recent-item shadow-sm">
                        <div>
                            <div class="fw-bold" style="font-size:14px;">${trip['Vehicle No']}</div>
                            <small class="text-muted">${trip['From']} ➔ ${trip['To']}</small>
                        </div>
                        <div class="text-end">
                            <div class="text-primary fw-bold">₹${amt}</div>
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

// --- VIEW ALL TRIPS (Updated with Collector Name) ---
async function loadTrips() {
    const container = document.getElementById('tripCardsContainer');
    const summaryBar = document.getElementById('tripSummaryBar');
    container.innerHTML = '<div class="text-center p-5"><div class="spinner-border text-primary spinner-border-sm"></div><br>Loading Sheet Data...</div>';
    
    try {
        const response = await fetch(scriptURL);
        const data = await response.json();
        container.innerHTML = '';
        summaryBar.classList.remove('hidden');

        const vCountMap = {};
        data.forEach(t => {
            let v = t['Vehicle No'];
            vCountMap[v] = (vCountMap[v] || 0) + 1;
        });

        data.forEach(trip => {
            let isCollected = (String(trip['_colG'] || "").toLowerCase().trim() === "yes");
            let collectorName = trip['_colH'] || "Not Specified";
            let amt = trip['Amount'] || 0;
            let vNo = trip['Vehicle No'];
            let driverNo = trip['Driver No'] || "";
            let ownerNo = trip['_owner'] || ""; // Lorry Owner Contact
            let tDate = trip['Date'];
            let tFrom = trip['From'];
            let tTo = trip['To'];
            let tParty = trip['Party Name'];
            let tMaterial = trip['Material'];
            let tWeight = trip['Capacity Ton'];
            
            let vCount = vCountMap[vNo];
            let vBadge = vCount === 1 
                ? `<span class="badge bg-info text-dark" style="font-size: 9px; vertical-align: middle; margin-left: 5px; border-radius: 4px;">NEW VEHICLE</span>`
                : `<span class="badge bg-secondary" style="font-size: 9px; vertical-align: middle; margin-left: 5px; border-radius: 4px;">${vCount} TRIPS</span>`;

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
                            <div class="fw-bold h5 mb-0 mt-1" style="color:#003366;">₹${amt}</div>
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
                            <span class="fw-bold small">${trip['Rate'] || '0'}</span>
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
                        
                        <!-- DRIVER SECTION WITH WHATSAPP -->
                        <div class="d-flex justify-content-between mb-1 align-items-center">
                            <span><i class="bi bi-telephone text-muted"></i> Driver:</span>
                            <div class="d-flex align-items-center gap-2">
                                <span class="fw-bold">${driverNo || '-'}</span>
                                ${driverNo ? `
                                    <a href="tel:${driverNo}" class="text-primary"><i class="bi bi-telephone-fill"></i></a>
                                    <a href="#" onclick="shareTrip('${driverNo}', '${vNo}', '${tFrom}', '${tTo}', '${tParty}', '${amt}', '${tDate}', '${tMaterial}', '${tWeight}')" class="text-success"><i class="bi bi-whatsapp"></i></a>
                                ` : ''}
                            </div>
                        </div>

                        <!-- OWNER SECTION WITH WHATSAPP -->
                        <div class="d-flex justify-content-between mb-1 align-items-center">
                            <span><i class="bi bi-person-badge text-muted"></i> Owner:</span>
                            <div class="d-flex align-items-center gap-2">
                                <span class="fw-bold">${ownerNo || '-'}</span>
                                ${ownerNo ? `
                                    <a href="tel:${ownerNo}" class="text-primary"><i class="bi bi-telephone-fill"></i></a>
                                    <a href="#" onclick="shareTrip('${ownerNo}', '${vNo}', '${tFrom}', '${tTo}', '${tParty}', '${amt}', '${tDate}', '${tMaterial}', '${tWeight}')" class="text-success"><i class="bi bi-whatsapp"></i></a>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            `);
        });
    } catch (e) { 
        container.innerHTML = '<div class="text-center p-5 text-danger">Error loading data.</div>';
    }
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

// Function to check if a date is between range
function isDateInRange(dateStr, start, end) {
    if (!start && !end) return true; // Agar filter set nahi hai toh sab dikhao
    
    let tripDate = parseSheetDate(dateStr);
    if (!tripDate) return false;

    let sDate = start ? new Date(start) : new Date("2000-01-01");
    let eDate = end ? new Date(end) : new Date("2099-12-31");
    
    // Time reset kar dete hain comparison ke liye
    tripDate.setHours(0,0,0,0);
    sDate.setHours(0,0,0,0);
    eDate.setHours(0,0,0,0);

    return tripDate >= sDate && tripDate <= eDate;
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
                            <div class="fw-bold h5 mb-0 mt-1" style="color:#003366;">₹${amt}</div>
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
                                    ${driverNo ? `<a href="#" onclick="shareTrip('${driverNo}', '${vNo}', '${tFrom}', '${tTo}', '${tParty}', '${amt}', '${tDate}', '${tMaterial}', '${tWeight}')" class="text-success"><i class="bi bi-whatsapp"></i></a>` : ''}
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
                                    ${ownerNo ? `<a href="#" onclick="shareTrip('${ownerNo}', '${vNo}', '${tFrom}', '${tTo}', '${tParty}', '${amt}', '${tDate}', '${tMaterial}', '${tWeight}')" class="text-success"><i class="bi bi-whatsapp"></i></a>` : ''}
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
    document.getElementById('slip_vNo').value = trip['Vehicle No'] || "";
    document.getElementById('slip_date').value = trip['Date'] || "";
    document.getElementById('slip_party').value = trip['Party Name'] || "";
    document.getElementById('slip_from').value = trip['From'] || "";
    document.getElementById('slip_to').value = trip['To'] || "";
    
    // Finance Data
    document.getElementById('slip_rate').value = trip['Rate'] || 0;
    document.getElementById('slip_weight').value = (trip['Capacity Ton'] ? trip['Capacity Ton'] * 1000 : 0); // Ton to KG
    document.getElementById('slip_advance').value = trip['Advance'] || 0;
    
    // Check property name: Driver Prize ya Driver Price? 
    document.getElementById('slip_dPrice').value = trip['Driver Prize'] || trip['Driver Price'] || 0;
    
    // Contacts & Details
    document.getElementById('slip_lOwner').value = trip['Lorry Owner Name'] || "";
    document.getElementById('slip_oMob').value = trip['Lorry Owner Contact'] || trip['_owner'] || "";
    document.getElementById('slip_dName').value = trip['Driver Name'] || "";
    document.getElementById('slip_dMob').value = trip['Driver No'] || "";
    document.getElementById('slip_licence').value = trip['Licence No'] || "";
    
    // Row Number Save karna zaroori hai (update ke liye)
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
    const vNo = document.getElementById('slip_vNo').value || "N/A";

    if(!vNo || vNo === "N/A") return alert("Data select karein!");

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Generating PDF...';

    // --- FIX: MOBILE SCALING ISSUES ---
    // Capture se pehle mobile scale hatana zaroori hai
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
            scale: 2, // Achhi quality ke liye
            useCORS: true, 
            logging: false,
            letterRendering: true,
            scrollX: 0,
            scrollY: 0,
            width: 794 // Capture width fix kar di
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
        // PDF Generate karein
        const pdfWorker = html2pdf().set(opt).from(element);
        const pdfBase64 = await pdfWorker.outputPdf('datauristring').then(res => res.split(',')[1]);
        
        // Save PDF to Device
        await pdfWorker.save();

        // Google Sheet mein data save karne ka payload
        const payload = {
            action: "saveLoadingSlip",
            rowNumber: document.getElementById('slip_rowNum').value,
            vNo: vNo,
            date: document.getElementById('slip_date').value || "NoDate",
            pdfBase64: pdfBase64,
            partyName: document.getElementById('slip_party').value,
            from: document.getElementById('slip_from').value,
            to: document.getElementById('slip_to').value,
            rate: document.getElementById('slip_rate').value,
            weight: document.getElementById('slip_weight').value,
            advance: document.getElementById('slip_advance').value,
            driverPrice: document.getElementById('slip_dPrice').value,
            toPay: document.getElementById('slip_toPay').value,
            lorryOwner: document.getElementById('slip_lOwner').value,
            ownerMob: document.getElementById('slip_oMob').value,
            driverName: document.getElementById('slip_dName').value,
            driverMob: document.getElementById('slip_dMob').value,
            licenceNo: document.getElementById('slip_licence').value
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
        // --- RESTORE: Mobile View wapas set karein ---
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
    
    // Show a fast loader
    container.innerHTML = '<div class="text-center w-100 p-4"><div class="spinner-border text-danger spinner-border-sm"></div> Fetching Archive...</div>';
    
    try {
        // Ab ye request Drive scan nahi karegi, sirf Sheet read karegi (0.5 seconds)
        const response = await fetch(scriptURL + "?action=listSlips");
        const slips = await response.json();
        
        container.innerHTML = ""; 

        if (!slips || slips.length === 0) {
            container.innerHTML = '<div class="text-center w-100 p-5 text-muted">No slips found in Archive.</div>';
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
// --- DRIVE SE ASLI PDF FILE SHARE KARNA (Fixed Version) ---
async function shareFileFromDrive(fileId, fileName) {
    const originalBtn = event.currentTarget;
    const originalHtml = originalBtn.innerHTML;
    
    // UI Feedback
    originalBtn.disabled = true;
    originalBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

    try {
        // 1. Apps Script se Base64 data mangwayein
        const response = await fetch(scriptURL + `?action=getFileContent&fileId=${fileId}`);
        if (!response.ok) throw new Error("File fetch failed");
        const base64Data = await response.text();

        // 2. Base64 ko Blob mein badlein
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });

        // 3. Blob se File Object banayein
        const file = new File([blob], `${fileName}.pdf`, { type: 'application/pdf' });

        // 4. Web Share API check karein (Sirf HTTPS par chalta hai)
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                files: [file],
                title: 'ATC Loading Slip',
                text: 'Loading Slip for Vehicle: ' + fileName
            });
        } else {
            // FALLBACK: Agar share support nahi hai (jaise local network par), toh DOWNLOAD karwao
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${fileName}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            alert("Security ki wajah se direct share block hai. File DOWNLOAD ho gayi hai, ab aap ise WhatsApp par bhej sakte hain.");
        }
    } catch (err) {
        console.error("Share Error:", err);
        alert("File share nahi ho saki. Internet connection check karein.");
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
                    <div class="v-item-header p-3 d-flex justify-content-between align-items-center" onclick="toggleDetails('details_${safeId}', '${vNo}')" style="cursor:pointer;">
                        <div>
                            <span class="fw-bold" style="color: #003366;"><i class="bi bi-truck me-1"></i> ${vNo}</span>
                            ${statusMark}
                        </div>
                        <i class="bi bi-chevron-down text-muted"></i>
                    </div>
                    
                    <div id="details_${safeId}" class="v-item-details hidden p-3 border-top bg-light">
                        <div id="stats_${safeId}" class="row g-2 mb-3 mt-1 text-center small text-muted">Calculating...</div>
                        <div class="d-flex gap-2 mb-3">
                            <button class="btn btn-sm btn-primary w-50" onclick="triggerUpload('${vNo}')">Update RC</button>
                            <input type="file" id="file_${vNo}" class="hidden" onchange="uploadFile(this, '${vNo}')">
                            <button class="btn btn-sm btn-outline-info w-50" onclick="fetchVehicleDocs('${vNo}')">Docs</button>
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

function formatINR(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(amount);
}