
import "./queue/pdfWorker.js";
import "./queue/cleanupWorker.js";
import "./queue/cleanupQueue.js"; // Import to trigger scheduling

console.log("🚀 Background Workers Started (PDF + Cleanup)");
