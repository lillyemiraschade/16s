const BRAND_COLOR = "#22c55e";
const BG_COLOR = "#ffffff";
const TEXT_COLOR = "#18181b";
const MUTED_COLOR = "#71717a";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://try16s.app";

function wrap(title: string, body: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title></head>
<body style="margin:0;padding:0;background:${BG_COLOR};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:40px 24px;">
<div style="margin-bottom:32px;">
<span style="font-size:20px;font-weight:700;color:${BRAND_COLOR};">16s</span>
</div>
${body}
<div style="margin-top:40px;padding-top:20px;border-top:1px solid #e4e4e7;">
<p style="font-size:12px;color:${MUTED_COLOR};margin:0;">
Built with <a href="${APP_URL}" style="color:${BRAND_COLOR};text-decoration:none;">16s</a> — AI Web Designer
</p>
</div>
</div></body></html>`;
}

function button(text: string, url: string): string {
  return `<a href="${url}" style="display:inline-block;padding:12px 24px;background:${BRAND_COLOR};color:white;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">${text}</a>`;
}

export function welcomeEmailTemplate(userName?: string): { subject: string; html: string } {
  const name = userName || "there";
  return {
    subject: "Welcome to 16s!",
    html: wrap("Welcome to 16s", `
<h1 style="font-size:24px;color:${TEXT_COLOR};margin:0 0 16px;">Hey ${name}, welcome to 16s!</h1>
<p style="font-size:15px;color:${MUTED_COLOR};line-height:1.6;margin:0 0 24px;">
You're all set to build beautiful websites with AI. Just describe what you want in plain English and watch it come to life.
</p>
<p style="font-size:15px;color:${TEXT_COLOR};font-weight:600;margin:0 0 8px;">Here's how to get started:</p>
<ol style="font-size:14px;color:${MUTED_COLOR};line-height:1.8;padding-left:20px;margin:0 0 24px;">
<li>Type a description of your dream website</li>
<li>Upload photos or inspiration screenshots</li>
<li>Iterate with follow-up prompts until it's perfect</li>
<li>Deploy with one click</li>
</ol>
${button("Start Building", APP_URL)}
`),
  };
}

export function deployEmailTemplate(projectName: string, url: string): { subject: string; html: string } {
  return {
    subject: `Your site "${projectName}" is live!`,
    html: wrap("Site Deployed", `
<h1 style="font-size:24px;color:${TEXT_COLOR};margin:0 0 16px;">Your site is live!</h1>
<p style="font-size:15px;color:${MUTED_COLOR};line-height:1.6;margin:0 0 8px;">
<strong style="color:${TEXT_COLOR};">${projectName}</strong> has been deployed successfully.
</p>
<div style="background:#f4f4f5;border-radius:8px;padding:16px;margin:16px 0 24px;">
<p style="font-size:14px;color:${MUTED_COLOR};margin:0 0 4px;">Your URL:</p>
<a href="${url}" style="font-size:15px;color:${BRAND_COLOR};text-decoration:none;word-break:break-all;">${url}</a>
</div>
${button("Open Your Site", url)}
`),
  };
}

export function formSubmissionEmailTemplate(
  projectName: string,
  formData: Record<string, string>,
): { subject: string; html: string } {
  const senderName = formData.name || formData.Name || "Someone";
  const fieldsHtml = Object.entries(formData)
    .map(([key, value]) => `
<tr>
<td style="padding:8px 12px;font-size:12px;color:${MUTED_COLOR};text-transform:uppercase;letter-spacing:0.5px;font-weight:600;vertical-align:top;width:100px;">${key}</td>
<td style="padding:8px 12px;font-size:14px;color:${TEXT_COLOR};white-space:pre-wrap;">${String(value).replace(/</g, "&lt;")}</td>
</tr>`)
    .join("");

  return {
    subject: `New message from ${projectName}`,
    html: wrap("New Form Submission", `
<h1 style="font-size:24px;color:${TEXT_COLOR};margin:0 0 16px;">New message from your site</h1>
<p style="font-size:15px;color:${MUTED_COLOR};line-height:1.6;margin:0 0 24px;">
${senderName} submitted a form on <strong style="color:${TEXT_COLOR};">${projectName}</strong>.
</p>
<table style="width:100%;border-collapse:collapse;background:#f4f4f5;border-radius:8px;overflow:hidden;">
${fieldsHtml}
</table>
<div style="margin-top:24px;">
${button("View All Submissions", `${APP_URL}/submissions`)}
</div>
`),
  };
}

export function shareEmailTemplate(projectName: string, shareUrl: string): { subject: string; html: string } {
  return {
    subject: `"${projectName}" is now public`,
    html: wrap("Project Shared", `
<h1 style="font-size:24px;color:${TEXT_COLOR};margin:0 0 16px;">Your project is public!</h1>
<p style="font-size:15px;color:${MUTED_COLOR};line-height:1.6;margin:0 0 8px;">
<strong style="color:${TEXT_COLOR};">${projectName}</strong> is now viewable by anyone with the link.
</p>
<div style="background:#f4f4f5;border-radius:8px;padding:16px;margin:16px 0 24px;">
<p style="font-size:14px;color:${MUTED_COLOR};margin:0 0 4px;">Share link:</p>
<a href="${shareUrl}" style="font-size:15px;color:${BRAND_COLOR};text-decoration:none;word-break:break-all;">${shareUrl}</a>
</div>
${button("View Public Page", shareUrl)}
`),
  };
}
