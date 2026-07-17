const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://ibogwunlorjyzupmneks.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlib2d3dW5sb3JqeXp1cG1uZWtzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzQ0MTk1NSwiZXhwIjoyMDk5MDE3OTU1fQ.MgJwph1iSzDu3IMQAgYtmzb3prJY9FVV-3ZfcxIr2EU";

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Fetching unit 853 and all reserved units...");
  const { data: unit853, error: err1 } = await supabase
    .from("inventory")
    .select("*")
    .eq("unit_number", "853");

  if (err1) console.error("Error fetching 853:", err1);
  else console.log("Unit 853 details:", unit853);

  const { data: reservedUnits, error: err2 } = await supabase
    .from("inventory")
    .select("*")
    .not("reserved_by", "is", null);

  if (err2) console.error("Error fetching reserved:", err2);
  else console.log("Reserved units list:", reservedUnits);
}

run();
