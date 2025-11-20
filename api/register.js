import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email & password diperlukan" });

    const hash = await bcrypt.hash(password, 10);

    const { data, error } = await supabase
      .from("users")
      .insert([{ email, password_hash: hash }])
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });

    const token = jwt.sign({ id: data.id }, process.env.JWT_SECRET);
    res.json({ token });
  } catch (e) {
    console.error("register error", e);
    res.status(500).json({ error: "Internal server error" });
  }
}
