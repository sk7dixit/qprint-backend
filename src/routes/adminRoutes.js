import express from "express";
import {
    getDashboardStats,
    getAllUsers,
    getAllShops,
    getShopById,
    getAllPayments,
    getAllFeedback,
    getAllAuditLogs,
    createShop
} from "../controllers/adminController.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { allowRoles } from "../middleware/role.middleware.js";

const router = express.Router();

// All routes require admin role
router.use(authenticate, allowRoles("admin"));

router.get("/dashboard-stats", getDashboardStats);
router.get("/users", getAllUsers);
router.get("/shops", getAllShops);
router.get("/shops/:id", getShopById);
router.get("/payments", getAllPayments);
router.get("/feedback", getAllFeedback);
router.get("/audit-logs", getAllAuditLogs);
router.post("/shops", createShop);

export default router;
