module.exports = {
    apps: [
        {
            name: "api",
            script: "src/server.js",
            instances: 1,            // 2 API servers
            exec_mode: "cluster",
            env: {
                NODE_ENV: "production",
                PORT: 5000
            }
        },
        {
            name: "pdf-worker",
            script: "src/queue/pdfWorker.js",
            instances: 2,             // 2 workers
            exec_mode: "fork"
        },
        {
            name: "cleanup-worker",
            script: "src/queue/cleanupWorker.js",
            instances: 1,             // only 1 cleanup worker
            exec_mode: "fork"
        }
    ]
};
