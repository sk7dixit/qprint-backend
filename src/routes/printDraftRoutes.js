import express from "express";
import {
    uploadDraft,
    getDraftStatus,
    deleteDraft,
    updateDraftStatus,
    processDraftEdits,
    spellFix,
    formatClean,
    getDraft
} from "../controllers/printDraftController.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(authenticate);
// router.use((req, res, next) => {
//     req.user = { id: 'test-user-id' };
//     next();
// });

import multer from "multer";

const upload = multer({ storage: multer.memoryStorage() });

// Unified upload endpoints
// router.post("/generate-upload-url", generateDraftUploadUrl); // Deprecated
router.post("/upload", upload.single('file'), uploadDraft);

// Get Draft Details
router.get("/:draftId", getDraft);

// Poll draft status
router.get("/:draftId/status", getDraftStatus);

// Delete draft (Replace file)
router.delete("/:draftId", deleteDraft);

// Update status (Continue to shop)
router.patch("/:draftId/status", updateDraftStatus);

// Process Edits (Rotate, Delete, JSON Actions)
router.post("/:draftId/process", processDraftEdits);

// AI Text Processing
router.post("/:draftId/spell-fix", spellFix);
router.post("/:draftId/format-clean", formatClean);

export default router;
