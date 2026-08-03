var SHEET_ID = "1D-0LKTCyKAbOREkpnKInPRWlT9ikRt2W2Po49AnIbR0";
var MAIN_FOLDER_ID = "1a0dj2lYHt2KZsd5fx6a51QhrmQd7OEWj"; // Documents (RC/Docs) ke liye
var SLIP_FOLDER_ID = "1VlTuOCl2NxAieP5PF9NcTcNNeIBcXojz"; // Loading Slips (PDFs) ke liye

function doGet(e) {
  try {
    return handleGet(e);
  } catch (err) {
    return jsonResponse({ error: "Server Error: " + err.toString() });
  }
}

function handleGet(e) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var action = e.parameter.action;
  var sheet = ss.getSheetByName("Data_log");
  
  if (!sheet) return jsonResponse({error: "Data_log sheet not found"});
  var lastRow = sheet.getLastRow();

  // 1. UNIQUE VEHICLES
  if (action === "getVehicles") {
    if (lastRow <= 1) return jsonResponse([]);
    var values = sheet.getRange(2, 2, lastRow - 1, 1).getValues(); 
    var vehicles = [...new Set(values.map(r => r[0].toString().trim().toUpperCase()))].filter(v => v !== "");
    return jsonResponse(vehicles.sort());
  }

  // 2. GET VEHICLE DOCS (From Vehicle_Docs Sheet - Fixed Undefined)
  if (action === "getDocs") {
    var docSheet = ss.getSheetByName("Vehicle_Docs");
    if (!docSheet || docSheet.getLastRow() < 2) return jsonResponse([]);
    var data = docSheet.getDataRange().getValues();
    var searchVNo = e.parameter.vNo.toUpperCase();
    var docs = [];
    for (var i = 1; i < data.length; i++) {
      if (data[i][0].toString().toUpperCase() == searchVNo) {
        docs.push({ 
          url: data[i][1], 
          name: data[i][2] || "Unnamed File",
          date: data[i][3] 
        });
      }
    }
    return jsonResponse(docs);
  }

  // 3. VEHICLE HISTORY
  if (action === "getVehicleHistory") {
    var searchVNo = e.parameter.vNo.toUpperCase();
    var dataAll = sheet.getDataRange().getValues();
    var headers = dataAll[0];
    var history = [];
    for (var i = dataAll.length - 1; i >= 1; i--) {
      if (dataAll[i][1].toString().toUpperCase() === searchVNo) {
        var obj = {};
        headers.forEach((h, idx) => {
          obj[h] = dataAll[i][idx];
          if (idx === 6) obj["_status"] = dataAll[i][idx];
        });
        history.push(obj);
      }
    }
    return jsonResponse(history);
  }

  // 4. SEARCH TRIPS FOR BEELTY
  if (action === "getTripsByVehicle") {
    var vNo = e.parameter.vNo.toUpperCase().trim();
    var dataAll = sheet.getDataRange().getValues();
    var headers = dataAll[0];
    var results = [];
    for (var i = dataAll.length - 1; i >= 1; i--) {
      if (dataAll[i][1].toString().toUpperCase().trim() === vNo) {
        var obj = { rowNumber: i + 1 };
        headers.forEach((h, index) => { obj[h] = dataAll[i][index]; });
        results.push(obj);
      }
    }
    return jsonResponse(results);
  }

  // 5. SLIP ARCHIVE
  if (action === "listSlips") {
    var archiveSheet = ss.getSheetByName("Slip_Archive");
    if (!archiveSheet || archiveSheet.getLastRow() < 2) return jsonResponse([]);
    var data = archiveSheet.getDataRange().getValues();
    var list = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      list.push({
        rowNumber: i + 1,
        name: row[0], id: row[1],
        date: Utilities.formatDate(new Date(row[2]), "GMT+5:30", "dd-MM-yyyy"),
        url: row[3],
        formData: row[4] || "" // Saved fields (JSON) — dobara Edit karne ke liye
      });
    }
    list.reverse();
    return jsonResponse(list);
  }

  // 6. PARTY LEDGER: LIST OF ALL PARTIES (with running balance summary)
  if (action === "getPartyList") {
    var ledgerSheet = ss.getSheetByName("Party_Ledger");
    var parties = {}; // name -> {debit, credit}
    if (ledgerSheet && ledgerSheet.getLastRow() > 1) {
      var lData = ledgerSheet.getDataRange().getValues();
      for (var i = 1; i < lData.length; i++) {
        var pName = lData[i][2] ? lData[i][2].toString().trim() : "";
        if (!pName) continue;
        if (!parties[pName]) parties[pName] = { debit: 0, credit: 0 };
        parties[pName].debit += parseFloat(lData[i][5]) || 0;
        parties[pName].credit += parseFloat(lData[i][6]) || 0;
      }
    }
    // Data_log ke Party Name column se bhi naam utha lein (auto-suggest ke liye), balance 0 rahega unke liye
    if (lastRow > 1) {
      var dData = sheet.getRange(2, 1, lastRow - 1, 13).getValues(); // Column M = Party Name (index 12)
      dData.forEach(function(r) {
        var pName = r[12] ? r[12].toString().trim() : "";
        if (pName && !parties[pName]) parties[pName] = { debit: 0, credit: 0 };
      });
    }
    var list = [];
    for (var name in parties) {
      list.push({ name: name, debit: parties[name].debit, credit: parties[name].credit, balance: parties[name].debit - parties[name].credit });
    }
    list.sort(function(a, b) { return a.name.localeCompare(b.name); });
    return jsonResponse(list);
  }

  // 7. PARTY LEDGER: ENTRIES FOR ONE PARTY
  if (action === "getPartyLedger") {
    var ledgerSheet = ss.getSheetByName("Party_Ledger");
    var searchParty = (e.parameter.party || "").toUpperCase().trim();
    var entries = [];
    if (ledgerSheet && ledgerSheet.getLastRow() > 1) {
      var lData = ledgerSheet.getDataRange().getValues();
      for (var i = 1; i < lData.length; i++) {
        var pName = lData[i][2] ? lData[i][2].toString().toUpperCase().trim() : "";
        if (pName === searchParty) {
          entries.push({
            rowNumber: i + 1,
            srNo: lData[i][0],
            date: lData[i][1],
            party: lData[i][2],
            vNo: lData[i][3],
            description: lData[i][4],
            debit: parseFloat(lData[i][5]) || 0,
            credit: parseFloat(lData[i][6]) || 0
          });
        }
      }
    }
    // Chronological order mein sort karein (date ke hisaab se) taaki running balance sahi rahe,
    // agar date same ho to jis order mein add kiya usi order mein rakhein
    entries.sort(function(a, b) {
      var dA = parsePartyDate(a.date), dB = parsePartyDate(b.date);
      if (dA && dB && dA.getTime() !== dB.getTime()) return dA - dB;
      return a.rowNumber - b.rowNumber;
    });
    return jsonResponse(entries);
  }

  // 8b. ADVANCE LEDGER: LIST OF ALL "PAID FROM" PARTIES (jaise SMT) with Received/Paid summary
  if (action === "getAdvancePartyList") {
    var advSheet = ss.getSheetByName("Advance_Ledger");
    var parties = {}; // partyName -> {received, paid}
    if (advSheet && advSheet.getLastRow() > 1) {
      var aData = advSheet.getDataRange().getValues();
      for (var i = 1; i < aData.length; i++) {
        var pName = aData[i][6] ? aData[i][6].toString().trim() : ""; // Col G = Paid From (Party)
        if (!pName) continue;
        if (!parties[pName]) parties[pName] = { received: 0, paid: 0 };
        var recVal = parseFloat(aData[i][8]) || 0;  // Col I = Received Advance
        var paidVal = parseFloat(aData[i][10]) || 0; // Col K = Paid Advance
        parties[pName].received += recVal;
        // Agar is row mein Received 0 hai aur Paid > 0 hai, iska matlab party ne DIRECT driver ko pay kiya —
        // hamare account se nahi gaya, isliye ye hamare "Paid" total mein nahi jodenge
        if (!(recVal === 0 && paidVal > 0)) parties[pName].paid += paidVal;
      }
    }
    var list = [];
    for (var name in parties) {
      list.push({
        name: name,
        received: parties[name].received,
        paid: parties[name].paid,
        pending: parties[name].received - parties[name].paid
      });
    }
    list.sort(function(a, b) { return a.name.localeCompare(b.name); });
    return jsonResponse(list);
  }

  // 8c. ADVANCE LEDGER: ENTRIES FOR ONE "PAID FROM" PARTY
  if (action === "getAdvanceLedger") {
    var advSheet = ss.getSheetByName("Advance_Ledger");
    var searchParty = (e.parameter.party || "").toUpperCase().trim();
    var entries = [];
    if (advSheet && advSheet.getLastRow() > 1) {
      var aData = advSheet.getDataRange().getValues();
      for (var i = 1; i < aData.length; i++) {
        var pName = aData[i][6] ? aData[i][6].toString().toUpperCase().trim() : "";
        if (pName === searchParty) {
          entries.push({
            rowNumber: i + 1,
            srNo: aData[i][0],
            date: aData[i][1],
            vNo: aData[i][2],
            drNo: aData[i][3],
            from: aData[i][4],
            to: aData[i][5],
            party: aData[i][6],
            acName: aData[i][7],
            received: parseFloat(aData[i][8]) || 0,
            paidTo: aData[i][9],
            paid: parseFloat(aData[i][10]) || 0,
            remark: aData[i][11] || ""
          });
        }
      }
    }
    entries.sort(function(a, b) {
      var dA = parsePartyDate(a.date), dB = parsePartyDate(b.date);
      if (dA && dB && dA.getTime() !== dB.getTime()) return dA - dB;
      return a.rowNumber - b.rowNumber;
    });
    return jsonResponse(entries);
  }

  // 8d. ADVANCE FORM: Ek gadi ki purani trips (POSITIONAL columns se — header naam pe depend nahi karta, isliye hamesha sahi Date/From/To/Contact deta hai)
  if (action === "getAdvTripsByVehicle") {
    var searchVNo = (e.parameter.vNo || "").toUpperCase().trim();
    var dataAll = sheet.getDataRange().getValues();
    var trips = [];
    for (var i = dataAll.length - 1; i >= 1; i--) {
      if (dataAll[i][1] && dataAll[i][1].toString().toUpperCase().trim() === searchVNo) {
        trips.push({
          rowNumber: i + 1,
          date: dataAll[i][0],
          vNo: dataAll[i][1],
          dNo: dataAll[i][2],     // Contact Number (Driver/Owner mobile)
          from: dataAll[i][3],
          to: dataAll[i][4],
          partyName: dataAll[i][12]
        });
      }
    }
    return jsonResponse(trips);
  }

  // 8e. ADVANCE FORM: A/C Name suggestions (jitne bhi accounts pehle use ho chuke hain, unki unique list)
  if (action === "getAdvanceAccountList") {
    var advSheet = ss.getSheetByName("Advance_Ledger");
    var accounts = [];
    if (advSheet && advSheet.getLastRow() > 1) {
      var aData = advSheet.getDataRange().getValues();
      for (var i = 1; i < aData.length; i++) {
        var acName = aData[i][7] ? aData[i][7].toString().trim() : ""; // Col H = A/C Name
        if (acName && accounts.indexOf(acName) === -1) accounts.push(acName);
      }
    }
    accounts.sort();
    return jsonResponse(accounts);
  }

  // 8. VEHICLE PROFILE: Owner/Driver details jo pichli baar save hui thi (Auto-Fill ke liye)
  if (action === "getVehicleProfile") {
    var profileSheet = ss.getSheetByName("Vehicle_Profile");
    var searchVNo = (e.parameter.vNo || "").toUpperCase().trim();
    if (!profileSheet || profileSheet.getLastRow() < 2) return jsonResponse({});
    var pData = profileSheet.getDataRange().getValues();
    for (var i = 1; i < pData.length; i++) {
      if (pData[i][0].toString().toUpperCase().trim() === searchVNo) {
        return jsonResponse({
          lOwner: pData[i][1] || "",
          oVillage: pData[i][2] || "",
          oMob: pData[i][3] || "",
          dName: pData[i][4] || "",
          dVillage: pData[i][5] || "",
          dMob: pData[i][6] || "",
          licence: pData[i][7] || ""
        });
      }
    }
    return jsonResponse({});
  }

  // Apps Script mein ye hissa add karein
if (action == "getUploadedList") {
  var docSheet = ss.getSheetByName("Vehicle_Docs");
  var docData = docSheet.getDataRange().getValues();
  var uploadedVehicles = [];
  for (var i = 1; i < docData.length; i++) {
    var vNo = docData[i][0]; // Maan lijiye Column A mein Gadi No hai
    if (vNo && uploadedVehicles.indexOf(vNo) === -1) {
      uploadedVehicles.push(vNo);
    }
  }
  return ContentService.createTextOutput(JSON.stringify(uploadedVehicles)).setMimeType(ContentService.MimeType.JSON);
}

// code.gs ke doGet mein ise add karein agar missing hai
if (action === "getFileContent") {
  try {
    var file = DriveApp.getFileById(e.parameter.fileId);
    var base64 = Utilities.base64Encode(file.getBlob().getBytes());
    return ContentService.createTextOutput(base64).setMimeType(ContentService.MimeType.TEXT);
  } catch(err) {
    return ContentService.createTextOutput("Error").setMimeType(ContentService.MimeType.TEXT);
  }
}

  // DEFAULT: ALL DATA (View Trips)
  var dataAll = sheet.getDataRange().getValues();
  var headersAll = dataAll[0];
  var jsonArray = dataAll.slice(1).reverse().map(row => {
    var obj = {};
    headersAll.forEach((h, i) => {
      obj[h] = row[i];
      if (i === 6) obj["_colG"] = row[i];
      if (i === 7) obj["_colH"] = row[i];
      if (i === 8) obj["_owner"] = row[i];
    });
    return obj;
  });
  return jsonResponse(jsonArray);
}

function doPost(e) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  try {
    var data = JSON.parse(e.postData.contents);

    // CASE 1: SAVE NEW TRIP
    if (data.action === "saveTrip") {
      var sheet = ss.getSheetByName("Data_log");
      sheet.appendRow([
        data.date, data.vNo.toUpperCase(), data.dNo, data.from, data.to, 
        data.amount, data.received, "", "", data.rate, "", 
        data.capacity, data.partyName, data.material, data.remark
      ]);
      return textResponse("Success");
    }

    // CASE 2: UPLOAD VEHICLE DOCUMENT (RC/DL/Docs)
    if (data.action === "uploadDocument") {
      var folder = DriveApp.getFolderById(MAIN_FOLDER_ID);
      var blob = Utilities.newBlob(Utilities.base64Decode(data.base64), data.mimeType, data.fileName);
      var file = folder.createFile(blob);
      var fileUrl = file.getUrl();

      var docSheet = ss.getSheetByName("Vehicle_Docs") || ss.insertSheet("Vehicle_Docs");
      if (docSheet.getLastRow() === 0) {
        docSheet.appendRow(["Vehicle No", "Document Link", "File Name", "Upload Date"]);
      }
      docSheet.appendRow([data.vNo.toUpperCase(), fileUrl, data.fileName, new Date()]);
      return textResponse("Success");
    }

    // CASE 3: SAVE LOADING SLIP (BEELTY)
    if (data.action === "saveLoadingSlip") {
      var sheet = ss.getSheetByName("Data_log");
      var row = parseInt(data.rowNumber);
      if (row > 1) { sheet.getRange(row, 16).setValue("SLIP GENERATED ✅"); }

      var slipFolder = DriveApp.getFolderById(SLIP_FOLDER_ID);
      var fileName = "Slip_" + data.vNo + "_" + data.date.replace(/\//g, '-') + ".pdf";
      var pdfBlob = Utilities.newBlob(Utilities.base64Decode(data.pdfBase64), "application/pdf", fileName);
      var file = slipFolder.createFile(pdfBlob);

      // Saved fields ka JSON (pdfBase64 chhodkar) — agli baar Edit karne ke liye
      var dataForJson = {};
      for (var k in data) { if (k !== "pdfBase64") dataForJson[k] = data[k]; }
      var savedJson = JSON.stringify(dataForJson);

      var archiveSheet = ss.getSheetByName("Slip_Archive") || ss.insertSheet("Slip_Archive");
      var editRow = parseInt(data.archiveRow);

      if (editRow > 1) {
        // EDIT: Purani entry hi update karo (purani PDF file delete karke nayi rakho, taaki Drive mein duplicate na ho)
        var oldFileId = archiveSheet.getRange(editRow, 2).getValue();
        try { if (oldFileId) DriveApp.getFileById(oldFileId).setTrashed(true); } catch (e) {}
        archiveSheet.getRange(editRow, 1, 1, 5).setValues([[fileName, file.getId(), new Date(), file.getUrl(), savedJson]]);
      } else {
        // NAYI ENTRY
        archiveSheet.appendRow([fileName, file.getId(), new Date(), file.getUrl(), savedJson]);
      }

      // Vehicle Profile update/insert karein taaki agli baar Owner/Driver auto-fill ho sake
      saveVehicleProfile(ss, data);

      return textResponse("Success");
    }

    // CASE 4: ADD PARTY LEDGER ENTRY (Hisaab-Kitaab Tally Entry)
    if (data.action === "addLedgerEntry") {
      var ledgerSheet = ss.getSheetByName("Party_Ledger") || ss.insertSheet("Party_Ledger");
      if (ledgerSheet.getLastRow() === 0) {
        ledgerSheet.appendRow(["Sr No", "Date", "Party Name", "Vehicle Number", "Description", "Debit", "Credit"]);
      }
      var nextSr = ledgerSheet.getLastRow(); // header row counted, so this IS the next serial number
      ledgerSheet.appendRow([
        nextSr,
        data.date,
        data.party.toUpperCase().trim(),
        data.vNo ? data.vNo.toUpperCase().trim() : "",
        data.description || "",
        parseFloat(data.debit) || 0,
        parseFloat(data.credit) || 0
      ]);
      return textResponse("Success");
    }

    // CASE 5: DELETE PARTY LEDGER ENTRY
    if (data.action === "deleteLedgerEntry") {
      var ledgerSheet = ss.getSheetByName("Party_Ledger");
      var row = parseInt(data.rowNumber);
      if (ledgerSheet && row > 1) { ledgerSheet.deleteRow(row); }
      return textResponse("Success");
    }

    // CASE 6: UPDATE (EDIT) PARTY LEDGER ENTRY
    if (data.action === "updateLedgerEntry") {
      var ledgerSheet = ss.getSheetByName("Party_Ledger");
      var row = parseInt(data.rowNumber);
      if (ledgerSheet && row > 1) {
        ledgerSheet.getRange(row, 2, 1, 6).setValues([[
          data.date,
          data.party.toUpperCase().trim(),
          data.vNo ? data.vNo.toUpperCase().trim() : "",
          data.description || "",
          parseFloat(data.debit) || 0,
          parseFloat(data.credit) || 0
        ]]);
      }
      return textResponse("Success");
    }

    // CASE 7: ADD ADVANCE LEDGER ENTRY (SMT jaisi party ka advance in/out track karne ke liye)
    if (data.action === "addAdvanceEntry") {
      var advSheet = ss.getSheetByName("Advance_Ledger") || ss.insertSheet("Advance_Ledger");
      if (advSheet.getLastRow() === 0) {
        advSheet.appendRow(["Sr No", "Date", "Vehicle No", "DR No", "From", "To", "Paid From (Party)", "A/C Name", "Received Advance", "Paid To", "Paid Advance", "Remark"]);
      }
      var nextSr = advSheet.getLastRow(); // header counted, so this IS the next serial number
      advSheet.appendRow([
        nextSr,
        data.date,
        data.vNo ? data.vNo.toUpperCase().trim() : "",
        data.drNo || "",
        data.from || "",
        data.to || "",
        data.party.toUpperCase().trim(),
        data.acName || "",
        parseFloat(data.received) || 0,
        data.paidTo || "",
        parseFloat(data.paid) || 0,
        data.remark || ""
      ]);
      return textResponse("Success");
    }

    // CASE 8: DELETE ADVANCE LEDGER ENTRY
    if (data.action === "deleteAdvanceEntry") {
      var advSheet = ss.getSheetByName("Advance_Ledger");
      var row = parseInt(data.rowNumber);
      if (advSheet && row > 1) { advSheet.deleteRow(row); }
      return textResponse("Success");
    }

    // CASE 9: UPDATE (EDIT) ADVANCE LEDGER ENTRY
    if (data.action === "updateAdvanceEntry") {
      var advSheet = ss.getSheetByName("Advance_Ledger");
      var row = parseInt(data.rowNumber);
      if (advSheet && row > 1) {
        advSheet.getRange(row, 2, 1, 11).setValues([[
          data.date,
          data.vNo ? data.vNo.toUpperCase().trim() : "",
          data.drNo || "",
          data.from || "",
          data.to || "",
          data.party.toUpperCase().trim(),
          data.acName || "",
          parseFloat(data.received) || 0,
          data.paidTo || "",
          parseFloat(data.paid) || 0,
          data.remark || ""
        ]]);
      }
      return textResponse("Success");
    }

  } catch (err) {
    return textResponse("Error: " + err.toString());
  }
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
function textResponse(text) {
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.TEXT);
}

// Vehicle Profile (Owner/Driver) ko save/update karta hai — Beelty me agli baar 1-tap auto-fill ke liye
function saveVehicleProfile(ss, data) {
  var vNo = (data.vNo || "").toUpperCase().trim();
  if (!vNo) return;

  var profileSheet = ss.getSheetByName("Vehicle_Profile") || ss.insertSheet("Vehicle_Profile");
  if (profileSheet.getLastRow() === 0) {
    profileSheet.appendRow(["Vehicle No", "Lorry Owner", "Owner Village", "Owner Mobile", "Driver Name", "Driver Village", "Driver Mobile", "Licence No"]);
  }

  var rowData = [
    vNo,
    data.lorryOwner || "",
    data.ownerVillage || "",
    data.ownerMob || "",
    data.driverName || "",
    data.driverVillage || "",
    data.driverMob || "",
    data.licenceNo || ""
  ];

  var pData = profileSheet.getDataRange().getValues();
  var foundRow = -1;
  for (var i = 1; i < pData.length; i++) {
    if (pData[i][0].toString().toUpperCase().trim() === vNo) { foundRow = i + 1; break; }
  }

  if (foundRow > 0) {
    profileSheet.getRange(foundRow, 1, 1, rowData.length).setValues([rowData]);
  } else {
    profileSheet.appendRow(rowData);
  }
}

// Ledger date field ko Date object mein badalta hai (input type=date se "YYYY-MM-DD" aata hai)
function parsePartyDate(val) {
  if (!val) return null;
  var d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}