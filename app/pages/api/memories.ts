import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminSupabase } from "../../lib/supabaseClient";
import { getUserFromReq } from "../../lib/authServer";

/**
 * Protected: creates and lists memories for authenticated users.
 * Expects Authorization: Bearer <access_token> header from the client.
 */

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { user, error: userErr } = await getUserFromReq(req);
  if (!user) return res.status(401).json({ error: "Unauthorized", details: userErr });

  const supabase = getAdminSupabase();

  if (req.method === "POST") {
    const { childId, note, imagePath, takenAt } = req.body;
    if (!childId) return res.status(400).json({ error: "childId required" });

    const { data, error } = await supabase
      .from("memories")
      .insert([
        {
          child_id: childId,
          note: note || null,
          image_path: imagePath || null,
          taken_at: takenAt || null
        }
      ])
      .select()
      .single();

    if (error) return res.status(500).json({ error });
    return res.status(201).json(data);
  }

  if (req.method === "GET") {
    const childId = Number(req.query.childId);
    if (!childId) return res.status(400).json({ error: "childId required" });

    const { data, error } = await supabase
      .from("memories")
      .select("*")
      .eq("child_id", childId)
      .order("taken_at", { ascending: true });

    if (error) return res.status(500).json({ error });
    return res.json(data);
  }

  res.setHeader("Allow", ["GET", "POST"]);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}
