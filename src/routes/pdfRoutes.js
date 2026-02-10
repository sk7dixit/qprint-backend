import express from "express";
import { processPDFInstructions, handleAIRequest } from "../controllers/pdfController.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireProfileComplete } from "../middleware/profile.middleware.js";

const router = express.Router();

router.use(authenticate);
router.use(requireProfileComplete);

// Instruction-based processing
router.post("/process", processPDFInstructions);

// AI Bridge (Suggestions only)
router.post("/ai", handleAIRequest);

export default router;
