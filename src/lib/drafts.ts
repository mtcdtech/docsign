import { prisma } from "@/lib/prisma";
import fs from "fs";

export async function cleanExpiredDrafts() {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    const expiredDrafts = await prisma.signedDocument.findMany({
      where: {
        isDraft: true,
        createdAt: { lt: cutoff }
      }
    });

    if (expiredDrafts.length === 0) return;

    for (const d of expiredDrafts) {
      if (d.signedPdfPath) {
        try {
          if (fs.existsSync(d.signedPdfPath)) {
            fs.unlinkSync(d.signedPdfPath);
          }
        } catch (e) {
          console.error("Failed to delete expired draft file:", e);
        }
      }
    }

    const result = await prisma.signedDocument.deleteMany({
      where: {
        isDraft: true,
        createdAt: { lt: cutoff }
      }
    });
    console.log(`Cleaned up ${result.count} expired drafts older than 24 hours.`);
  } catch (err) {
    console.error("Error cleaning up expired drafts:", err);
  }
}
