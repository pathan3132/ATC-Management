// IS LINE KO SAHI SE CHECK KAREIN - Sirf URL hona chahiye
const scriptURL = 'https://script.google.com/macros/s/AKfycbzin-51q_OK2kEcEdguAkEhxMQOGgpzuQmyioXL2NTzO4ysvSSZNDXG3pEzw_5wvq46/exec';

// --- INITIALIZE ---
window.onload = () => {
    updateGreeting();
    loadHomeRecent();
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
    btn.innerHTML = 'SAVING...'; btn.disabled = true;

    const formData = {
        date: document.getElementById('date').value,
        vNo: document.getElementById('vNo').value,
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
        await fetch(scriptURL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(formData) });
        alert("✅ Trip Saved Successfully!");
        document.getElementById('tripForm').reset();
    } catch (e) { alert("Error!"); }
    btn.innerHTML = 'SUBMIT TO GOOGLE SHEET'; btn.disabled = false;
}

// --- DATA FETCHING ---
async function loadHomeRecent() {
    const container = document.getElementById('homeRecentTrips');
    try {
        // Sirf aakhri 5 trips mangwayein poora data nahi
        const response = await fetch(scriptURL + "?action=getRecent");
        const data = await response.json();
        container.innerHTML = '';
        data.forEach(trip => {
            container.insertAdjacentHTML('beforeend', `
                <div class="peek-card shadow-sm">
                    <div><h6 class="mb-0 fw-bold">${trip['Vehicle No'] || 'N/A'}</h6><small class="text-muted">${trip['To'] || '-'}</small></div>
                    <div class="text-end"><div class="fw-bold text-primary">₹${trip['Amount'] || 0}</div><small style="font-size: 10px;">${trip['Date'] || '-'}</small></div>
                </div>`);
        });
    } catch (e) { container.innerHTML = 'No recent data.'; }
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
    // Agar date DD-MM-YYYY format mein hai (e.g. 23-06-2026)
    let parts = dateStr.split('-');
    if (parts.length === 3) {
        // parts[2] = Year, parts[1]-1 = Month (0-11), parts[0] = Day
        return new Date(parts[2], parts[1] - 1, parts[0]);
    }
    return new Date(dateStr); // Fallback agar format alag ho
}

async function loadTrips() {
    const container = document.getElementById('tripCardsContainer');
    const summaryBar = document.getElementById('tripSummaryBar');
    container.innerHTML = '<div class="text-center p-5"><div class="spinner-border text-primary spinner-border-sm"></div></div>';
    
    try {
        const response = await fetch(scriptURL);
        const data = await response.json();
        container.innerHTML = '';
        summaryBar.classList.remove('hidden');

        let tCount = 0, colCount = 0, penCount = 0;
        
        // Aaj ki date (Time 00:00:00 kar rahe hain taaki sirf din count hon)
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        data.forEach(trip => {
            let isCollected = (String(trip['_colG'] || "").toLowerCase().trim() === "yes");
            let collectorName = trip['_colH'] || "Not Specified";
            let amt = trip['Amount'] || 0;
            
            // --- Days Pending Calculation Fix ---
            let daysText = "";
            let tripDate = parseSheetDate(trip['Date']);
            
            if (tripDate && !isCollected) {
                tripDate.setHours(0, 0, 0, 0);
                
                // Difference in milliseconds
                let diffTime = today - tripDate;
                // Convert to days
                let diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                
                // Sirf tab dikhaye jab 1 din ya usse zyada ho gaya ho
                if (diffDays >= 1) {
                    if (diffDays > 15) {
                        daysText = `<span class="overdue-tag bg-danger text-white"><i class="bi bi-exclamation-triangle"></i> Pending ${diffDays} Days</span>`;
                    } else {
                        daysText = `<span class="overdue-tag bg-warning text-dark"><i class="bi bi-clock"></i> ${diffDays} Days Pending</span>`;
                    }
                }
            }

            tCount++;
            if(isCollected) colCount++; else penCount++;

            container.insertAdjacentHTML('beforeend', `
                <div class="trip-card shadow-sm ${isCollected ? 'status-collected' : 'status-pending'}">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <h5 class="fw-bold mb-0" style="letter-spacing:0.5px;">${trip['Vehicle No']}</h5>
                            <small class="text-muted" style="font-size:11px">${trip['Date']}</small>
                            <div class="mt-1">${daysText}</div>
                        </div>
                        <div class="text-end">
                            <span class="badge ${isCollected ? 'badge-soft-success' : 'badge-soft-danger'}">
                                ${isCollected ? 'COLLECTED' : 'PENDING'}
                            </span>
                            <div class="collector-tag">
                                <i class="bi bi-person-fill"></i> ${isCollected ? collectorName : 'Waiting'}
                            </div>
                            <div class="fw-bold text-primary h5 mt-1 mb-0">₹${amt}</div>
                        </div>
                    </div>

                    <div class="route-timeline">
                        <div class="point point-start"></div>
                        <div class="small fw-bold text-uppercase" style="color: #444;">${trip['From']}</div>
                        <div style="height:12px"></div>
                        <div class="point point-end"></div>
                        <div class="small fw-bold text-uppercase" style="color: #444;">${trip['To']}</div>
                    </div>

                    <div class="d-flex justify-content-between align-items-center mt-2 pt-2 border-top">
                        <div class="small">
                            <span class="text-muted" style="font-size:10px;">PARTY</span><br>
                            <span class="fw-bold">${trip['Party Name'] || '-'}</span>
                        </div>
                        <div class="d-flex gap-2">
                            <button class="action-btn-circle btn-whatsapp" onclick="shareTrip('${trip['Vehicle No']}', '${trip['From']}', '${trip['To']}', '${trip['Party Name']}', '${amt}', '${trip['Date']}')">
                                <i class="bi bi-whatsapp"></i>
                            </button>
                            <button class="action-btn-circle">
                                <i class="bi bi-three-dots-vertical"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `);
        });

        document.getElementById('sumCount').innerText = tCount;
        document.getElementById('sumColCount').innerText = colCount;
        document.getElementById('sumPenCount').innerText = penCount;

    } catch (e) { 
        container.innerHTML = '<div class="text-center p-5">Error loading data.</div>';
    }
}

// WhatsApp Share
function shareTrip(vNo, from, to, party, amt, date) {
    let msg = `*ATC Trip Details*%0A*Date:* ${date}%0A*Vehicle:* ${vNo}%0A*Route:* ${from} to ${to}%0A*Party:* ${party}%0A*Amount:* ₹${amt}`;
    window.open(`https://wa.me/?text=${msg}`, '_blank');
}

// --- VEHICLE SECTION LOGIC ---

async function loadVehicles() {
    const container = document.getElementById('vehicleCardsContainer');
    container.innerHTML = '<div class="text-center p-5"><div class="spinner-border text-primary"></div><br>Reading Fleet...</div>';
    
    try {
        const vResponse = await fetch(scriptURL + "?action=getVehicles");
        const vehicleList = await vResponse.json();
        
        container.innerHTML = '';
        vehicleList.forEach((vNo, index) => {
            container.insertAdjacentHTML('beforeend', `
                <div class="v-list-item shadow-sm">
                    <div class="v-item-header" onclick="toggleDetails('details_${index}', '${vNo}')">
                        <span><i class="bi bi-truck me-2 text-info"></i> ${vNo}</span>
                        <i class="bi bi-chevron-down small"></i>
                    </div>
                    <div id="details_${index}" class="v-item-details hidden">
                        <!-- Stats Section -->
                        <div id="stats_${vNo}" class="row g-2 mb-3"></div>

                        <div class="btn-group-custom mb-3">
                            <button class="btn btn-primary btn-sm flex-fill" onclick="triggerUpload('${vNo}')">
                                <i class="bi bi-cloud-upload"></i> Upload Doc
                            </button>
                        </div>

                        <!-- History Section -->
                        <ul class="nav nav-tabs mb-2" role="tablist" style="font-size:12px;">
                            <li class="nav-item"><a class="nav-link active" data-bs-toggle="tab" href="#hist_${index}">Trip History</a></li>
                            <li class="nav-item"><a class="nav-link" data-bs-toggle="tab" href="#docs_${index}">Documents</a></li>
                        </ul>
                        
                        <div class="tab-content">
                            <div id="hist_${index}" class="tab-pane fade show active">
                                <div id="historyList_${vNo}" class="history-container">
                                    <small class="text-muted">Loading history...</small>
                                </div>
                            </div>
                            <div id="docs_${index}" class="tab-pane fade">
                                <div id="docList_${vNo}" class="py-2">
                                    <small class="text-muted">Loading docs...</small>
                                </div>
                            </div>
                        </div>
                        <input type="file" id="file_${vNo}" class="hidden" onchange="uploadFile(this, '${vNo}')">
                    </div>
                </div>
            `);
        });
    } catch (e) { container.innerHTML = 'Error loading vehicles.'; }
}


// Detail khulne par us gadi ke documents fetch karein
async function toggleDetails(id, vNo) {
    const el = document.getElementById(id);
    if(el.classList.contains('hidden')) {
        el.classList.remove('hidden');
        fetchVehicleDocs(vNo);
        fetchVehicleHistory(vNo); // Naya function call
    } else {
        el.classList.add('hidden');
    }
}

async function fetchVehicleHistory(vNo) {
    const histContainer = document.getElementById(`historyList_${vNo}`);
    const statsContainer = document.getElementById(`stats_${vNo}`);
    
    try {
        const res = await fetch(scriptURL + `?action=getVehicleHistory&vNo=${encodeURIComponent(vNo)}`);
        const history = await res.json();
        
        if(!history || history.length === 0) {
            histContainer.innerHTML = '<div class="text-center p-3 text-muted">No history found</div>';
            return;
        }

        let totalBus = 0, totalPend = 0;
        history.forEach(t => {
            let amt = parseFloat(t['Amount']) || 0;
            totalBus += amt;
            if(String(t['_status']).toLowerCase() !== 'yes') totalPend += amt;
        });

        // Stylish Stats
        statsContainer.innerHTML = `
            <div class="col-4">
                <div class="v-stats-card">
                    <span class="v-stats-label">Trips</span>
                    <span class="v-stats-value">${history.length}</span>
                </div>
            </div>
            <div class="col-4">
                <div class="v-stats-card">
                    <span class="v-stats-label">Business</span>
                    <span class="v-stats-value text-success">₹${totalBus}</span>
                </div>
            </div>
            <div class="col-4">
                <div class="v-stats-card">
                    <span class="v-stats-label">Balance</span>
                    <span class="v-stats-value text-danger">₹${totalPend}</span>
                </div>
            </div>
        `;

        // Modern History Items
        let html = history.map(trip => `
            <div class="history-item-new shadow-sm">
                <div class="d-flex justify-content-between">
                    <span class="fw-bold" style="font-size:12px">${trip['From']} → ${trip['To']}</span>
                    <span class="text-primary fw-bold" style="font-size:12px">₹${trip['Amount']}</span>
                </div>
                <div class="d-flex justify-content-between align-items-center mt-1">
                    <small class="text-muted" style="font-size:10px">${trip['Date']} | ${trip['Party Name']}</small>
                    <span class="badge ${String(trip['_status']).toLowerCase() === 'yes' ? 'badge-soft-success' : 'badge-soft-danger'}">
                        ${String(trip['_status']).toLowerCase() === 'yes' ? 'Received' : 'Pending'}
                    </span>
                </div>
            </div>
        `).join('');
        
        histContainer.innerHTML = `<div style="max-height:350px; overflow-y:auto; padding:5px;">${html}</div>`;
        
    } catch (e) { histContainer.innerHTML = 'Error...'; }
}


async function fetchVehicleDocs(vNo) {
    const docContainer = document.getElementById(`docList_${vNo}`);
    docContainer.innerHTML = '<div class="spinner-border spinner-border-sm text-info"></div>';
    
    try {
        const res = await fetch(scriptURL + `?action=getDocs&vNo=${encodeURIComponent(vNo)}`);
        const docs = await res.json();
        docContainer.innerHTML = '';
        
        if(!docs || docs.length === 0) {
            docContainer.innerHTML = '<p class="small text-muted py-2">No documents found.</p>';
        } else {
            docs.forEach((doc, i) => {
                docContainer.insertAdjacentHTML('beforeend', `
                    <a href="${doc.url}" target="_blank" class="doc-link-item">
                        <i class="bi bi-file-earmark-text me-2 text-primary"></i> 
                        ${doc.name} 
                        <span class="float-end text-muted small"><i class="bi bi-box-arrow-up-right"></i></span>
                    </a>
                `);
            });
        }
    } catch (e) {
        docContainer.innerHTML = 'Error loading docs.';
    }
}

function triggerUpload(vNo) { document.getElementById(`file_${vNo}`).click(); }

async function uploadFile(input, vNo) {
    const file = input.files[0];
    if (!file) return;

    const btn = input.closest('.v-item-details').querySelector('.btn-primary');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> UPLOADING...';
    btn.disabled = true;

    const reader = new FileReader();
    reader.onload = function() {
        const base64 = reader.result.split(',')[1];
        const payload = {
            action: "uploadDocument",
            vNo: vNo,
            fileName: file.name, // Original file name bhejein
            base64: base64,
            mimeType: file.type
        };

        const xhr = new XMLHttpRequest();
        xhr.open("POST", scriptURL, true);
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                alert("File Uploaded: " + file.name);
                setTimeout(() => {
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                    fetchVehicleDocs(vNo); 
                }, 3000);
            }
        };
        xhr.send(JSON.stringify(payload));
    };
    reader.readAsDataURL(file);
}

// --- ACCOUNTS CALCULATION (Hisaab-Kitaab) ---
async function updateAccounts() {
    const bizEl = document.getElementById('acc-total-business');
    const pendEl = document.getElementById('acc-total-pending');
    const recdEl = document.getElementById('acc-total-received');
    const listEl = document.getElementById('collector-list');

    try {
        const response = await fetch(scriptURL);
        const data = await response.json();
        
        let totalBus = 0, totalPend = 0, totalRecd = 0;
        let collectorMap = {};

        data.forEach(trip => {
            // Amount ko number mein badlein
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

        // UI Update
        bizEl.innerText = "₹" + totalBus.toLocaleString('en-IN');
        pendEl.innerText = "₹" + totalPend.toLocaleString('en-IN');
        recdEl.innerText = "₹" + totalRecd.toLocaleString('en-IN');

        // Collector List Update
        let listHtml = "";
        for (let name in collectorMap) {
            listHtml += `
                <div class="list-group-item d-flex justify-content-between align-items-center small">
                    <span><i class="bi bi-person-circle me-2"></i>${name}</span>
                    <b class="text-success">₹${collectorMap[name].toLocaleString('en-IN')}</b>
                </div>`;
        }
        listEl.innerHTML = listHtml || '<div class="p-3 text-center small text-muted">No collections yet</div>';

    } catch (e) { console.error("Accounts Error:", e); }
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
