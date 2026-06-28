import fetch from "node-fetch";

async function testCompare() {
  try {
    console.log("Testing /api/compare-3way...");
    const response = await fetch("http://localhost:3000/api/compare-3way", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        saTalebi: { saId: "TEST-PO", kalemler: [] },
        irsaliyeler: [],
        fatura: { faturaNo: "TEST-FT", kalemler: [], toplamTutar: 0, kdvTutar: 0, genelToplam: 0 }
      })
    });
    
    const text = await response.text();
    console.log("Status:", response.status);
    console.log("Response headers:", response.headers.get("content-type"));
    console.log("Response text (first 200 chars):", text.substring(0, 200));
  } catch (err) {
    console.error("Test failed:", err);
  }
}

testCompare();
