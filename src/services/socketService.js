/**
 * Socket Service - Handles real-time communication
 */
import { Server } from "socket.io";

let io;

export const initSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: "*", // Adjust in production
            methods: ["GET", "POST"]
        }
    });

    io.on("connection", (socket) => {
        console.log(`🔌 New client connected: ${socket.id}`);

        // Join user-specific room if authenticated
        socket.on("join", (userId) => {
            socket.join(`user:${userId}`);
            console.log(`👤 User joined room: user:${userId}`);
        });

        // Join shop-specific room
        socket.on("joinShop", (shopId) => {
            socket.join(`shop:${shopId}`);
            console.log(`🏪 Joined shop room: shop:${shopId}`);
        });

        socket.on("disconnect", () => {
            console.log("🔌 Client disconnected");
        });
    });

    return io;
};

export const getIO = () => {
    if (!io) {
        throw new Error("Socket.io not initialized!");
    }
    return io;
};

/**
 * Emit to a specific user
 */
export const emitToUser = (userId, event, data) => {
    if (io) {
        io.to(`user:${userId}`).emit(event, data);
    }
};

/**
 * Emit to a specific shop
 */
export const emitToShop = (shopId, event, data) => {
    if (io) {
        io.to(`shop:${shopId}`).emit(event, data);
    }
};

/**
 * Global broadcast
 */
export const broadcast = (event, data) => {
    if (io) {
        io.emit(event, data);
    }
};
