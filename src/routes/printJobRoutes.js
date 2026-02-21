/**
 * Order Routes
 */
import express from "express";
import { createPrintJob, verifyPayment, getPrintHistory, getActiveShops, getShopPrintJobs, updatePrintJobStatus } from "../controllers/printJobController.js";
import { getReceipt } from "../controllers/receiptController.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireProfileComplete } from "../middleware/profile.middleware.js";
import { allowRoles } from "../middleware/role.middleware.js";

const router = express.Router();

// Create print job (Authenticated)
router.post("/", authenticate, createPrintJob);

// Verify Payment (Authenticated)
router.post("/verify-payment", authenticate, verifyPayment);

// Get print history (Authenticated)
router.get("/history", authenticate, getPrintHistory);

// Publicly active shops (but still authenticated)
router.get("/shops", authenticate, getActiveShops);

// Shopkeeper/Admin routes
router.get("/shop", authenticate, requireProfileComplete, allowRoles("seller", "admin"), getShopPrintJobs);
router.patch("/:id/status", authenticate, requireProfileComplete, allowRoles("seller", "admin"), updatePrintJobStatus);

router.get("/receipt/:printJobId", authenticate, getReceipt); // Receipt Router;

export default router;
