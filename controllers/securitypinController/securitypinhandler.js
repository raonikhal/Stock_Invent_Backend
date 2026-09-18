const { prisma } = require("../../config/db");
const bcrypt = require('bcrypt');
const { sendEmail } = require("../../services/emailService"); // Nodemailer setup path adjust karein

// 1. Create OR Update Security PIN
const updateSecurityPin = async (req, res) => {
    try {
        console.log("Create or Update security pin is Received");

        const { currentPin, securityPin, isOtpVerified } = req.body;
        const phone = req.user?.phone;

        if (!phone) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized request"
            });
        }

        if (!securityPin || securityPin.length < 4) {
            return res.status(400).json({
                success: false,
                message: "Valid 4-digit PIN required"
            });
        }

        const user = await prisma.user.findUnique({
            where: { phone: phone },
            select: { id: true, securityPin: true }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // OTP verified ho toh currentPin validation skip hoga
        if (user.securityPin && !isOtpVerified) {
            if (!currentPin) {
                return res.status(400).json({
                    success: false,
                    message: "Current PIN is required to set a new PIN"
                });
            }

            const isMatch = await bcrypt.compare(currentPin, user.securityPin);
            if (!isMatch) {
                return res.status(400).json({
                    success: false,
                    message: "Incorrect current PIN"
                });
            }
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPin = await bcrypt.hash(securityPin, salt);

        await prisma.user.update({
            where: { phone: phone },
            data: { securityPin: hashedPin }
        });

        return res.status(200).json({
            success: true,
            hasPin: true,
            message: user.securityPin
                ? "Security PIN updated successfully"
                : "Security PIN created successfully"
        });

    } catch (error) {
        console.error("Error updating security PIN:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while processing security PIN"
        });
    }
};


// 2. Check if PIN Exists
const checkPinStatus = async (req, res) => {
    try {
        console.log("Pin status received");
        const phone = req.user?.phone;

        if (!phone) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const user = await prisma.user.findUnique({
            where: { phone: phone },
            select: { securityPin: true }
        });

        return res.status(200).json({
            success: true,
            hasPin: Boolean(user?.securityPin)
        });
    } catch (error) {
        console.error("Error checking PIN status:", error);
        return res.status(500).json({ success: false, hasPin: false });
    }
};





// 3. Verify Security PIN (App Lock / Action confirmation)
const verifySecurityPin = async (req, res) => {
    try {
        console.log("verify pin received");
        const { pin } = req.body;
        const phone = req.user?.phone;

        if (!pin || pin.length < 4) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid PIN"
            });
        }

        const user = await prisma.user.findUnique({
            where: { phone: phone },
            select: { securityPin: true }
        });

        if (!user || !user.securityPin) {
            return res.status(404).json({
                success: false,
                message: "No PIN set for this account"
            });
        }

        const isMatch = await bcrypt.compare(pin, user.securityPin);

        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: "Incorrect PIN"
            });
        }

        return res.status(200).json({
            success: true,
            message: "PIN verified successfully"
        });

    } catch (error) {
        console.error("Error verifying PIN:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};





// 4. Forgot PIN: Generate & Send OTP to User Email
const forgotPin = async (req, res) => {
    try {
        console.log("Forgot PIN request received");
        const phone = req.user?.phone;

        if (!phone) {
            return res.status(401).json({ success: false, message: "Unauthorized request" });
        }

        const user = await prisma.user.findUnique({
            where: { phone: phone },
            select: { id: true, email: true }
        });

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Generate 4-digit random OTP
        const rawOtp = Math.floor(1000 + Math.random() * 9000).toString();
        const hashedOtp = await bcrypt.hash(rawOtp, 10);
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

        await prisma.user.update({
            where: { phone: phone },
            data: {
                pinResetOtp: hashedOtp,
                pinResetOtpExpiry: otpExpiry
            }
        });

        // Email Send logic
        await sendEmail({
            to: user.email,
            subject: "Reset Security PIN - OTP",
            text: `Your OTP for resetting the security PIN is ${rawOtp}. It will expire in 10 minutes.`
        });

        return res.status(200).json({
            success: true,
            message: "OTP sent to your registered email address"
        });

    } catch (error) {
        console.error("Error in forgot PIN:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to send OTP for PIN reset"
        });
    }
};




// 5. Verify OTP & Reset Old PIN
const verifyPinOtp = async (req, res) => {
    try {
        console.log("Verify PIN OTP request received");
        const { otp } = req.body;
        const phone = req.user?.phone;

        if (!phone) {
            return res.status(401).json({ success: false, message: "Unauthorized request" });
        }

        if (!otp || otp.length !== 4) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid 4-digit OTP"
            });
        }

        const user = await prisma.user.findUnique({
            where: { phone: phone },
            select: {
                pinResetOtp: true,
                pinResetOtpExpiry: true
            }
        });

        if (!user || !user.pinResetOtp || !user.pinResetOtpExpiry) {
            return res.status(400).json({
                success: false,
                message: "No OTP request found for this user"
            });
        }

        // Expiry validation
        if (new Date() > new Date(user.pinResetOtpExpiry)) {
            return res.status(400).json({
                success: false,
                message: "OTP has expired. Please request a new one"
            });
        }

        // Match OTP
        const isOtpValid = await bcrypt.compare(otp, user.pinResetOtp);
        if (!isOtpValid) {
            return res.status(400).json({
                success: false,
                message: "Invalid OTP"
            });
        }

        // Clear securityPin and reset OTP fields
        await prisma.user.update({
            where: { phone: phone },
            data: {
                securityPin: null,
                pinResetOtp: null,
                pinResetOtpExpiry: null
            }
        });

        return res.status(200).json({
            success: true,
            hasPin: false, // Allows Flutter state to shift directly to Set PIN screen
            message: "OTP verified. You can now set a new security PIN"
        });

    } catch (error) {
        console.error("Error verifying PIN OTP:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while verifying OTP"
        });
    }
};

module.exports = {
    updateSecurityPin,
    checkPinStatus,
    verifySecurityPin,
    forgotPin,
    verifyPinOtp
};