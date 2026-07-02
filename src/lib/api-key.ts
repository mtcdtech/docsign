import fs from "fs";
import path from "path";
import crypto from "crypto";

const API_KEY_PATH = path.join(process.cwd(), "data", "api-key.json");

export function getApiKey(): string {
  try {
    if (fs.existsSync(API_KEY_PATH)) {
      const data = JSON.parse(fs.readFileSync(API_KEY_PATH, "utf-8"));
      if (data.apiKey) return data.apiKey;
    }
  } catch (e) {
    console.error("Failed to read API key:", e);
  }
  
  // If not exists, generate a default one
  const newKey = "ds_" + crypto.randomBytes(24).toString("hex");
  saveApiKey(newKey);
  return newKey;
}

export function saveApiKey(key: string) {
  try {
    const dir = path.dirname(API_KEY_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(API_KEY_PATH, JSON.stringify({ apiKey: key, updatedAt: new Date().toISOString() }, null, 2));
  } catch (e) {
    console.error("Failed to save API key:", e);
  }
}
