/**
 * Order Routes
 */
import express from "express";
import { createOrder, getMyOrders, updateOrderStatus, getActiveShops, getShopOrders } from "../controllers/orderController.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireProfileComplete } from "../middleware/profile.middleware.js";
import { allowRoles } from "../middleware/role.middleware.js";

const router = express.Router();

// Publicly active shops (but still authenticated)
router.get("/shops", authenticate, getActiveShops);

// Student routes
router.post("/create", authenticate, requireProfileComplete, createOrder);
router.get("/my", authenticate, requireProfileComplete, getMyOrders);

// Shopkeeper/Admin routes
router.get("/shop", authenticate, requireProfileComplete, allowRoles("shopkeeper", "admin"), getShopOrders);
router.patch("/:id/status", authenticate, requireProfileComplete, allowRoles("shopkeeper", "admin"), updateOrderStatus);

export default router;
