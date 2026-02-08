import pool from "../config/db.js";
import admin from "../config/firebase-admin.js";

export const getDashboardStats = async (req, res) => {
    try {
        // 1. Core Metrics
        const userCount = await pool.query("SELECT COUNT(*) FROM users");
        const shopCount = await pool.query("SELECT COUNT(*) FROM shops");
        const orderCount = await pool.query("SELECT COUNT(*) FROM orders WHERE status = 'completed'");
        const todayActivity = await pool.query(
            "SELECT COUNT(*) FROM orders WHERE DATE(created_at) = CURRENT_DATE"
        );

        // 2. System Status (Shop Network)
        const activeShops = await pool.query("SELECT COUNT(*) FROM shops WHERE is_active = true");

        // 3. Recent Activity Stream (Last 5 events)
        // We'll combine new users and recent orders
        const recentUsers = await pool.query(
            "SELECT 'user_signup' as type, name as msg, created_at as time, 'new' as status FROM users ORDER BY created_at DESC LIMIT 3"
        );
        const recentOrders = await pool.query(
            "SELECT 'payment_success' as type, 'Order #' || id as msg, created_at as time, 'success' as status FROM orders WHERE status IN ('completed', 'ready') ORDER BY created_at DESC LIMIT 3"
        );

        // Merge and sort activities
        const activities = [...recentUsers.rows, ...recentOrders.rows]
            .sort((a, b) => new Date(b.time) - new Date(a.time))
            .slice(0, 5);

        res.status(200).json({
            metrics: [
                { label: "Total Users", val: userCount.rows[0].count, path: "/users" },
                { label: "Total Shops", val: shopCount.rows[0].count, path: "/shops" },
                { label: "Payments (TX)", val: orderCount.rows[0].count, path: "/payments" },
                { label: "Today's Activity", val: todayActivity.rows[0].count, path: "/dashboard" }
            ],
            systemStatus: [
                { label: "Platform", status: "Operational", type: "healthy" },
                { label: "Payments", status: "Active", type: "healthy" },
                { label: "Shop Network", status: `${activeShops.rows[0].count} Nodes Online`, type: "healthy" }
            ],
            activities: activities.map((a, i) => ({
                id: i,
                type: a.type,
                msg: a.type === 'user_signup' ? `New user: ${a.msg}` : `Job processed: ${a.msg}`,
                time: a.time,
                status: a.status
            }))
        });
    } catch (error) {
        console.error("Admin stats error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getAllUsers = async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM users ORDER BY created_at DESC");
        res.status(200).json(result.rows);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch users" });
    }
};

export const getAllShops = async (req, res) => {
    try {
        const query = `
            SELECT s.*, u.name as owner, u.mobile 
            FROM shops s 
            LEFT JOIN users u ON u.shop_id = s.id AND u.role = 'seller'
            ORDER BY s.created_at DESC
        `;
        const result = await pool.query(query);
        res.status(200).json(result.rows);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch shops" });
    }
};

export const getAllPayments = async (req, res) => {
    try {
        const query = `
            SELECT o.*, u.name as user_name, u.enrollment_id, u.role as user_role, f.filename
            FROM orders o
            JOIN users u ON o.user_id = u.id
            JOIN files f ON o.file_id = f.id
            ORDER BY o.created_at DESC
        `;
        const result = await pool.query(query);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error("Fetch payments error:", error);
        res.status(500).json({ error: "Failed to fetch payments" });
    }
};

export const getAllFeedback = async (req, res) => {
    try {
        const query = `
            SELECT f.*, u.name as user_name, u.role as user_role, u.enrollment_id
            FROM feedback f
            JOIN users u ON f.user_id = u.id
            ORDER BY f.created_at DESC
        `;
        const result = await pool.query(query);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error("Fetch feedback error:", error);
        res.status(500).json({ error: "Failed to fetch feedback" });
    }
};

export const getAllAuditLogs = async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM audit_logs ORDER BY created_at DESC");
        res.status(200).json(result.rows);
    } catch (error) {
        console.error("Fetch audit logs error:", error);
        res.status(500).json({ error: "Failed to fetch audit logs" });
    }
};

export const createShop = async (req, res) => {
    const {
        shopName,
        ownerName,
        mobileNumber,
        email,
        location,
        initialPassword,
        upiId
    } = req.body;

    try {
        // 1. Create Seller in Firebase (Using Admin SDK)
        const firebaseUser = await admin.auth().createUser({
            email: email,
            password: initialPassword,
            phoneNumber: mobileNumber.startsWith('+91') ? mobileNumber : `+91${mobileNumber}`,
            displayName: ownerName,
        });

        const uid = firebaseUser.uid;

        // 2. Initial Custom Claims (Role Identification)
        await admin.auth().setCustomUserClaims(uid, {
            role: "seller",
            createdBy: "ADMIN"
        });

        // 3. Store Shop Data in DB
        const shopResult = await pool.query(
            `INSERT INTO shops (name, location, owner_uid, upi_id, phone, email, verification_status) 
             VALUES ($1, $2, $3, $4, $5, $6, 'VERIFIED') RETURNING id`,
            [shopName, location, uid, upiId, mobileNumber, email]
        );

        const shopId = shopResult.rows[0].id;

        // 4. Bind Shop ID to Firebase Claims for absolute security
        await admin.auth().setCustomUserClaims(uid, {
            role: "seller",
            createdBy: "ADMIN",
            shopId: shopId,
            forcePasswordReset: true
        });

        // 5. Create User Record in local users table for profile mapping
        await pool.query(
            `INSERT INTO users (uid, email, name, mobile, role, shop_id, profile_complete, force_password_reset)
             VALUES ($1, $2, $3, $4, 'seller', $5, true, true)
             ON CONFLICT (uid) DO UPDATE SET shop_id = $5, role = 'seller', force_password_reset = true`,
            [uid, email, ownerName, mobileNumber, shopId]
        );

        res.status(201).json({
            success: true,
            message: "Seller account provisioned and shop authorized",
            shopId: shopId,
            uid: uid
        });

    } catch (error) {
        console.error("Shop creation error:", error);
        res.status(500).json({
            success: false,
            error: error.message || "Failed to provision seller account"
        });
    }
};

export const getShopById = async (req, res) => {
    let { id } = req.params;

    // Handle formatted IDs like SHP_0010
    if (id && id.startsWith("SHP_")) {
        id = parseInt(id.replace("SHP_", ""), 10);
    }

    if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid node identifier format." });
    }

    try {
        const query = `
            SELECT s.*, u.name as owner, u.mobile, u.email as owner_email
            FROM shops s 
            LEFT JOIN users u ON u.shop_id = s.id AND u.role = 'seller'
            WHERE s.id = $1
        `;
        const result = await pool.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Shop not found" });
        }

        const shop = result.rows[0];

        // Dynamic aggregation for the detail view
        const orderStats = await pool.query(
            "SELECT COUNT(*) as total, MAX(created_at) as last_order FROM orders WHERE shop_id = $1",
            [id]
        );

        res.status(200).json({
            ...shop,
            totalOrders: orderStats.rows[0].total || "0",
            lastOrder: orderStats.rows[0].last_order ? new Date(orderStats.rows[0].last_order).toLocaleString() : "No orders yet",
            lastLogin: "Recent", // This would ideally come from an audit log or sessions table
            status: shop.is_active ? "Active" : "Disabled"
        });
    } catch (error) {
        console.error("Fetch shop details error:", error);
        res.status(500).json({ error: "Failed to fetch shop details" });
    }
};
