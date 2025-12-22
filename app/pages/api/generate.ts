import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import { getAdminSupabase } from "../../lib/supabaseClient";
import { getUserFromReq } from "../../lib/authServer";
import Handlebars from "handlebars";

const FREE_MONTHLY_QUOTA = 5;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { user, error: userErr } = await getUserFromReq(req);
  if (!user) return res.status(401).json({ error: "Unauthorized", details: userErr });

  const childId = Number(req.query.childId);
  const interval = (req.query.interval as string) || "monthly";
  const makePdf = req.query.pdf === "true";
  const theme = (req.query.theme as string) || "classic";

  if (!childId) return res.status(400).json({ error: "childId required" });

  const supabase = getAdminSupabase();

  const now = new Date();
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  const upsertResp = await supabase
    .from("usage")
    .select("*")
    .eq("user_id", user.id)
    .eq("period_start", periodStart)
    .limit(1);

  if (upsertResp.error) {
    console.error("Usage read error:", upsertResp.error);
    return res.status(500).json({ error: "usage_read_failed" });
  }

  const existing = upsertResp.data?.[0];
  const calls = existing ? existing.calls : 0;
  if (calls >= FREE_MONTHLY_QUOTA) {
    return res.status(429).json({ error: "quota_exceeded", message: `Monthly quota of ${FREE_MONTHLY_QUOTA} reached` });
  }

  const { data: child } = await supabase.from("children").select("*").eq("id", childId).single();
  const { data: memories } = await supabase
    .from("memories")
    .select("*")
    .eq("child_id", childId)
    .order("taken_at", { ascending: true });

  const childName = child?.name || "Your child";
  let prompt = `Write a ${interval} storybook for ${childName}. Use warm, family-friendly language and create section titles for each memory. Keep it fit for printing and reading aloud. Memories:\n\n`;
  for (const m of memories || []) {
    prompt += `- ${m.taken_at || "unknown"}: ${m.note || ""} ${m.image_path ? `(image: ${m.image_path})` : ""}\n`;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  let aiContent = "";
  if (!apiKey) {
    aiContent = `Sample content for ${childName}. Add OPENAI_API_KEY in environment to enable real generation.`;
  } else {
    try {
      const aiResp = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        { model: "gpt-4o", messages: [{ role: "user", content: prompt }], max_tokens: 1200 },
        { headers: { Authorization: `Bearer ${apiKey}` } }
      );
      aiContent = aiResp.data?.choices?.[0]?.message?.content || aiResp.data?.choices?.[0]?.text || "";
    } catch (err: any) {
      console.error("AI error:", err?.response?.data || err.message || err);
      return res.status(500).json({ error: "ai_failed", details: err?.response?.data || err.message });
    }
  }

  const templates: Record<string, string> = {
    classic: `<html><head><meta charset="utf-8"/><style>body{font-family: Georgia, serif;padding:24px;} h1{color:#333;} .section{margin-bottom:18px;}</style></head><body><h1>{{childName}}'s {{interval}} Story</h1><div class="content">{{{content}}}</div></body></html>`,
    fairy: `<html><head><meta charset="utf-8"/><style>body{font-family: "Comic Sans MS", cursive, sans-serif;background:linear-gradient(#fffaf0,#f0f8ff);padding:24px;} h1{color:#b13f9b;} .content{font-size:18px;color:#333}</style></head><body><h1>✨ The Adventures of {{childName}} ✨</h1><div class="content">{{{content}}}</div></body></html>`,
    adventure: `<html><head><meta charset="utf-8"/><style>body{font-family: "Trebuchet MS", sans-serif;padding:24px;background:#fff;} h1{color:#2b6cb0} .content{line-height:1.6}</style></head><body><h1>{{childName}}'s Great Adventures</h1><div class="content">{{{content}}}</div></body></html>`
  };

  const chosen = templates[theme] || templates["classic"];
  const template = Handlebars.compile(chosen);
  const storyHtml = template({ childName, interval, content: aiContent.replace(/\n/g, "<br/>") });

  const newCalls = (calls || 0) + 1;
  const up = await supabase
    .from("usage")
    .upsert(
      { user_id: user.id, period_start: periodStart, calls: newCalls },
      { onConflict: "user_id,period_start" }
    );

  if (up.error) {
    console.error("Usage upsert error:", up.error);
  }

  if (!makePdf || !process.env.WORKER_URL) {
    return res.json({ storyHtml, generatedAt: new Date().toISOString() });
  }

  try {
    const workerUrl = process.env.WORKER_URL!;
    const workerSecret = process.env.WORKER_SECRET!;
    const resp = await axios.post(
      `${workerUrl}/render-and-upload`,
      { html: storyHtml, filename: `${childName.replace(/\s+/g, "_")}-${Date.now()}.pdf` },
      { headers: { "x-worker-secret": workerSecret } }
    );
    return res.json({ storyHtml, pdfUrl: resp.data.publicUrl, generatedAt: new Date().toISOString() });
  } catch (err: any) {
    console.error("Worker error:", err?.response?.data || err.message || err);
    return res.status(500).json({ error: "worker_failed", details: err?.response?.data || err.message });
  }
}
