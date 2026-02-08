import express from "express";
import { uploadFile, getFiles } from "../controllers/fileController.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireProfileComplete } from "../middleware/profile.middleware.js";
import { upload } from "../middleware/upload.middleware.js";

const router = express.Router();

// Apply auth and profile completion guards to all file routes
router.use(authenticate);
router.use(requireProfileComplete);

router.post("/upload", upload.single("file"), uploadFile);
router.get("/", getFiles);

export default router;
