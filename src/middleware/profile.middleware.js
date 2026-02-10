export const requireProfileComplete = (req, res, next) => {
    if (!req.user || !req.user.profile_complete) {
        return res.status(409).json({
            error: "Profile incomplete"
        });
    }
    next();
};
