const nodemailer = require('nodemailer');

// SMTP Transporter configuration
const transporter = nodemailer.createTransport({
    service: 'gmail', // ya aapka SMTP host
    auth: {
        user: process.env.EMAIL_USER, // Aapka email (e.g., .env file se)
        pass: process.env.EMAIL_PASS  // App password
    }
});

const sendEmail = async ({ to, subject, text, html }) => {
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to,
            subject,
            text,
            html
        };

        const info = await transporter.sendMail(mailOptions);
        console.log("Email sent successfully:", info.response);
        return info;
    } catch (error) {
        console.error("Error sending email:", error);
        throw error;
    }
};

module.exports = { sendEmail };