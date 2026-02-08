export const requireProfileComplete = (req, res, next) => {
    if (!req.user || !req.user.enrollment_id || !req.user.mobile || !req.user.profile_completed) {
        return res.status(409).json({
            error: "Profile incomplete"
        });
    }
    next();
};
