const express = require("express");
const bodyParser = require("body-parser");
const puppeteer = require("puppeteer");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(bodyParser.json({ limit: "10mb" }));

const PORT = process.env.PORT || 8080;
const WORKER_SECRET = process.env.WORKER_SECRET || "dev-secret";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

app.post("/render-and-upload", async (req, res) => {
  const secret = req.headers["x-worker-secret"];
  if (secret !== WORKER_SECRET) return res.status(401).json({ error: "unauthorized" });

  const { html, filename } = req.body;
  if (!html) return res.status(400).json({ error: "html required" });

  try {
    const browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20mm", right: "15mm", bottom: "20mm", left: "15mm" }
    });
    await browser.close();

    if (!supabase) {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename || "storybook.pdf"}"`);
      return res.send(pdfBuffer);
    }

    const filePath = `pdfs/${filename || `storybook-${Date.now()}.pdf`}`;
    const { data, error } = await supabase.storage.from("pdfs").upload(filePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true
    });

    if (error) {
      console.error("Upload error:", error);
      return res.status(500).json({ error: "upload_failed", details: error });
    }

    const { data: signedData, error: signedErr } = await supabase.storage.from("pdfs").createSignedUrl(filePath, 60 * 60 * 24 * 7);
    if (signedErr) {
      console.error("Signed URL err:", signedErr);
      return res.status(500).json({ error: "signed_url_failed", details: signedErr });
    }

    return res.json({ publicUrl: signedData.signedUrl, path: filePath });
  } catch (err) {
    console.error("PDF render error:", err);
    res.status(500).json({ error: "render_failed", details: err.message || err });
  }
});

app.listen(PORT, () => {
  console.log(`PDF worker listening on ${PORT}`);
});
