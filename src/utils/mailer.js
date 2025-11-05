const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail", 
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

exports.sendMail = async ({ to, subject, html, text }) => {
  const mailOptions = {
    from: `"Movie Web" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html: html || undefined,
    text: text || undefined,
  };

  return transporter.sendMail(mailOptions);
};
