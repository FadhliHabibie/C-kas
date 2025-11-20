import { createClient } from "@supabase/supabase-js";
import { verifyToken } from "./_auth";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

function groupByDay(data) {
  // returns object keyed by date string
  return data.reduce((acc, v) => {
    acc[v.tanggal] = acc[v.tanggal] || [];
    acc[v.tanggal].push(v);
    return acc;
  }, {});
}

export default async function handler(req, res) {
  try {
    const user_id = verifyToken(req);
    if (!user_id) return res.status(401).json({ error: "Unauthorized" });

    // fetch penjualan & pengeluaran for last 30 days
    const { data: penjualan } = await supabase
      .from("penjualan")
      .select("*")
      .eq("user_id", user_id)
      .order("tanggal", { ascending: false })
      .limit(100);

    const { data: pengeluaran } = await supabase
      .from("pengeluaran")
      .select("*")
      .eq("user_id", user_id)
      .order("tanggal", { ascending: false })
      .limit(100);

    // also fetch acara
    const { data: acara } = await supabase
      .from("acara")
      .select("*")
      .eq("user_id", user_id)
      .order("tanggal", { ascending: false });

    res.json({
      penjualan,
      pengeluaran,
      acara,
      penjualan_by_day: groupByDay(penjualan || []),
      pengeluaran_by_day: groupByDay(pengeluaran || [])
    });
  } catch (e) {
    console.error("history error", e);
    res.status(500).json({ error: "Internal server error" });
  }
}
