/**
 * Order Routes
 */
import express from "express";
import { createPrintJob, getPrintHistory, getActiveShops, getShopPrintJobs, updatePrintJobStatus, verifyPayment } from "../controllers/printJobController.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireProfileComplete } from "../middleware/profile.middleware.js";
import { allowRoles } from "../middleware/role.middleware.js";

const router = express.Router();

// Publicly active shops (but still authenticated)
router.get("/shops", authenticate, getActiveShops);

// Create print job (Authenticated)
router.post("/create", authenticate, createPrintJob);

// Verify Payment (Authenticated)
router.post("/verify-payment", authenticate, verifyPayment);
router.get("/history", authenticate, requireProfileComplete, getPrintHistory);

// Shopkeeper/Admin routes
router.get("/shop", authenticate, requireProfileComplete, allowRoles("seller", "admin"), getShopPrintJobs);
router.patch("/:id/status", authenticate, requireProfileComplete, allowRoles("seller", "admin"), updatePrintJobStatus);

export default router;
