const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { prisma } = require("../../config/db");
const { sendEmail } = require('../../services/emailService');

// 1. Send OTP to Registered Email via Shop
const forgotPassword = async (req, res) => {
    try {
        const { phoneNumber } = req.body;

        if (!phoneNumber) {
            return res.status(400).json({ success: false, message: 'Phone number is required' });
        }

        // Shop table query + Owner/User email fetch
        const shop = await prisma.shop.findUnique({ 
            where: { phone: phoneNumber },
            include: {
                users: true // Relational user email lene ke liye
            }
        });

        if (!shop) {
            return res.status(404).json({
                success: false,
                message: 'No shop account found with this phone number',
            });
        }

        // Target Email: First attempt to get linked user email, fallback if email missing
        const targetEmail = shop.users?.[0]?.email;

        if (!targetEmail || targetEmail.endsWith('@stockinvent.local')) {
            return res.status(400).json({
                success: false,
                message: 'No valid email address linked to this shop account.',
            });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

        // Shop Table Update
        await prisma.shop.update({
            where: { id: shop.id },
            data: {
                passwordResetOtp: otp,
                passwordResetOtpExpiry: otpExpiresAt
            },
        });

        // Send Email
        await sendEmail({
            to: targetEmail,
            subject: 'StockIT - Shop Password Reset OTP',
            html: `
        <div style="font-family: Arial; padding: 20px;">
          <h2>Password Reset Request</h2>
          <p>Your OTP for resetting Shop (<b>${shop.shopName}</b>) password is:</p>
          <h1 style="color: #FF5252; letter-spacing: 4px;">${otp}</h1>
          <p>This OTP is valid for 10 minutes.</p>
        </div>
      `,
        });

        const maskedEmail = targetEmail.replace(/(.{2})(.*)(?=@)/, (gp1, gp2, gp3) => gp2 + "*".repeat(gp3.length));

        return res.status(200).json({
            success: true,
            message: `OTP sent to ${maskedEmail}`,
            email: maskedEmail,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Server error sending OTP' });
    }
};

// 2. Verify OTP
const verifyResetOtp = async (req, res) => {
    try {
        const { phoneNumber, otp } = req.body;

        const shop = await prisma.shop.findUnique({ where: { phone: phoneNumber } });

        if (
            !shop ||
            shop.passwordResetOtp !== otp ||
            !shop.passwordResetOtpExpiry ||
            shop.passwordResetOtpExpiry < new Date()
        ) {
            return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');

        await prisma.shop.update({
            where: { id: shop.id },
            data: {
                passwordResetOtp: null,
                passwordResetOtpExpiry: null,
                passwordResetToken: resetToken,
            },
        });

        return res.status(200).json({
            success: true,
            message: 'OTP verified successfully',
            resetToken,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Server error verifying OTP' });
    }
};

// 3. Reset New Password
const resetPassword = async (req, res) => {
    try {
        const { phoneNumber, resetToken, newPassword } = req.body;

        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 chars' });
        }

        const shop = await prisma.shop.findUnique({ where: { phone: phoneNumber } });

        if (!shop || shop.passwordResetToken !== resetToken) {
            return res.status(400).json({ success: false, message: 'Invalid or expired reset session' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await prisma.shop.update({
            where: { id: shop.id },
            data: {
                password: hashedPassword,
                passwordResetToken: null,
            },
        });

        return res.status(200).json({
            success: true,
            message: 'Shop password reset successful! Please login with your new password.',
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Server error resetting password' });
    }
};

module.exports = { forgotPassword, verifyResetOtp, resetPassword };