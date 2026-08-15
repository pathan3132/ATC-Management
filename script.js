let allTripsData = []; // Saara data store karne ke liye

// ⚠️ EDIT KAREIN: Statement PDFs ke footer mein yehi company naam/address print hoga.
// Yahan apna sahi naam aur pura address daal dein.
const COMPANY_NAME = "ATC ALLINDIA TRANSPORT COMPANY";
const COMPANY_ADDRESS = "Solapur-Dhule Road, Gut No. 102, Fatiyabad, Aurangabad (MH) 431002"; // TODO: apna asli address daalein

// Jab bhi statement PDF banayein, ye ek simple full-screen "Generating PDF..." overlay dikhata hai
// taaki neeche wala real (non-hacky) content element user ko flash na ho. Yehi wajah thi ki
// off-screen (position:fixed/-9999px) trick se PDF blank aa raha tha — html2canvas ko element
// normal document-flow mein chahiye, jaisa purana Loading Slip (#receipt-to-print) system karta hai.
function showPdfGeneratingOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'pdfGenOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:#ffffff;z-index:99999;display:flex;align-items:center;justify-content:center;flex-direction:column;font-family:Arial,sans-serif;color:#003366;';
    overlay.innerHTML = '<div class="spinner-border text-danger mb-2"></div><div>PDF Generate ho raha hai...</div>';
    document.body.appendChild(overlay);
    return overlay;
}
function hidePdfGeneratingOverlay(overlay) {
    if (overlay && overlay.parentNode) document.body.removeChild(overlay);
}

// html2pdf se PDF banane ke baad, HAR page ke neeche Company Name + Address wala footer print karta hai,
// aur page number bhi. Ye seedhe jsPDF instance par kaam karta hai (html2pdf isi ka wrapper hai),
// isliye export (download) aur share (blob) dono isi ek function ko reuse karte hain.
async function generateStatementPdf(container, opt) {
    const worker = html2pdf().set(opt).from(container).toPdf();
    const pdf = await worker.get('pdf');
    const pageCount = pdf.internal.getNumberOfPages();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(120, 120, 120);
        pdf.text(`${COMPANY_NAME} | ${COMPANY_ADDRESS}`, pageWidth / 2, pageHeight - 6, { align: 'center' });
        pdf.text(`Page ${i} / ${pageCount}`, pageWidth - 8, pageHeight - 6, { align: 'right' });
    }
    return pdf;
}

// PDF ko pehle device mein SAVE/DOWNLOAD karta hai, aur uske baad WhatsApp/share menu bhi khol deta hai —
// taaki statement hamesha phone mein bhi rahe aur turant kisi ko bhej bhi saken.
async function sharePdfOrDownload(blob, filename) {
    // 1. Pehle PDF download karo (device mein save)
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    // 2. Fir WhatsApp (ya jo bhi share sheet available ho) khol do
    try {
        const file = new File([blob], filename, { type: 'application/pdf' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: filename });
            return;
        }
    } catch (e) {
        if (e && e.name === 'AbortError') return; // User ne share cancel kar diya, download to ho hi chuka hai
    }
    alert("PDF download ho gayi hai. Is device par direct share menu available nahi tha — WhatsApp kholkar ye PDF file manually attach kar dein.");
}

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
    if(id === 'daily-followup') loadDailyFollowup();
    if(id === 'party-ledger') { 
        loadPartyChips(); 
        document.getElementById('ledgerViewArea').classList.add('hidden'); 
        document.getElementById('partyPickerCard').classList.remove('hidden');
    }
    if(id === 'advance-ledger') {
        loadAdvancePartyChips();
        loadAdvVehicleList();
        loadAdvAccountList();
        document.getElementById('advLedgerViewArea').classList.add('hidden');
        document.getElementById('advPartyPickerCard').classList.remove('hidden');
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


// --- WHATSAPP PHONE NUMBER FIX ---
// Sheet mein zyaadatar numbers 10-digit (bina country code ke) hote hain, jiski wajah se
// WhatsApp kabhi kabhi number detect nahi kar paata tha. Ye function har number ko
// WhatsApp ke liye sahi format (91XXXXXXXXXX) mein convert karta hai.
function formatWhatsAppPhone(phone) {
    let digits = String(phone || "").replace(/\D/g, '');
    digits = digits.replace(/^0+/, ''); // Agar number 0 se start hota hai (jaise 09876543210), 0 hata do
    if (digits.length === 10) {
        digits = '91' + digits; // Plain 10-digit Indian mobile number -> country code add karo
    } else if (digits.length === 11 && digits.startsWith('91') === false && digits.startsWith('0')) {
        digits = '91' + digits.slice(1);
    }
    return digits;
}

// --- COMMISSION MESSAGE REMINDER TRACKING ---
// Har trip ke liye kitni baar commission message bheja gaya hai, ye localStorage mein
// (device par hi) track karte hain, taaki 2nd/3rd baar bhejte waqt reminder strong ho jaaye.
function getMsgSendCounts() {
    try { return JSON.parse(localStorage.getItem('atc_msg_send_counts') || '{}'); } catch (e) { return {}; }
}
function saveMsgSendCounts(obj) {
    try { localStorage.setItem('atc_msg_send_counts', JSON.stringify(obj)); } catch (e) { /* ignore */ }
}
function tripKeyFor(vNo, date) {
    return `${vNo}|${date}`;
}

// WhatsApp Share
async function shareTrip(phone, vNo, from, to, party, amt, date, material, weight) {
    // 1. Phone number cleaning + country code fix
    let cleanPhone = formatWhatsAppPhone(phone);
    let last10Digits = cleanPhone.slice(-10);

    if (cleanPhone.length < 12) {
        alert("⚠️ Ye number sahi format mein nahi hai, WhatsApp nahi khul payega. Kripya number check karein: " + phone);
        return;
    }

    // 2. Reminder Escalation Check
    const tripKey = tripKeyFor(vNo, date);
    const counts = getMsgSendCounts();
    const prevCount = counts[tripKey] || 0;
    let reminderTag = "";

    if (prevCount === 1) {
        const proceed = confirm(`⚠️ REMINDER\n\nVehicle ${vNo} ke liye commission message pehle EK baar bheja ja chuka hai.\n\nDusra reminder bhejna hai?`);
        if (!proceed) return;
        reminderTag = `🔔 *REMINDER — 2nd MESSAGE*\nPichla message shaayad miss ho gaya, kripya jald commission bhej dein.\n\n`;
    } else if (prevCount >= 2) {
        const proceed = confirm(`🚨 STRONG REMINDER\n\nVehicle ${vNo} ke liye ye ${prevCount + 1}-va (baar) message hoga!\n\nBhejna hai?`);
        if (!proceed) return;
        reminderTag = `🚨🔴 *URGENT — FINAL REMINDER (Message #${prevCount + 1})*\nYe ${prevCount} baar reminder bhejne ke baad ka message hai. Kripya TURANT commission clear karein.\n\n`;
    }

    // 3. History Calculation with Destinations (From/To)
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

    // 4. Message Body Design
    let messageBody = `🏢 *ATC ALLINDIA TRANSPORT*
_Munna Bhai & Asif Bhai_
==========================
${reminderTag}📍 *CURRENT TRIP DETAILS*
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
Commission bhej kar SS dein 🙏
📲 UPI: *8888664019*

_Thank you for choosing ATC!_`;

    // 5. Proper Encoding (Taki message na kate)
    let encodedMsg = encodeURIComponent(messageBody);
    let whatsappURL = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMsg}`;

    // 6. Is trip ko "last shared" mark karo, taaki list wapas aane par yahin scroll ho jaaye
    localStorage.setItem('atc_last_shared_trip', tripKey);
    // 7. Send count badhao
    counts[tripKey] = prevCount + 1;
    saveMsgSendCounts(counts);

    // 8. Open WhatsApp
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
                <div class="trip-card shadow-sm ${isCollected ? 'status-collected' : 'status-pending'} mb-4" data-trip-key="${safeAttr(tripKeyFor(vNo, tDate))}">
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

        // --- FIX: SCROLL POSITION YAAD RAKHNA ---
        // Jab WhatsApp par msg bhejne ke baad user wapas app par aata hai aur list yahan
        // reload hoti hai, to hum use list ke TOP par le jaane ke bajaye seedha usi
        // trip card tak scroll kar dete hain jahan se wo pichli baar gaya tha.
        const lastKey = localStorage.getItem('atc_last_shared_trip');
        if (lastKey) {
            let target = null;
            container.querySelectorAll('[data-trip-key]').forEach(card => {
                if (card.getAttribute('data-trip-key') === lastKey) target = card;
            });
            if (target) {
                setTimeout(() => {
                    target.scrollIntoView({ behavior: 'auto', block: 'center' });
                    target.classList.add('trip-card-highlight');
                    setTimeout(() => target.classList.remove('trip-card-highlight'), 1800);
                }, 50);
            }
        }

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

// Party ki poori ledger ka ek printable PDF (HTML) banata hai — export aur share dono isi ko reuse karte hain
function buildLedgerPdfElement() {
    let totalDebit = 0, totalCredit = 0, runningBalance = 0, rowsHtml = "";
    currentLedgerEntries.forEach((row, idx) => {
        totalDebit += row.debit;
        totalCredit += row.credit;
        runningBalance += (row.debit - row.credit);
        const balColor = runningBalance > 0 ? '#c0392b' : (runningBalance < 0 ? '#1a7a3c' : '#666');
        rowsHtml += `
            <tr>
                <td style="padding:6px;border:1px solid #ddd;">${idx + 1}</td>
                <td style="padding:6px;border:1px solid #ddd;">${row.date}</td>
                <td style="padding:6px;border:1px solid #ddd;">${row.vNo ? `<b>${row.vNo}</b><br>` : ''}<span style="font-size:10px;color:#666;">${row.description || ''}</span></td>
                <td style="padding:6px;border:1px solid #ddd;text-align:right;color:#c0392b;">${row.debit ? '₹' + row.debit.toLocaleString('en-IN') : '-'}</td>
                <td style="padding:6px;border:1px solid #ddd;text-align:right;color:#1a7a3c;">${row.credit ? '₹' + row.credit.toLocaleString('en-IN') : '-'}</td>
                <td style="padding:6px;border:1px solid #ddd;text-align:right;font-weight:bold;color:${balColor};">₹${Math.abs(runningBalance).toLocaleString('en-IN')}</td>
            </tr>`;
    });

    const balanceText = runningBalance > 0 ? `₹${runningBalance.toLocaleString('en-IN')} (LENA HAI)` : runningBalance < 0 ? `₹${Math.abs(runningBalance).toLocaleString('en-IN')} (DENA HAI)` : '₹0 (CLEAR)';

    const html = `
        <div style="font-family: Arial, sans-serif; width:750px; padding:20px; color:#222;">
            <style>
                table { border-collapse: collapse; width: 100%; }
                tr { page-break-inside: avoid; break-inside: avoid; }
            </style>
            <div style="text-align:center; border-bottom:2px solid #003366; padding-bottom:10px; margin-bottom:15px;">
                <h2 style="margin:0;color:#003366;">🏢 ATC ALLINDIA TRANSPORT</h2>
                <div style="font-size:13px;color:#555;">Party Statement</div>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:12px;font-size:13px;">
                <div><b>Party:</b> ${currentLedgerParty}</div>
                <div><b>Date:</b> ${new Date().toLocaleDateString('en-IN')}</div>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:12px;">
                <thead>
                    <tr style="background:#003366;color:white;">
                        <th style="padding:6px;border:1px solid #ddd;">#</th>
                        <th style="padding:6px;border:1px solid #ddd;">Date</th>
                        <th style="padding:6px;border:1px solid #ddd;">Vehicle / Description</th>
                        <th style="padding:6px;border:1px solid #ddd;">Debit</th>
                        <th style="padding:6px;border:1px solid #ddd;">Credit</th>
                        <th style="padding:6px;border:1px solid #ddd;">Balance</th>
                    </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
            </table>
            <div style="margin-top:15px;border-top:1px solid #ccc;padding-top:10px;font-size:13px; page-break-inside: avoid;">
                <div><b>Total Debit:</b> ₹${totalDebit.toLocaleString('en-IN')}</div>
                <div><b>Total Credit:</b> ₹${totalCredit.toLocaleString('en-IN')}</div>
                <div style="font-weight:bold;color:#b30000;margin-top:5px;">BALANCE: ${balanceText}</div>
            </div>
        </div>`;

    const container = document.createElement('div');
    container.style.background = '#ffffff';
    container.style.width = '750px';
    container.innerHTML = html;
    document.body.appendChild(container);

    const opt = {
        margin: [5, 5, 14, 5], // neeche zyada margin taaki footer ke liye jagah bache
        filename: `Ledger_${currentLedgerParty}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] } // rows/blocks page ke beech mein na tootein
    };
    return { container, opt };
}

// Party ka poora statement ab PDF banakar WhatsApp (ya jo bhi share sheet available ho) se bhejna
async function shareLedgerStatement() {
    if (!currentLedgerParty || currentLedgerEntries.length === 0) { alert("Is party ki koi entry nahi hai."); return; }
    const overlay = showPdfGeneratingOverlay();
    const { container, opt } = buildLedgerPdfElement();
    try {
        const pdf = await generateStatementPdf(container, opt);
        document.body.removeChild(container);
        hidePdfGeneratingOverlay(overlay);
        const blob = pdf.output('blob');
        await sharePdfOrDownload(blob, opt.filename);
    } catch (e) {
        if (container.parentNode) document.body.removeChild(container);
        hidePdfGeneratingOverlay(overlay);
        alert("PDF banane mein dikkat aayi.");
    }
}

// Party ki ledger ab PDF file mein export/download hogi (pehle CSV thi)
async function exportLedgerCSV() {
    if (!currentLedgerParty || currentLedgerEntries.length === 0) { alert("Export karne ke liye koi entry nahi hai."); return; }
    const overlay = showPdfGeneratingOverlay();
    const { container, opt } = buildLedgerPdfElement();
    try {
        const pdf = await generateStatementPdf(container, opt);
        pdf.save(opt.filename);
    } finally {
        if (container.parentNode) document.body.removeChild(container);
        hidePdfGeneratingOverlay(overlay);
    }
}
// ================= END PARTY LEDGER =================


// ================= ADVANCE PAYMENT LEDGER (SMT / PARTY ADVANCE) =================
// Jab party (jaise SMT/Tomato) kisi gadi ke liye advance hamare account mein daalti hai,
// aur fir hum wahi paisa driver/gadi malik ko pay karte hain — us poora hisaab yahan track hota hai.
let currentAdvanceParty = null;
let allAdvancePartiesData = [];   // Advance party list cache (search/filter ke liye)
let currentAdvanceEntries = [];   // Khuli hui party ki entries cache (CSV/Share/Search ke liye)
let allAdvVehicles = [];          // Sabhi gadi numbers cache (typeahead ke liye)
let currentAdvTrips = [];         // Select ki gayi gadi ki purani trips (auto-fill ke liye)

// Vehicle datalist load karna (RJ type karte hi suggestions ke liye)
async function loadAdvVehicleList() {
    try {
        const res = await fetch(scriptURL + "?action=getVehicles");
        allAdvVehicles = await res.json();
        document.getElementById('advVehicleListOptions').innerHTML = allAdvVehicles.map(v => `<option value="${v}">`).join('');
    } catch (e) { console.error("Adv vehicle list error:", e); }
}

// Jab Vehicle No field mein type/select ho — agar exact match mile to uski trips fetch karo
async function onAdvVNoInput() {
    const val = document.getElementById('advVNo').value.trim().toUpperCase();
    const area = document.getElementById('advTripSelectArea');
    if (!allAdvVehicles.includes(val)) { area.classList.add('hidden'); return; }

    try {
        const res = await fetch(scriptURL + "?action=getAdvTripsByVehicle&vNo=" + encodeURIComponent(val));
        currentAdvTrips = await res.json();
        const dropdown = document.getElementById('advTripSelectDropdown');
        if (currentAdvTrips && currentAdvTrips.length > 0) {
            dropdown.innerHTML = '<option value="">-- Trip Select Karein --</option>' +
                currentAdvTrips.map((t, i) => `<option value="${i}">${t.date} | ${t.from} → ${t.to}</option>`).join('');
            area.classList.remove('hidden');
        } else {
            area.classList.add('hidden');
        }
    } catch (e) { area.classList.add('hidden'); }
}

// Select ki gayi trip se Date/Contact/From/To auto-fill karna (aage se edit bhi kar sakte hain)
function fillAdvFromTrip() {
    const idx = document.getElementById('advTripSelectDropdown').value;
    const trip = currentAdvTrips[idx];
    if (!trip) return;
    if (trip.date) {
        const d = parseSheetDate(trip.date);
        if (d) document.getElementById('advDate').value = d.toISOString().split('T')[0];
    }
    document.getElementById('advFrom').value = trip.from || '';
    document.getElementById('advTo').value = trip.to || '';
    document.getElementById('advDrNo').value = trip.dNo || '';
}

// A/C Name datalist load karna (pehle use kiye gaye accounts suggest honge, naya bhi type kar sakte hain)
async function loadAdvAccountList() {
    try {
        const res = await fetch(scriptURL + "?action=getAdvanceAccountList");
        const accounts = await res.json();
        document.getElementById('advAccountListOptions').innerHTML = accounts.map(a => `<option value="${a}">`).join('');
    } catch (e) { console.error("Adv account list error:", e); }
}

async function loadAdvancePartyChips() {
    const chipsRow = document.getElementById('advPartyChipsRow');
    const dataList = document.getElementById('advPartyListOptions');
    chipsRow.innerHTML = '<small class="text-muted">Loading parties...</small>';

    try {
        const res = await fetch(scriptURL + "?action=getAdvancePartyList");
        const parties = await res.json();
        allAdvancePartiesData = parties;

        dataList.innerHTML = parties.map(p => `<option value="${p.name}">`).join('');

        let totalReceived = 0, totalPaid = 0;
        parties.forEach(p => { totalReceived += p.received; totalPaid += p.paid; });
        document.getElementById('advAllReceived').innerText = "₹" + totalReceived.toLocaleString('en-IN');
        document.getElementById('advAllPaid').innerText = "₹" + totalPaid.toLocaleString('en-IN');
        document.getElementById('advAllPending').innerText = "₹" + (totalReceived - totalPaid).toLocaleString('en-IN');

        renderAdvancePartyChips(parties);
    } catch (e) {
        chipsRow.innerHTML = '<small class="text-danger">Party list load nahi ho saki.</small>';
    }
}

function renderAdvancePartyChips(parties) {
    const chipsRow = document.getElementById('advPartyChipsRow');
    if (parties.length === 0) {
        chipsRow.innerHTML = '<small class="text-muted">Abhi tak koi party nahi hai. Naam likh kar shuru karein (jaise SMT).</small>';
        return;
    }
    chipsRow.innerHTML = parties.map(p => {
        const pending = p.pending;
        const balClass = pending > 0 ? 'text-warning' : (pending < 0 ? 'text-danger' : 'text-muted');
        return `<span class="party-chip" onclick="document.getElementById('advPartyInput').value='${safeAttr(p.name)}'; openAdvanceLedger();">
                    ${safeAttr(p.name)} <b class="${balClass}">₹${Math.abs(pending).toLocaleString('en-IN')}</b>
                </span>`;
    }).join('');
}

// Party chips ko search box se filter karna
function filterAdvancePartyChips() {
    const val = document.getElementById('advPartyChipSearch').value.toUpperCase();
    const filtered = allAdvancePartiesData.filter(p => p.name.toUpperCase().includes(val));
    renderAdvancePartyChips(filtered);
}

// Ek party (jaise SMT) ka advance ledger khol kar dikhana
async function openAdvanceLedger() {
    const nameInput = document.getElementById('advPartyInput');
    const party = nameInput.value.trim().toUpperCase();
    if (!party) { alert("Pehle party ka naam likhein (jaise SMT)!"); return; }

    currentAdvanceParty = party;
    document.getElementById('advPartyPickerCard').classList.add('hidden');
    document.getElementById('advLedgerViewArea').classList.remove('hidden');
    document.getElementById('advPartyName').innerText = party;
    document.getElementById('advDate').value = new Date().toISOString().split('T')[0];
    cancelAdvanceEdit();

    await refreshAdvanceTable();
}

// Party badalne ke liye wapas list par jaana
function closeAdvanceLedger() {
    currentAdvanceParty = null;
    currentAdvanceEntries = [];
    document.getElementById('advLedgerViewArea').classList.add('hidden');
    document.getElementById('advPartyPickerCard').classList.remove('hidden');
    document.getElementById('advPartyInput').value = '';
    loadAdvancePartyChips(); // Balances refresh karein
}

// Table + summary refresh karna
async function refreshAdvanceTable() {
    if (!currentAdvanceParty) return;
    const tbody = document.getElementById('advTableBody');
    tbody.innerHTML = '<tr><td colspan="8" class="text-center p-3"><div class="spinner-border spinner-border-sm text-danger"></div></td></tr>';

    try {
        const res = await fetch(scriptURL + `?action=getAdvanceLedger&party=${encodeURIComponent(currentAdvanceParty)}`);
        const entries = await res.json();
        currentAdvanceEntries = entries;
        renderAdvanceRows(entries);
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center p-3 text-danger">Ledger load nahi ho saka.</td></tr>';
    }
}

// Rows ko table mein draw karna (HAR ENTRY KA APNA ALAG BALANCE — cumulative running total nahi)
function renderAdvanceRows(entries) {
    const tbody = document.getElementById('advTableBody');
    let totalReceived = 0, totalPaid = 0, overallPending = 0, rowsHtml = "";

    entries.forEach((row, idx) => {
        // Agar Received 0 hai aur Paid > 0, matlab party ne SEEDHA driver ko pay kiya — hamare account se nahi gaya.
        // Isliye ye amount hamare Paid/Pending calculation mein nahi jodenge, sirf record ke liye dikhayenge.
        const isDirect = (row.received === 0 && row.paid > 0);

        totalReceived += row.received;
        if (!isDirect) { totalPaid += row.paid; overallPending += (row.received - row.paid); }

        // Is ENTRY ka apna balance — sirf isi row ka received - paid (dusri rows se koi lena dena nahi)
        // Party Direct Paid wali entry mein humare account se paisa aaya hi nahi, isliye uska balance hamesha ₹0.
        const rowBalance = isDirect ? 0 : (row.received - row.paid);
        const pendClass = rowBalance > 0 ? 'text-warning' : (rowBalance < 0 ? 'text-danger' : 'text-muted');
        // A/C Name ab seedhe Received (green) amount ke neeche dikhega, taaki turant pata chale paisa kis account mein aaya
        const acLine = row.acName ? `<br><small class="text-muted">A/C: ${safeAttr(row.acName)}</small>` : '';

        rowsHtml += `
            <tr>
                <td>${idx + 1}</td>
                <td>${row.date}</td>
                <td>
                    ${row.vNo ? `<b>${safeAttr(row.vNo)}</b><br>` : ''}<small class="text-muted">${row.from || ''} ${row.to ? '→ ' + row.to : ''}</small>
                </td>
                <td class="text-end text-success">${row.received ? '₹' + row.received.toLocaleString('en-IN') : ''}${acLine}</td>
                <td><small>${safeAttr(row.paidTo || '')}</small></td>
                <td class="text-end text-danger">${row.paid ? '₹' + row.paid.toLocaleString('en-IN') : ''}${isDirect ? '<br><span class="badge bg-warning text-dark">Party Direct Paid</span>' : ''}</td>
                <td class="text-end fw-bold ${pendClass}">₹${Math.abs(rowBalance).toLocaleString('en-IN')}</td>
                <td class="text-end text-nowrap">
                    <i class="bi bi-pencil-square text-primary me-2" style="cursor:pointer;" onclick='startAdvanceEdit(${row.rowNumber})'></i>
                    <i class="bi bi-trash text-danger" style="cursor:pointer;" onclick="deleteAdvanceEntry(${row.rowNumber})"></i>
                </td>
            </tr>`;
    });

    tbody.innerHTML = rowsHtml || '<tr><td colspan="8" class="text-center p-3 text-muted">Is party ki koi entry nahi hai. Neeche se add karein.</td></tr>';

    document.getElementById('advTotalReceived').innerText = "₹" + totalReceived.toLocaleString('en-IN');
    document.getElementById('advTotalPaid').innerText = "₹" + totalPaid.toLocaleString('en-IN');
    document.getElementById('advPendingBal').innerText = "₹" + Math.abs(overallPending).toLocaleString('en-IN') + (overallPending > 0 ? ' (Dena Baaki)' : overallPending < 0 ? ' (Extra Paid)' : ' (Clear)');
}

// Is party ki entries ke andar hi search karna (vehicle / paid to)
function filterAdvanceRows() {
    const val = document.getElementById('advSearch').value.toUpperCase();
    if (!val) { renderAdvanceRows(currentAdvanceEntries); return; }
    const filtered = currentAdvanceEntries.filter(row =>
        String(row.vNo || '').toUpperCase().includes(val) ||
        String(row.paidTo || '').toUpperCase().includes(val) ||
        String(row.from || '').toUpperCase().includes(val) ||
        String(row.to || '').toUpperCase().includes(val)
    );
    renderAdvanceRows(filtered);
}

// Nayi entry add karna, YA edit mode mein ho to update karna
async function addAdvanceEntry() {
    if (!currentAdvanceParty) { alert("Pehle party select karein (jaise SMT)!"); return; }

    const date = document.getElementById('advDate').value;
    const vNo = document.getElementById('advVNo').value;
    const drNo = document.getElementById('advDrNo').value;
    const acName = document.getElementById('advAcName').value;
    const from = document.getElementById('advFrom').value;
    const to = document.getElementById('advTo').value;
    const received = document.getElementById('advReceived').value;
    const paidTo = document.getElementById('advPaidTo').value;
    const paid = document.getElementById('advPaid').value;
    const remark = document.getElementById('advRemark').value;
    const editRow = document.getElementById('advEditRow').value;

    if (!date) { alert("Date select karein!"); return; }
    if (!received && !paid) { alert("Received ya Paid mein se koi ek amount daalein!"); return; }

    const btn = document.getElementById('advAddBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> SAVING...';

    const payload = {
        action: editRow ? "updateAdvanceEntry" : "addAdvanceEntry",
        rowNumber: editRow,
        date: date,
        party: currentAdvanceParty,
        vNo: vNo,
        drNo: drNo,
        acName: acName,
        from: from,
        to: to,
        received: received || 0,
        paidTo: paidTo,
        paid: paid || 0,
        remark: remark
    };

    try {
        await fetch(scriptURL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload) });
        cancelAdvanceEdit();
        await refreshAdvanceTable();
    } catch (e) {
        alert("Entry save nahi ho saki. Internet check karein.");
    }
    btn.disabled = false;
}

// Ek entry ko edit mode mein kholna (form mein values bhar dena)
function startAdvanceEdit(rowNumber) {
    const row = currentAdvanceEntries.find(r => r.rowNumber === rowNumber);
    if (!row) return;

    document.getElementById('advEditRow').value = rowNumber;
    document.getElementById('advVNo').value = row.vNo || '';
    document.getElementById('advDrNo').value = row.drNo || '';
    document.getElementById('advAcName').value = row.acName || '';
    document.getElementById('advFrom').value = row.from || '';
    document.getElementById('advTo').value = row.to || '';
    document.getElementById('advReceived').value = row.received || '';
    document.getElementById('advPaidTo').value = row.paidTo || '';
    document.getElementById('advPaid').value = row.paid || '';
    document.getElementById('advRemark').value = row.remark || '';
    const parsedDate = new Date(row.date);
    if (!isNaN(parsedDate.getTime())) {
        document.getElementById('advDate').value = parsedDate.toISOString().split('T')[0];
    }

    document.getElementById('advFormTitle').innerHTML = '<i class="bi bi-pencil-square text-danger me-1"></i>Edit Entry';
    document.getElementById('advAddBtn').innerHTML = '<i class="bi bi-check-circle me-1"></i> Update Entry';
    document.getElementById('advCancelEditBtn').classList.remove('hidden');
    document.getElementById('advDate').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Edit mode cancel karke wapas "New Entry" par aana
function cancelAdvanceEdit() {
    document.getElementById('advEditRow').value = '';
    document.getElementById('advVNo').value = '';
    document.getElementById('advDrNo').value = '';
    document.getElementById('advAcName').value = '';
    document.getElementById('advFrom').value = '';
    document.getElementById('advTo').value = '';
    document.getElementById('advReceived').value = '';
    document.getElementById('advPaidTo').value = '';
    document.getElementById('advPaid').value = '';
    document.getElementById('advRemark').value = '';
    document.getElementById('advTripSelectArea').classList.add('hidden');
    document.getElementById('advFormTitle').innerHTML = '<i class="bi bi-plus-circle text-danger me-1"></i>New Entry';
    document.getElementById('advAddBtn').innerHTML = '<i class="bi bi-check-circle me-1"></i> Add Entry';
    document.getElementById('advCancelEditBtn').classList.add('hidden');
}

// Ek entry delete karna
async function deleteAdvanceEntry(rowNumber) {
    if (!confirm("Kya aap ye entry delete karna chahte hain?")) return;
    try {
        await fetch(scriptURL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ action: "deleteAdvanceEntry", rowNumber: rowNumber }) });
        await refreshAdvanceTable();
    } catch (e) {
        alert("Delete nahi ho saka. Internet check karein.");
    }
}

// Party ki poori advance ledger ka ek printable PDF (HTML) banata hai — export aur share dono isi ko reuse karte hain
function buildAdvancePdfElement() {
    let totalReceived = 0, totalPaid = 0, overallPending = 0, rowsHtml = "";
    currentAdvanceEntries.forEach((row, idx) => {
        const isDirect = (row.received === 0 && row.paid > 0);
        totalReceived += row.received;
        if (!isDirect) { totalPaid += row.paid; overallPending += (row.received - row.paid); }
        const rowBalance = isDirect ? 0 : (row.received - row.paid);

        rowsHtml += `
            <tr>
                <td style="padding:6px;border:1px solid #ddd;">${idx + 1}</td>
                <td style="padding:6px;border:1px solid #ddd;">${row.date}</td>
                <td style="padding:6px;border:1px solid #ddd;">${row.vNo ? `<b>${row.vNo}</b><br>` : ''}<span style="font-size:10px;color:#666;">${row.from || ''} ${row.to ? '→ ' + row.to : ''}</span></td>
                <td style="padding:6px;border:1px solid #ddd;">${row.acName || '-'}</td>
                <td style="padding:6px;border:1px solid #ddd;text-align:right;color:#1a7a3c;">${row.received ? '₹' + row.received.toLocaleString('en-IN') : '-'}</td>
                <td style="padding:6px;border:1px solid #ddd;">${row.paidTo || '-'}</td>
                <td style="padding:6px;border:1px solid #ddd;text-align:right;color:#c0392b;">${row.paid ? '₹' + row.paid.toLocaleString('en-IN') : '-'}${isDirect ? '<br><span style="font-size:9px;background:#f1c40f;padding:1px 4px;border-radius:3px;">DIRECT PAID</span>' : ''}</td>
                <td style="padding:6px;border:1px solid #ddd;text-align:right;font-weight:bold;">₹${Math.abs(rowBalance).toLocaleString('en-IN')}</td>
            </tr>`;
    });

    const pendingText = overallPending > 0 ? `₹${overallPending.toLocaleString('en-IN')} (DENA BAAKI)` : overallPending < 0 ? `₹${Math.abs(overallPending).toLocaleString('en-IN')} (EXTRA PAID)` : '₹0 (CLEAR)';

    const html = `
        <div style="font-family: Arial, sans-serif; width:750px; padding:20px; color:#222;">
            <style>
                table { border-collapse: collapse; width: 100%; }
                tr { page-break-inside: avoid; break-inside: avoid; }
            </style>
            <div style="text-align:center; border-bottom:2px solid #003366; padding-bottom:10px; margin-bottom:15px;">
                <h2 style="margin:0;color:#003366;">🏢 ATC ALLINDIA TRANSPORT</h2>
                <div style="font-size:13px;color:#555;">Advance Payment Statement</div>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:12px;font-size:13px;">
                <div><b>Paid From (Party):</b> ${currentAdvanceParty}</div>
                <div><b>Date:</b> ${new Date().toLocaleDateString('en-IN')}</div>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:12px;">
                <thead>
                    <tr style="background:#003366;color:white;">
                        <th style="padding:6px;border:1px solid #ddd;">#</th>
                        <th style="padding:6px;border:1px solid #ddd;">Date</th>
                        <th style="padding:6px;border:1px solid #ddd;">Vehicle/Route</th>
                        <th style="padding:6px;border:1px solid #ddd;">A/C Name</th>
                        <th style="padding:6px;border:1px solid #ddd;">Received</th>
                        <th style="padding:6px;border:1px solid #ddd;">Paid To</th>
                        <th style="padding:6px;border:1px solid #ddd;">Paid</th>
                        <th style="padding:6px;border:1px solid #ddd;">Balance</th>
                    </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
            </table>
            <div style="margin-top:15px;border-top:1px solid #ccc;padding-top:10px;font-size:13px; page-break-inside: avoid;">
                <div><b>Total Received:</b> ₹${totalReceived.toLocaleString('en-IN')}</div>
                <div><b>Total Paid Out:</b> ₹${totalPaid.toLocaleString('en-IN')}</div>
                <div style="font-weight:bold;color:#b30000;margin-top:5px;">PENDING: ${pendingText}</div>
            </div>
        </div>`;

    const container = document.createElement('div');
    container.style.background = '#ffffff';
    container.style.width = '750px';
    container.innerHTML = html;
    document.body.appendChild(container);

    const opt = {
        margin: [5, 5, 14, 5], // neeche zyada margin taaki footer ke liye jagah bache
        filename: `Advance_${currentAdvanceParty}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] } // rows/blocks page ke beech mein na tootein
    };
    return { container, opt };
}

// Party ka poora advance statement ab PDF banakar WhatsApp (ya jo bhi share sheet available ho) se bhejna
async function shareAdvanceStatement() {
    if (!currentAdvanceParty || currentAdvanceEntries.length === 0) { alert("Is party ki koi entry nahi hai."); return; }
    const overlay = showPdfGeneratingOverlay();
    const { container, opt } = buildAdvancePdfElement();
    try {
        const pdf = await generateStatementPdf(container, opt);
        document.body.removeChild(container);
        hidePdfGeneratingOverlay(overlay);
        const blob = pdf.output('blob');
        await sharePdfOrDownload(blob, opt.filename);
    } catch (e) {
        if (container.parentNode) document.body.removeChild(container);
        hidePdfGeneratingOverlay(overlay);
        alert("PDF banane mein dikkat aayi.");
    }
}

// Party ki advance ledger ab PDF file mein export/download hogi (pehle CSV thi)
async function exportAdvanceCSV() {
    if (!currentAdvanceParty || currentAdvanceEntries.length === 0) { alert("Export karne ke liye koi entry nahi hai."); return; }
    const overlay = showPdfGeneratingOverlay();
    const { container, opt } = buildAdvancePdfElement();
    try {
        const pdf = await generateStatementPdf(container, opt);
        pdf.save(opt.filename);
    } finally {
        if (container.parentNode) document.body.removeChild(container);
        hidePdfGeneratingOverlay(overlay);
    }
}
// ================= END ADVANCE PAYMENT LEDGER =================

// ================= "WHAT'S NEW" UPDATE NOTIFICATION =================
// Jab bhi app ko naye features/fixes ke saath deploy karein, TWO CHIZEIN badlein:
//   1. Yahan APP_VERSION number badhayein (e.g. "1.1.0" -> "1.2.0")
//   2. Uske neeche ek naya changelog entry (version + notes) add karein
//   3. sw.js mein CACHE_NAME bhi badhayein (v1 -> v2...) taaki purana cache clear ho aur
//      sabko turant naye files milein
// Isse jaise hi koi user app kholega, agar unhone ye version pehle nahi dekha,
// to unhe ek popup mein "kya naya hai" dikh jayega.
const APP_VERSION = "1.10.0";
const APP_CHANGELOG = [
    {
        version: "1.10.0",
        notes: [
            "📲 WhatsApp commission message ab thoda behtar/professional design hua hai.",
            "🔔 Ab agar kisi trip ke liye commission message pehle bhi bheja ja chuka ho, to 2nd baar bhejte waqt REMINDER aur 3rd+ baar bhejte waqt STRONG/URGENT reminder confirm hoke jaayega.",
            "📍 View All Trips: WhatsApp bhejne ke baad wapas list par aane par ab TOP par nahi, balki usi trip card tak seedha scroll ho jayega jahan se aap gaye the.",
            "🐞 FIX: 10-digit numbers ab WhatsApp par automatically country code (91) ke saath khulenge — 'number detect nahi hota' wali dikkat theek ho gayi."
        ]
    },
    {
        version: "1.9.1",
        notes: [
            "🐞 FIX: Beelty PDF generate karte waqt 'jsPDFCtor is not a constructor' error aa raha tha — theek kar diya gaya."
        ]
    },
    {
        version: "1.9.0",
        notes: [
            "🐞 FIX: Loading Slip (Beelty) PDF mein beech mein aa rahi 'Review — Print Se Pehle Check Karein' patti hata di gayi.",
            "🐞 FIX: Beelty PDF ab hamesha SIRF EK PAGE ka banega — faltu/khaali dusra page ab nahi aayega.",
            "🐞 FIX: Beelty ke neeche ka hissa (footer/signature) ab overlap/clip nahi hoga, alignment theek kar diya gaya hai."
        ]
    },
    {
        version: "1.8.0",
        notes: [
            "📄 Statement PDF ke har page ke neeche ab Company Name + Address wala footer aur page number dikhega.",
            "🐞 FIX: Table rows ab page break ke beech mein nahi tootenge — pehle jo row 2 pages mein split hokar duplicate/ajeeb dikhta tha, wo theek ho gaya."
        ]
    },
    {
        version: "1.7.2",
        notes: [
            "🐞 REAL FIX: Statement PDF blank aane ka asli reason tha off-screen (-9999px) trick — ab bilkul purane Loading Slip PDF system jaisa normal tareeke se banega, saath mein 'Generating PDF...' overlay bhi dikhega."
        ]
    },
    {
        version: "1.7.1",
        notes: [
            "🐞 FIX: Advance aur Party statement PDF blank aa raha tha — ab sahi se content ke saath banega (jaise Loading Slip PDF pehle se banta tha)."
        ]
    },
    {
        version: "1.7.0",
        notes: [
            "📥📲 'Statement Bhejein' button ab PDF ko pehle device mein download/save karega, aur uske turant baad WhatsApp share menu bhi khol dega — dono ek saath."
        ]
    },
    {
        version: "1.6.0",
        notes: [
            "📄 Advance Payment aur Party Ledger dono ka 'Export' ab CSV ki jagah PDF file deta hai.",
            "📲 'Statement Bhejein' button ab PDF file seedha WhatsApp (ya share menu) se bhejta hai — sirf text nahi."
        ]
    },
    {
        version: "1.5.0",
        notes: [
            "✅ Advance Payment table mein Pending column ab HAR entry ka apna alag balance dikhayega (pehle jaisa cumulative running total nahi)."
        ]
    },
    {
        version: "1.4.0",
        notes: [
            "🏦 Advance Payment statement mein ab Received (green) amount ke neeche saaf A/C Name dikhega — pata chalega paisa kis account mein aaya."
        ]
    },
    {
        version: "1.3.0",
        notes: [
            "✅ Trip select karne par ab Contact Number, From, To sahi se auto-fill honge.",
            "🏦 A/C Name field mein ab purane accounts select ya naya type kar sakte hain.",
            "💬 WhatsApp statement mein ab ye bhi dikhega ki paisa konse A/C mein aaya.",
            "🧮 Agar Received khaali chhodkar seedha Paid mein amount daala (party ne khud driver ko pay kiya), to ye humare Paid/Pending calculation mein automatically nahi jodega — sirf record ke liye 'Party Direct Paid' badge ke saath dikhega.",
            "📱 Advance form ab mobile par ek-ek column mein saaf dikhega."
        ]
    },
    {
        version: "1.2.0",
        notes: [
            "🚚 Advance Payment form ab behtar order mein hai: Vehicle No → Date → Contact Number → From → To.",
            "🔍 Vehicle No type karte hi (jaise RJ) matching gadi numbers suggest honge.",
            "📋 Gadi select karte hi uski purani trips dikhengi — select karne par Date/From/To/Contact apne aap bhar jayenge (chaho to edit bhi kar sakte ho)."
        ]
    },
    {
        version: "1.1.0",
        notes: [
            "🆕 Naya section: <b>Advance Payment (SMT)</b> — ab SMT jaisi party se aane wala advance aur driver/gadi-malik ko diya gaya payment ek hi jagah track kar sakte hain.",
            "📊 Har party ka Received / Paid / Pending total ab ek nazar mein dikhega.",
            "📄 Advance statement WhatsApp par bhejne aur CSV export karne ki suvidha bhi add hui hai.",
            "🔔 Ab jab bhi app update hogi, aapko turant pata chal jayega ki kya naya hai (ye popup)."
        ]
    }
    // Agla update yahan upar naya object add karke likhein
];

function checkForAppUpdates() {
    const lastSeen = localStorage.getItem('atc_last_seen_version');
    if (lastSeen === APP_VERSION) return; // Ye version pehle hi dekh chuke hain

    const latest = APP_CHANGELOG.find(c => c.version === APP_VERSION);
    const body = document.getElementById('whatsNewBody');
    if (body) {
        if (latest && latest.notes && latest.notes.length) {
            body.innerHTML = `<p class="text-muted small mb-2">Version ${APP_VERSION}</p><ul class="mb-0 ps-3">${latest.notes.map(n => `<li class="mb-2">${n}</li>`).join('')}</ul>`;
        } else {
            body.innerHTML = `<p class="mb-0">App update ho chuki hai (Version ${APP_VERSION}). Kuch fixes aur improvements add hue hain.</p>`;
        }
    }

    const modalEl = document.getElementById('whatsNewModal');
    if (modalEl && window.bootstrap) {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }
    localStorage.setItem('atc_last_seen_version', APP_VERSION);
}

document.addEventListener('DOMContentLoaded', checkForAppUpdates);
// ================= END "WHAT'S NEW" UPDATE NOTIFICATION =================

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

    const navBar = document.getElementById('wizardNavBar');

    if (isReview) {
        allSteps.forEach(el => el.classList.add('wizard-active'));
        document.getElementById('receipt-to-print').classList.remove('wizard-mode'); // sab dikhao, full preview
        // FIX: Review step par "Review — Print Se Pehle Check Karein" patti hata di, aur nav bar ko
        // sticky se static kar diya (class: review-mode) taaki ye beelty ke content ke upar
        // overlap na ho — Back button phir bhi kaam karega, bas ab neeche normal jagah par dikhega.
        navBar.classList.add('review-mode');
        document.getElementById('wizardStepLabel').style.display = 'none';
    } else {
        navBar.style.display = 'block';
        navBar.classList.remove('review-mode');
        document.getElementById('wizardStepLabel').style.display = 'block';
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

    // --- FIX: "Review — Print Se Pehle Check Karein" patti aur Back/Next/Submit buttons
    // PDF mein kabhi kabhi bleed ho jaate the (sticky positioning ki wajah se). Capture se
    // pehle inhe poori tarah hide kar dete hain taaki PDF sirf saaf beelty ho, koi UI bar nahi.
    const navBar = document.getElementById('wizardNavBar');
    const actionBar = document.querySelector('.slip-action-bar');
    const navBarOriginalDisplay = navBar ? navBar.style.display : null;
    const actionBarOriginalDisplay = actionBar ? actionBar.style.display : null;
    if (navBar) navBar.style.display = 'none';
    if (actionBar) actionBar.style.display = 'none';

    // --- FIX: MOBILE SCALING ISSUES ---
    const originalTransform = element.style.transform;
    const originalMargin = element.style.margin;
    const originalPosition = element.style.position;
    const originalHeight = element.style.height;

    element.style.transform = "none"; // Scale reset to 100%
    element.style.margin = "0 auto";
    element.style.position = "relative";
    element.style.width = "794px"; // Standard A4 Width
    // FIX: Fixed height hata kar content ke hisaab se hone dete hain, warna neeche ka
    // content (footer/signatures) clip ya overlap ho raha tha.
    element.style.height = "auto";

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
        }
    };

    try {
        // --- FIX: EK HI PAGE KA PDF ---
        // Pehle poore element ka canvas banate hain, phir uske exact height ke barabar
        // ek custom-size PDF page banate hain (A4 fixed size nahi) — isse content chahe
        // thoda lamba/chota ho, PDF hamesha SIRF EK PAGE ka banega, koi khaali/adhoora
        // dusra page nahi aayega.
        // NOTE: 'new jsPDF(...)' seedha use karne par "jsPDFCtor is not a constructor"
        // error aa raha tha (global naam library load order/version ke hisaab se badal
        // jaata hai). Isliye ab html2pdf ke apne worker chain ka hi jsPDF instance use
        // kar rahe hain (jaisa is file mein generateStatementPdf() pehle se karta hai) —
        // ye tareeka guaranteed available hai, global window.jsPDF par depend nahi karta.
        const worker = html2pdf().set(opt).from(element).toCanvas();
        const canvas = await worker.get('canvas');

        const pdfWidthMM = 210; // A4 width in mm
        const pdfHeightMM = (canvas.height * pdfWidthMM) / canvas.width;

        // Worker ke jsPDF page-format ko content ke exact size jitna set kar dete hain,
        // taaki bina kisi slicing ke sirf EK hi page bane
        const pdf = await worker
            .set({ jsPDF: { unit: 'mm', format: [pdfWidthMM, pdfHeightMM], orientation: 'portrait' } })
            .toPdf()
            .get('pdf');

        const pdfBase64 = pdf.output('datauristring').split(',')[1];

        // Save PDF to Device
        pdf.save(opt.filename);

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
        element.style.height = originalHeight;

        // Nav bar aur action bar wapas dikhao
        if (navBar) navBar.style.display = navBarOriginalDisplay;
        if (actionBar) actionBar.style.display = actionBarOriginalDisplay;

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

// ================= DAILY FOLLOW-UP (Pending Commission Roz Ka Reminder) =================
// Saare ABHI TAK PENDING trips ko phone number ke hisaab se group karta hai (jitne bhi
// vehicles/trips ek driver/owner ke pending hain, sab jodkar), taaki roz subah ek hi jagah se
// sabko WhatsApp bhej sakein ya call kar sakein — bina kisi paid API/service ke.
let _followupGroups = {};

async function loadDailyFollowup() {
    const container = document.getElementById('followupCardsContainer');
    if (!container) return;
    container.innerHTML = '<div class="text-center p-5"><div class="spinner-border text-primary spinner-border-sm"></div><br>Pending Calculate ho raha hai...</div>';

    // Agar data abhi tak load nahi hua (page turant khola ho), fresh mangwa lo
    if (!allTripsData || allTripsData.length === 0) {
        try {
            const res = await fetch(scriptURL);
            allTripsData = await res.json();
        } catch (e) {
            container.innerHTML = '<div class="text-center p-3 text-danger">Data load nahi ho saka. Internet check karke Refresh dabayein.</div>';
            return;
        }
    }

    _followupGroups = {};

    allTripsData.forEach(t => {
        const isCollected = (String(t['_colG'] || "").toLowerCase().trim() === "yes");
        if (isCollected) return;

        const amt = parseFloat(t['Amount']) || 0;
        if (amt <= 0) return;

        // Owner number ko priority do — taaki ek hi owner ki saari gaadiyan EK card mein group ho jayein.
        // Agar owner ka number nahi hai, tabhi driver number use karo (warna wo trip kisi group mein nahi aayega).
        const driverPhone = String(t['Driver No'] || "").replace(/\D/g, '').slice(-10);
        const ownerPhone = String(t['_owner'] || "").replace(/\D/g, '').slice(-10);
        const phone = ownerPhone.length === 10 ? ownerPhone : (driverPhone.length === 10 ? driverPhone : "");
        if (!phone) return; // Bina number ke message/call nahi ja sakta

        // Party Name yahan jaan-boojhkar NAHI liya — wo sirf maal bhejne wale ka naam hota hai,
        // gaadi Owner/Driver ka nahi. Agar Owner ka naam missing ho to Driver Name par jao, warna Vehicle No dikhao.
        const name = t['Lorry Owner Name'] || t['Driver Name'] || t['Vehicle No'];

        if (!_followupGroups[phone]) {
            _followupGroups[phone] = { phone, name, vehicles: new Set(), totalAmt: 0, oldestDate: null, trips: [] };
        }
        const g = _followupGroups[phone];
        g.totalAmt += amt;
        g.vehicles.add(t['Vehicle No']);
        g.trips.push(t);

        const d = parseSheetDate(t['Date']);
        if (d && (!g.oldestDate || d < g.oldestDate)) g.oldestDate = d;
    });

    // Sabse zyada pending amount wale sabse upar
    const list = Object.values(_followupGroups).sort((a, b) => b.totalAmt - a.totalAmt);

    document.getElementById('followupCount').innerText = list.length;
    document.getElementById('followupTotal').innerText = '₹' + list.reduce((s, g) => s + g.totalAmt, 0).toLocaleString('en-IN');

    if (list.length === 0) {
        container.innerHTML = '<div class="text-center p-4 text-success">🎉 Koi bhi commission pending nahi hai!</div>';
        return;
    }

    const sentToday = getFollowupSentMap();
    container.innerHTML = '';

    list.forEach(g => {
        const days = g.oldestDate ? Math.floor((new Date() - g.oldestDate) / 86400000) : 0;
        const isSent = !!sentToday[g.phone];
        const vNoList = [...g.vehicles].join(', ');

        container.insertAdjacentHTML('beforeend', `
            <div class="v-list-item shadow-sm mb-3 p-3" style="background:white;border-radius:12px;border-left:5px solid ${isSent ? '#28a745' : '#dc3545'};">
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <div class="fw-bold" style="color:#003366;">${safeAttr(g.name)}</div>
                        <small class="text-muted"><i class="bi bi-truck"></i> ${safeAttr(vNoList)}</small><br>
                        <small class="text-muted"><i class="bi bi-clock"></i> ${days} din se pending</small>
                    </div>
                    <div class="text-end">
                        <div class="fw-bold text-danger">₹${g.totalAmt.toLocaleString('en-IN')}</div>
                        ${isSent ? '<span class="badge bg-success-subtle text-success mt-1" style="font-size:10px;">✅ Aaj bheja</span>' : ''}
                    </div>
                </div>
                <div class="d-flex gap-2 mt-2">
                    <button class="btn btn-sm btn-success flex-fill" onclick="sendFollowupWhatsapp('${g.phone}')">
                        <i class="bi bi-whatsapp"></i> Message
                    </button>
                    <a href="tel:+91${g.phone}" class="btn btn-sm btn-outline-primary flex-fill" onclick="markFollowupSent('${g.phone}')">
                        <i class="bi bi-telephone-fill"></i> Call
                    </a>
                </div>
            </div>
        `);
    });
}

// "Aaj kisko msg/call gaya" — device ke localStorage mein track karta hai, roz naya din aate hi reset ho jaata hai
function getFollowupSentMap() {
    const todayKey = new Date().toLocaleDateString('en-GB');
    try {
        const stored = JSON.parse(localStorage.getItem('atc_followup_sent') || '{}');
        if (stored._date !== todayKey) return {};
        return stored;
    } catch (e) { return {}; }
}
function markFollowupSent(phone) {
    const todayKey = new Date().toLocaleDateString('en-GB');
    let stored;
    try { stored = JSON.parse(localStorage.getItem('atc_followup_sent') || '{}'); } catch (e) { stored = {}; }
    if (stored._date !== todayKey) stored = { _date: todayKey };
    stored[phone] = true;
    localStorage.setItem('atc_followup_sent', JSON.stringify(stored));
    loadDailyFollowup(); // List refresh taaki card green ho jaye
}

// Ek party ke SAARE pending trips jodkar ek WhatsApp message banata hai aur bhejta hai
function sendFollowupWhatsapp(phone) {
    const g = _followupGroups[phone];
    if (!g) return;

    const cleanPhone = formatWhatsAppPhone(phone);
    if (cleanPhone.length < 12) {
        alert("⚠️ Ye number sahi format mein nahi hai: " + phone);
        return;
    }

    let historyList = "";
    g.trips.forEach(t => {
        const v = String(t['Vehicle No'] || "").replace(/&/g, "and");
        const f = String(t['From'] || "N/A").replace(/&/g, "and");
        const rt = String(t['To'] || "N/A").replace(/&/g, "and");
        const a = parseFloat(t['Amount'] || 0);
        const dt = t['Date'] || "No Date";
        historyList += `▪️ *${v}* (${dt})\n   📍 ${f} ➔ ${rt}\n   💰 Fare: ₹${a}\n\n`;
    });

    const messageBody = `🏢 *ATC ALLINDIA TRANSPORT*
==========================
🔔 *DAILY COMMISSION REMINDER*

Namaste ${g.name},
Aapke naam par nimnlikhit trips ka commission abhi tak PENDING hai:

--------------------------
${historyList}--------------------------

🛑 *TOTAL PENDING: ₹${g.totalAmt.toLocaleString('en-IN')}*

💸 Commission bhej kar SS dein 🙏
📲 UPI: *8888664019*

_Kripya jald se jald clear karein. Dhanyawad!_`;

    const encodedMsg = encodeURIComponent(messageBody);
    const whatsappURL = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMsg}`;

    markFollowupSent(phone);

    try {
        window.location.href = whatsappURL;
    } catch (e) {
        window.open(whatsappURL, '_blank');
    }
}

function formatINR(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(amount);
}