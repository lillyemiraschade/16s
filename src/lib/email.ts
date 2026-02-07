import { Resend } from "resend";
import {
  welcomeEmailTemplate,
  deployEmailTemplate,
  formSubmissionEmailTemplate,
  shareEmailTemplate,
} from "@/lib/email-templates";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.RESEND_FROM_EMAIL || "hello@try16s.app";

async function sendEmail(to: string, subject: string, html: string) {
  if (!resend) return;
  try {
    await resend.emails.send({ from: FROM, to, subject, html });
  } catch (err) {
    console.debug("[Email] Failed to send:", err);
  }
}

export async function sendWelcomeEmail(to: string, userName?: string) {
  const { subject, html } = welcomeEmailTemplate(userName);
  await sendEmail(to, subject, html);
}

export async function sendDeployEmail(to: string, projectName: string, url: string) {
  const { subject, html } = deployEmailTemplate(projectName, url);
  await sendEmail(to, subject, html);
}

export async function sendFormNotification(to: string, projectName: string, formData: Record<string, string>) {
  const { subject, html } = formSubmissionEmailTemplate(projectName, formData);
  await sendEmail(to, subject, html);
}

export async function sendShareEmail(to: string, projectName: string, shareUrl: string) {
  const { subject, html } = shareEmailTemplate(projectName, shareUrl);
  await sendEmail(to, subject, html);
}
