/**
 * The body of the account emails (confirm your email, reset your password):
 * an HTML version and a plain-text version with the same words. The link is
 * also printed under the button, for mail apps that hide buttons, and the
 * email says where to get help (the site points people to Instagram DMs).
 */
const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export const INSTAGRAM_HANDLE = "@the_card_doc";
const INSTAGRAM_URL = "https://www.instagram.com/the_card_doc";

export function accountEmail(opts: {
  heading: string;
  /** First name, or empty for no greeting */
  greetingName: string;
  /** Follows "Hi Name, " so it starts lowercase; capitalized when there's no greeting */
  body: string;
  button: string;
  link: string;
  /** Button color */
  color: string;
}): { html: string; text: string } {
  const lead = opts.greetingName
    ? `Hi ${opts.greetingName}, ${opts.body}`
    : opts.body.charAt(0).toUpperCase() + opts.body.slice(1);
  const expiry = "This link works once and expires in 1 hour. Didn't ask for this? Ignore this email.";
  const help = `Questions? DM us on Instagram at ${INSTAGRAM_HANDLE}.`;

  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#111">
      <h1 style="font-size:22px;font-weight:900;margin:0 0 12px">${esc(opts.heading)}</h1>
      <p style="font-size:15px;line-height:1.6;color:#333">${esc(lead)}</p>
      <a href="${opts.link}" style="display:inline-block;background:${opts.color};color:#fff;padding:13px 26px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;margin:12px 0">${esc(opts.button)}</a>
      <p style="font-size:13px;color:#555;line-height:1.5;margin:8px 0 0">Button not working? Copy this link into your browser:<br><a href="${opts.link}" style="color:${opts.color};word-break:break-all">${opts.link}</a></p>
      <p style="font-size:12px;color:#888;line-height:1.5;margin:16px 0 0">${esc(expiry)}</p>
      <p style="font-size:12px;color:#888;line-height:1.5;margin:8px 0 0">Questions? DM us on Instagram at <a href="${INSTAGRAM_URL}" style="color:#888">${INSTAGRAM_HANDLE}</a>.</p>
    </div>
  `;
  const text = [opts.heading, "", lead, "", `${opts.button}: ${opts.link}`, "", expiry, help].join("\n");
  return { html, text };
}
