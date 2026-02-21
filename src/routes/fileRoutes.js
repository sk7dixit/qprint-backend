import express from "express";
import { uploadFile, getFiles, generateUploadUrl } from "../controllers/fileController.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireProfileComplete } from "../middleware/profile.middleware.js";

const router = express.Router();

// Apply auth and profile completion guards to all file routes
router.use(authenticate);
router.use(requireProfileComplete);

router.post("/generate-upload-url", generateUploadUrl);
router.post("/upload", uploadFile);
router.get("/", getFiles);

export default router;
