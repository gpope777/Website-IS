import type { APIRoute } from "astro";
import { z } from "zod";
import { Resend } from "resend";
import { checkRateLimit } from "@/lib/rate-limit";

export const prerender = false;

const ContactSchema = z.object({
  nombre: z.string().min(2).max(80),
  email: z.string().email(),
  organizacion: z.string().min(2).max(120),
  mensaje: z.string().min(20).max(2000),
  _website: z.string().max(0).optional(),
});

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const ip = clientAddress ?? "unknown";

  if (!checkRateLimit(ip)) {
    return new Response(JSON.stringify({ ok: false, error: "rate_limit" }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ ok: false, error: "invalid_json" }), { status: 400 });
  }

  // Honeypot check — happens BEFORE Zod so bots see a 200 not a 400
  if (body && typeof body === "object" && "_website" in body && (body as { _website?: unknown })._website) {
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  const parsed = ContactSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ ok: false, error: "validation", details: parsed.error.flatten() }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = import.meta.env.RESEND_API_KEY;
  const to = import.meta.env.CONTACT_EMAIL;
  const from = import.meta.env.RESEND_FROM ?? "noreply@innovationaltms.com";

  // If env vars aren't set (preview / local), log and return success to avoid blocking dev
  if (!apiKey || !to) {
    console.info("[contacto] env vars missing, would have sent:", parsed.data);
    return new Response(JSON.stringify({ ok: true, dev: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  const resend = new Resend(apiKey);
  const html = `
    <h2>Nuevo mensaje desde innovationaltms.com</h2>
    <p><strong>Nombre:</strong> ${escape(parsed.data.nombre)}</p>
    <p><strong>Email:</strong> ${escape(parsed.data.email)}</p>
    <p><strong>Organización:</strong> ${escape(parsed.data.organizacion)}</p>
    <p><strong>Mensaje:</strong></p>
    <p>${escape(parsed.data.mensaje).replace(/\n/g, "<br>")}</p>
  `;

  try {
    await resend.emails.send({
      from: `Innovational TMS <${from}>`,
      to,
      replyTo: parsed.data.email,
      subject: `Nuevo mensaje de ${parsed.data.nombre} (${parsed.data.organizacion})`,
      html,
    });
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[contacto] Resend error:", e);
    return new Response(JSON.stringify({ ok: false, error: "send_failed" }), { status: 502, headers: { "Content-Type": "application/json" } });
  }
};

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
