import type { NextApiRequest } from "next";
import { getAdminSupabase } from "./supabaseClient";

export async function getUserFromReq(req: NextApiRequest) {
  const auth = req.headers.authorization;
  const token = auth?.startsWith("Bearer ") ? auth.split(" ")[1] : null;
  if (!token) return { user: null, error: "no_token" };

  const supabase = getAdminSupabase();
  const { data, error } = await supabase.auth.getUser(token);
  if (error) return { user: null, error: error.message };
  return { user: data.user, error: null };
}
