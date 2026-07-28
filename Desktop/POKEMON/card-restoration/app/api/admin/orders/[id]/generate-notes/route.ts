import { cookies } from "next/headers";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

const CardSchema = z.object({
  card_name: z.string(),
  card_set: z.string().nullable().optional(),
  card_number: z.string().nullable().optional(),
  estimated_value_cents: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
  tier: z.string().nullable().optional(),
});

const BodySchema = z.object({
  cards: z.array(CardSchema).min(1),
  order_tier: z.string().nullable().optional(),
  customer_notes: z.string().nullable().optional(),
  admin_context: z.string().nullable().optional(),
});

const SYSTEM_PROMPT = `You write professional grader notes for The Card Doc, a card restoration service.
You are given information about one or more cards a customer submitted for restoration, including the card name, set, number, estimated value, tier, and the customer's description of the damage or request.

Output rules:
- For each card, write a bolded header line with the card name and set/card number in parentheses, using markdown bold (**Card Name (Set - #Number)**).
- Follow with exactly 3 sentences describing the restoration work, based on the specific issues mentioned in that card's notes.
  1. Reference the actual damage/issue mentioned (edge lift, crease, dent, soft corners, dimple, etc.)
  2. Describe using restoration methods: humidity treatment, crease tool and clamp work for repairing lifts/creases/dents
  3. Describe cleaning with The Card Doc cleaning spray and polishing with The Card Doc polish to reduce scratching and enhance holo/shine
- If a flaw is mentioned as likely unfixable (e.g., whiting, print defects), acknowledge it honestly rather than claiming it was fixed.
- If the card is just going to grading with no repair requested, keep it light — cleaning/polish only, no structural work mentioned.
- If something unusual is requested (e.g., "crack the slab"), include that step naturally.
- Do NOT put "Thank you for trusting The Card Doc." after each individual card. Only include that sign-off line once, at the very end of the entire message, after all card descriptions.
- Keep tone professional but warm — written like a note to the customer explaining what was done.
- If multiple cards are submitted, number/list them clearly (card name as its own bolded line) so it's easy to tell them apart.`;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const jar = await cookies();
  if (jar.get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  await params; // id not needed — we trust the body

  const raw = await request.json();
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { cards, order_tier, customer_notes, admin_context } = parsed.data;

  // Build a structured user message from the card data
  const tierLabel = (t: string | null | undefined) => {
    const map: Record<string, string> = {
      regular: "Bronze (Regular)",
      expedited: "Silver (Expedited)",
      premium: "Gold (Premium)",
      ultra_premium: "Platinum (Ultra Premium)",
      elite: "Diamond (Elite)",
    };
    return t ? (map[t] ?? t) : "Unknown";
  };

  const cardLines = cards.map((card, i) => {
    const tier = card.tier ?? order_tier ?? null;
    const value = card.estimated_value_cents
      ? `$${(card.estimated_value_cents / 100).toFixed(0)}`
      : null;
    const parts = [
      `Card ${i + 1}: ${card.card_name}`,
      card.card_set ? `Set: ${card.card_set}` : null,
      card.card_number ? `Card #: ${card.card_number}` : null,
      tier ? `Tier: ${tierLabel(tier)}` : null,
      value ? `Estimated value: ${value}` : null,
      card.notes ? `Customer notes: ${card.notes}` : "Customer notes: No damage notes provided — general cleaning and prep for grading.",
    ].filter(Boolean);
    return parts.join("\n");
  });

  const userMessage = [
    customer_notes ? `General order notes from customer: ${customer_notes}` : null,
    ...cardLines,
    admin_context ? `Additional context from the restorer (use this to inform the notes — do not copy verbatim, weave it in naturally): ${admin_context}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const message = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const text = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  return Response.json({ notes: text });
}
