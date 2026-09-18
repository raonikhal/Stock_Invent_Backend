const nodemailer = require('nodemailer');

const sendSupportTicket = async (req, res) => {
  try {
    const { shopCode, phoneNumber, issue } = req.body;

    if (!phoneNumber || !issue) {
      return res.status(400).json({ success: false, message: 'Phone number and issue description are required.' });
    }

    // Nodemailer Transporter Configuration
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false, // true for 465, false for 587
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS, // App Password generated from Google
      },
    });

    // Email Template
    const mailOptions = {
      from: `"StockIT Support System" <${process.env.SMTP_USER}>`,
      to: process.env.SUPPORT_EMAIL, // .env se email receive hoga
      subject: `[New Support Ticket] Shop: ${shopCode || 'N/A'} - ${phoneNumber}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #D32F2F;">New Support Request Received</h2>
          <hr style="border: 0; border-top: 1px solid #eee;" />
          <p><strong>Shop Code:</strong> ${shopCode || 'N/A'}</p>
          <p><strong>Contact Phone:</strong> ${phoneNumber}</p>
          <p><strong>Issue / Suggestion:</strong></p>
          <blockquote style="background: #f9f9f9; padding: 12px; border-left: 4px solid #D32F2F; margin: 0;">
            ${issue}
          </blockquote>
          <br />
          <p style="font-size: 12px; color: #777;">Sent automatically via StockIT App Support Form.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({
      success: true,
      message: 'Ticket submitted successfully! We will contact you soon.',
    });
  } catch (error) {
    console.error('Error sending support email:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send ticket. Please try again later.',
    });
  }
};

module.exports = { sendSupportTicket };