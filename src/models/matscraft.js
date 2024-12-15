const crypto = require("crypto");
const supabase = require("../utils/supabase");
const { parseMinecraftPosition } = require("../utils/parseCoordinate");

async function saveMinecraftData(data) {
  try {
    // Parsing posisi ke JSON
    const coordinates = parseMinecraftPosition(data.position);

    // Format data untuk hashing
    const formattedData = {
      minecraft_id: data.uuid,
      block: data.block.replace("block.matscraft.", ""),
      position: coordinates,
      mined_at: new Date(),
    };
    console.log(formattedData.mined_at);
    const hashString = crypto
      .createHash("sha256")
      .update(
        `${formattedData.uuid}-${formattedData.block}-${JSON.stringify(
          formattedData.position
        )}-${formattedData.mined_at.toISOString()}`
      )
      .digest("hex");

    formattedData.hash = hashString; // Tambahkan hash ID ke data

    console.log("Formatted Data with Hash ID:", formattedData);

    // Simpan data ke tabel `minecraft_blocks` di Supabase
    const { data: insertedData, error } = await supabase
      .from("minecraft_blocks") // Nama tabel di Supabase
      .insert([formattedData]);

    if (error) {
      console.error("Error inserting data:", error.message);
    } else {
      console.log("Data successfully inserted:", insertedData);
    }
  } catch (error) {
    console.error("Error saving Minecraft data:", error.message);
  }
}
const verifyToken = async (postData) => {
  const { data, error } = await supabase
    .from("auth_tokens")
    .select("*")
    .eq("verification_token", postData.token)
    .single();
  if (error || data.status === "invalid") {
    return "Invalid Token";
  }
  if (data.status === "expired") {
    console.log("Token Expired");
    return "Token Expired";
  }
  const { data: user, error: userError } = await supabase
    .from("users")
    .update({
      minecraft_username: postData.playerName,
      minecraft_id: postData.userId,
      is_verified: true,
    })
    .eq("discord_id", data.discord_id)
    .select("*")
    .single();

  if (userError) {
    console.log("User not found");
    return;
  }
  return "Account Linked Successfully";
};
module.exports = { saveMinecraftData, verifyToken };
