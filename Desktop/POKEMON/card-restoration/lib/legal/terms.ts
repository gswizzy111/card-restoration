/**
 * The Terms of Service, as content both sites render (app/(public)/terms).
 * Keep both sites' copies identical. A block is a paragraph or a list; text
 * may contain [label](/path) links. The version in effect at checkout governs
 * an order, so bump TERMS_UPDATED whenever the wording changes.
 */
export const TERMS_UPDATED = "October 22, 2026";

export type TermsBlock = string | { list: string[] };
export type TermsSection = { id: string; title: string; blocks: TermsBlock[] };

export const TERMS_INTRO: string[] = [
  "These Terms of Service (\"Terms\") are an agreement between you and The Card Doc LLC (\"The Card Doc,\" \"we,\" \"us\"). They apply to every order for restoration, prep and related services, and to purchases from our shop, placed on thecarddoc1.com or theonethatsaveditall.com.",
  "By placing an order and signing at checkout, you agree to these Terms. If you don't agree, please don't place an order. The version of these Terms shown when you check out governs that order.",
];

export const TERMS_SECTIONS: TermsSection[] = [
  {
    id: "who-we-are",
    title: "1. Who we are",
    blocks: [
      "The Card Doc LLC is a trading card restoration and grading-prep shop in Ridgewood, New Jersey. We work by mail for customers in the United States and Puerto Rico, and take local drop-offs by appointment.",
      "You can reach us on Instagram at @the_card_doc or by email at thecarddoc1@gmail.com. Written notices to us go to: The Card Doc LLC, 50 E Ridgewood Ave, PMB 295, Ridgewood, NJ 07450.",
    ],
  },
  {
    id: "services",
    title: "2. Our services",
    blocks: [
      {
        list: [
          "Restoration (includes Prep): hands-on work on a card's condition, such as dents, creases, edge and corner lifts and surface grime, using humidity, specialized tools, pressing and clamps. We never use harsh chemicals or add material to a card. Every restoration finishes with full Prep.",
          "Prep: a grader-safe surface clean, inspection under bright light, and fresh sleeving into a Card Saver. Prep is not restorative and carries zero alteration risk.",
          "Add-ons offered at checkout, such as slab removal (\"slab cracking\"), pre-grade assessment, an Instagram feature, signature confirmation and shipping insurance.",
          "Restoration kits and other products from our shop (see Section 15).",
        ],
      },
      "We never submit cards to grading companies for you. We return your cards to you, and you decide whether, when and where to submit them.",
    ],
  },
  {
    id: "ordering",
    title: "3. Placing an order",
    blocks: [
      {
        list: [
          "We accept orders from the United States and Puerto Rico only.",
          "Add each card to your order individually, with its details, its current declared value and 1 to 4 clear photos.",
          "Declared value is what the card is worth right now, in its current condition (raw or graded, whichever it is today). It is not the value it might have after grading. Your declared value decides which tiers the card can use and its price.",
          "Tiers (Bronze, Silver, Gold, Platinum, Diamond and Fast Pass) differ in turnaround speed and in the declared values they accept; every tier gets the same care. Each tier's price, turnaround estimate and declared-value range are shown when you book.",
          "Tiers, services and add-ons lock at checkout. After checkout, changes are possible only where your order page offers them (such as upgrading your tier or adding cards) or with our written agreement.",
          "If a card is strictly for your personal collection (not being graded), say so in your order notes so we know which techniques are on the table.",
        ],
      },
      "Removing cards from grading-company holders requires a separate [Slab-Removal Authorization](/agreements/slab-removal), signed at checkout. Each card with a declared value above $5,000 requires its own [High-Value Card Agreement](/agreements/high-value), signed at checkout.",
      "We may decline any card or order before work begins. If we do, we refund the service fees for the declined cards.",
    ],
  },
  {
    id: "your-promises",
    title: "4. Your promises",
    blocks: [
      "For every card you send, you promise that:",
      {
        list: [
          "you own it, or you have the owner's permission to send it and to agree to these Terms for it;",
          "it is genuine, not stolen, and free of any claim by someone else;",
          "the information you give us, including its declared value, is true and complete; and",
          "you have told us about any restoration, trimming, recoloring, cleaning or other work done to it that you know of.",
        ],
      },
      "If we reasonably believe a card is counterfeit, stolen, or materially misrepresented, we may decline it, hold it while we contact you, and cooperate with law enforcement where the law requires.",
    ],
  },
  {
    id: "payment",
    title: "5. Payment, discounts and cancellations",
    blocks: [
      {
        list: [
          "Payment, including New Jersey sales tax where it applies, is collected in full at checkout.",
          "Creator codes, coupons, loyalty discounts and bulk discounts (where offered) apply as shown at checkout, to service fees only, not to shipping or add-ons. Discounts don't combine: an order gets the largest one that applies. Gift cards apply as payment.",
          "Cancellations are handled by a person: contact us. If work on a card hasn't started, we cancel it and refund its service fee, less any shipping costs already paid for or used. Once work on a card has started, its service fee is not refundable except as these Terms provide.",
          "If you dispute a payment or charge it back after we have done the work, we may decline future orders and recover what is owed.",
        ],
      },
    ],
  },
  {
    id: "shipping-to-us",
    title: "6. Shipping your cards to us",
    blocks: [
      "Pack each card in a penny sleeve, then inside a Card Saver 1 or toploader. Sandwich the holders between two pieces of rigid cardboard, wrap them in bubble wrap, and seal them inside a padded mailer or small box so nothing shifts.",
      "Shipping insurance is optional and is not automatically included. You decide whether to insure your package. Insurance you buy at checkout covers the shipments you chose (to us, or both ways) up to the amount you insure, under the insurer's terms. It doesn't cover cards while they are in our shop.",
      "Until we check your package in, the risk of loss, damage or delay in transit is yours (and your carrier's or insurer's), including when you use a prepaid label we provide. The carrier is not our agent.",
      "Carrier tracking that says \"Delivered\" means your package reached our PO Box. We collect once a day, so allow 1 to 3 business days after delivery for check-in.",
    ],
  },
  {
    id: "check-in",
    title: "7. Check-in and evaluation",
    blocks: [
      "When we open your package we log every card and take \"before\" photos, and your order status changes to Cards Received. If something doesn't match your order, we contact you before doing any work. Every card is evaluated before work begins:",
      {
        list: [
          "No upside, no charge: if we can't improve a restoration card, we refund its service fee and ship it back untouched. You cover shipping both ways.",
          "No unnecessary work: if a card booked for restoration only needs a clean, we downgrade it to Prep so you don't overpay.",
          "No surprise charges: if we spot fixable damage during a Prep order, we ask your permission, and tell you any added cost, before doing restoration work.",
        ],
      },
    ],
  },
  {
    id: "results",
    title: "8. Results, grading and alteration risk",
    blocks: [
      "Restoration involves professional judgment, and results vary from card to card. We don't guarantee any result, any grade, any grade increase, or that a grading company won't detect restoration.",
      "Prep carries zero alteration risk. Restoration stays within grading limits, adds no material and only works with what is already there, but there is always an inherent risk, low but not zero, that a grading company detects it or returns a card as altered (or a similar designation).",
      "If you have a concern about a finished card, contact us within 14 days after it is delivered to you. We'll review it with you and, where we believe more work could help, offer to re-evaluate the card. A re-evaluation doesn't change the rest of this section.",
    ],
  },
  {
    id: "turnaround",
    title: "9. Turnaround",
    blocks: [
      "Turnaround times are estimates, not guarantees. They start when your order status reaches Cards Received (or when your cards arrive, for Fast Pass) and don't include shipping time. Multiple rounds of work are normal and are built into the estimates. Delays don't change the price of your order.",
    ],
  },
  {
    id: "return-shipping",
    title: "10. Return shipping and claims",
    blocks: [
      "We return your cards in fresh penny sleeves and Card Savers, between protective plates in a bubble mailer, and post the tracking number on your order page. Cards removed from slabs come back raw in Card Savers.",
      "Once your package is handed to the carrier for return, loss or damage in transit is covered only by any return insurance you bought; we will help you file a claim with the carrier or insurer.",
      "Please inspect your cards when they arrive and tell us about any problem in writing (Instagram message or email) within 14 days after delivery, with photos. We review every claim in good faith.",
    ],
  },
  {
    id: "responsibility",
    title: "11. Our responsibility for your cards",
    blocks: [
      "We take reasonable care of your cards from the moment we check them in until we hand them to the carrier for return.",
      "If a card is lost, stolen, destroyed or damaged while we have it, including through the risks of the work described in Section 8 and in the Slab-Removal Authorization, our responsibility is limited to refunding the service fee you paid for that card. It does not extend to the card's market or declared value. If you want a valuable card's full value covered while it's with us, insure it yourself (for example with a collectibles insurance policy).",
      "We are not responsible for carriers or grading companies, or for indirect or consequential losses such as lost profits or resale opportunities, or sentimental value. The limits in this section don't apply to loss or damage caused by our gross negligence or willful misconduct, and nothing in these Terms takes away any right you have under New Jersey law that cannot be waived by contract.",
    ],
  },
  {
    id: "slab-removal",
    title: "12. Slab removal",
    blocks: [
      "We crack a slab only with a signed [Slab-Removal Authorization](/agreements/slab-removal) for that card. Removal permanently destroys the holder and its label, separates the card from its grade and certification number, and carries a small risk of damage to the card. The slab-removal fee is charged per card and is not refundable once a holder has been opened. A \"review\" note on a slabbed card means we assess it without cracking it.",
    ],
  },
  {
    id: "high-value",
    title: "13. Cards declared above $5,000",
    blocks: [
      "Every card with a declared value above $5,000 needs its own signed [High-Value Card Agreement](/agreements/high-value) before we accept it. We may ask for more photos or information about a high-value card and may decline it before work begins, refunding its service fee. We strongly recommend insured, tracked shipping with signature confirmation for these cards, and your own insurance for their full value while they're with us, since our responsibility is limited as described in Section 11.",
    ],
  },
  {
    id: "unclaimed",
    title: "14. Cards we can't return",
    blocks: [
      "If we can't return your cards (for example, a return is refused or undeliverable, your address is invalid, a balance you agreed to is unpaid, or we can't reach you), we keep them safe and contact you by email, phone or text, and Instagram where we have it.",
      {
        list: [
          "If your cards are still unclaimed 90 days after our first attempt to reach you, we will send you a formal written notice by certified mail and by email to your last known addresses. It will describe the cards, explain how to get them back, and give you at least 30 days to respond.",
          "We will not treat your cards as abandoned, or take ownership of them, just because time has passed. If you don't respond to the formal notice, we will continue to hold your cards and will take any further step only as New Jersey law allows.",
          "You will pay the cost of any return shipping we arrange for you.",
        ],
      },
    ],
  },
  {
    id: "shop",
    title: "15. Kits and shop orders",
    blocks: [
      "Restoration kits and other products from our shop are retail purchases and ship like a standard retail order. Sections 3 and 6 through 14, which are about cards you send us, don't apply to shop orders.",
    ],
  },
  {
    id: "photos",
    title: "16. Photos of your cards",
    blocks: [
      "We photograph cards at check-in and during our work. We may share photos or video of cards we have worked on to show our work, without your name or personal details unless you agree. The Instagram feature add-on is a separate, paid video of your card.",
    ],
  },
  {
    id: "disputes",
    title: "17. Disputes and governing law",
    blocks: [
      "New Jersey law governs these Terms and every order, without regard to conflict-of-law rules.",
      "If something goes wrong, please contact us first so we can try to resolve it; this doesn't change any legal deadline.",
      "Any dispute between you and us about these Terms, an order or our services will be decided in court, not by arbitration: in the Superior Court of New Jersey in Bergen County, or in the United States District Court for the District of New Jersey, and you and we agree to the jurisdiction of those courts. Either of us may instead bring a claim that qualifies in the Small Claims Section of the Special Civil Part of the Superior Court of New Jersey.",
    ],
  },
  {
    id: "changes",
    title: "18. Changes to these Terms",
    blocks: [
      "We may update these Terms from time to time. The version shown when you check out governs that order; updates apply only to orders placed after they take effect.",
    ],
  },
  {
    id: "general",
    title: "19. General",
    blocks: [
      "These Terms, together with the agreements you sign at checkout and your order details, are the whole agreement between you and us about your order. If a court finds part of these Terms unenforceable, the rest stays in effect. Not enforcing a term right away doesn't waive it.",
    ],
  },
];
