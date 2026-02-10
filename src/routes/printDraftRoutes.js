import express from "express";
import { uploadDraft, getDraftStatus, deleteDraft, updateDraftStatus, processDraftEdits, processAIRequest } from "../controllers/printDraftController.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { upload } from "../middleware/upload.middleware.js";

const router = express.Router();

router.use(authenticate);

// Unified upload endpoint
router.post("/upload", upload.single("file"), uploadDraft);

// Poll draft status
router.get("/:draftId/status", getDraftStatus);

// Delete draft (Replace file)
router.delete("/:draftId", deleteDraft);

// Update status (Continue to shop)
router.patch("/:draftId/status", updateDraftStatus);

// Process Edits (Rotate, Delete, JSON Actions)
router.post("/:draftId/process", processDraftEdits);

// AI Text Processing
router.post("/:draftId/ai", processAIRequest);

export default router;
