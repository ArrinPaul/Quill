// Transactional email over Resend's HTTPS API (no SMTP ports needed).
const isEmailConfigured = () => !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

async function sendEmail(to, subject, text) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [to],
      subject,
      text,
    }),
  });
  if (!res.ok) throw new Error(`Email provider returned ${res.status}: ${await res.text()}`);
}

const sendPasswordReset = (to, resetUrl) =>
  sendEmail(
    to,
    "Reset your Quill password",
    `Use this link to choose a new password. It expires in 15 minutes.\n\n${resetUrl}\n\nIf you didn't ask for this, you can ignore this email.`
  );

module.exports = { isEmailConfigured, sendEmail, sendPasswordReset };
