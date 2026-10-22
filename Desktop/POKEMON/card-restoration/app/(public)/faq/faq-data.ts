// The FAQ, grouped by topic. Answers are plain text; "@the_card_doc" becomes
// a link to Instagram where it's shown.
export type FaqItem = { q: string; a: string };
export type FaqSection = { id: string; title: string; items: FaqItem[] };

export const FAQ_SECTIONS: FaqSection[] = [
  {
    id: "before-you-order",
    title: "Before You Order",
    items: [
      {
        q: "Can I ask about my card before I order?",
        a: "Yes — send us photos first, free. Message @the_card_doc with the front, back, and close-ups of any damage, and we'll give you an honest read on what's possible before you spend anything.",
      },
      {
        q: "I'm thinking about buying a card — can you tell me if it's fixable before I buy it?",
        a: "Yes, this is common. Send us the listing photos (or a link) before you purchase, and we'll tell you honestly whether it's something we can work on.",
      },
      {
        q: "What photos should I send?",
        a: "Send photos of the front, back, and close-ups of the damage in good light. If Instagram won't let you attach photos, let us know in the chat, and we'll help you get them through.",
      },
      {
        q: "Where are you located?",
        a: "Ridgewood, New Jersey. We're a mail-in service for the whole US, with local drop-off available. Contact @the_card_doc on Instagram for drop-off.",
      },
      {
        q: "Do you have before-and-after examples?",
        a: "Yes — check the highlights on our Instagram story.",
      },
    ],
  },
  {
    id: "cards",
    title: "Cards We Work On",
    items: [
      {
        q: "What kinds of cards do you work on?",
        a: "Trading cards of all kinds — Pokémon, baseball, basketball, football, hockey, Magic: The Gathering, Yu-Gi-Oh!, and others. Vintage and modern, including chrome cards (Topps Chrome, Panini) and metal cards (Metal Universe).",
      },
      {
        q: "Do you work on vintage cards?",
        a: "Yes — vintage and modern are both welcome, including wax-residue cleanup on vintage cards.",
      },
      {
        q: "Do you work on slabbed (already graded) cards?",
        a: "Yes — add slab cracking at checkout ($7/card) and we'll remove the card before work. You'll sign a separate Slab Removal Authorization for each slab at checkout, naming the card.",
      },
    ],
  },
  {
    id: "pricing",
    title: "Pricing & Tiers",
    items: [
      {
        q: "Which tier should I pick?",
        a: "If timing doesn't matter, pick the lowest tier your card's value fits into — the work is identical. Pick a higher tier only when you want it back faster.",
      },
      {
        q: "What does \"declared value\" mean? Raw or graded?",
        a: "It's what your card is worth right now, in its current condition — raw or graded, whichever it is today. Not the PSA 10 price, and not what it might be worth after grading. You declare it when you book, and it sets your tier and price.",
      },
      {
        q: "Does the price depend on how damaged the card is?",
        a: "No. Pricing is based on the card's declared value and the tier's turnaround — never on the severity of the damage.",
      },
      {
        q: "Do you charge extra to crack a slab?",
        a: "Slab cracking is a $7 per-card add-on, selected at checkout. You'll sign a separate Slab Removal Authorization for each slab at checkout.",
      },
      {
        q: "Do you take cards worth more than $5,000?",
        a: "Yes. Every card declared above $5,000 needs its own High-Value Agreement before we begin work. We email it after you order, and the card stays on hold until both of us sign. We strongly recommend insured, tracked shipping with signature confirmation for it.",
      },
    ],
  },
  {
    id: "prep-vs-restoration",
    title: "Prep vs Restoration",
    items: [
      {
        q: "What's the difference between prep and restoration?",
        a: "Prep is a surface clean and full inspection that gets your card submission-ready for grading — nothing restorative. Restoration is hands-on work on the card's condition (dents, creases, lifts, dirt, and more). Prep is about grading; restoration is about improving the card itself.",
      },
      {
        q: "Is prep included with restoration?",
        a: "Yes — restoration includes prep. Every restoration order is prepped as part of the service, so you never need to add prep separately to a restoration order. Prep is also available as its own standalone service.",
      },
      {
        q: "What if you find damage while prepping my card?",
        a: "We'll let you know, and you decide whether you'd like to add restoration. We never do extra work without asking you first.",
      },
      {
        q: "I'm not sure if I need restoration — what should I book?",
        a: "Book prep, and add a note on the order (or a Post-it in the package) saying \"review all for restoration.\" We'll evaluate every card when it arrives and contact you about any good restoration candidates. For slabbed cards, a \"review\" note means we assess grade-bump potential without cracking the slab.",
      },
    ],
  },
  {
    id: "grading",
    title: "Grading & PSA",
    items: [
      {
        q: "Do you submit my card to PSA for me?",
        a: "No. We ship your card back to you in a fresh penny sleeve and Card Saver, and you submit to PSA, BGS, CGC, or any grader yourself. Repeatedly submitting from our address could tip graders off, so this protects you too.",
      },
      {
        q: "Will PSA detect the restoration? Will it come back \"altered\"?",
        a: "There is always an inherent risk — low, but not zero. We add no material and only manipulate what's already there.",
      },
      {
        q: "Can you guarantee a grade — or a PSA 10?",
        a: "No, and nobody honestly can. We never guarantee grading outcomes — we restore to the best of our ability and give your card its best shot.",
      },
      {
        q: "What if my card does come back altered?",
        a: "It's a risk every restoration customer accepts going in. Worst case, crack it and sell it raw — it's still in better condition than when you sent it.",
      },
    ],
  },
  {
    id: "shipping",
    title: "Shipping & Returns",
    items: [
      {
        q: "Do you accept orders from outside the US?",
        a: "No — we accept orders from within the US only. Puerto Rico is fine; it's treated as domestic US for shipping and ordering. We can't accept cards from other countries.",
      },
      {
        q: "How will my cards be shipped back?",
        a: "In a fresh penny sleeve and Card Saver, wrapped in a bubble mailer between two protective \"ding defender\" plates. Your return tracking number appears on your order when it ships.",
      },
      {
        q: "Are my cards insured while you have them?",
        a: "We do not currently insure customer cards while they are in our possession. Optional shipping insurance is available at checkout.",
      },
      {
        q: "What if you can't fix my card?",
        a: "Then we refund the service cost and send it back — you just cover shipping both ways. We inspect every card on arrival specifically to make that call before work begins.",
      },
      {
        q: "Can I cancel my order?",
        a: "Yes, before we start cleaning your card. Email thecarddoc1@gmail.com with your order number and we'll take care of you. Once cleaning has started, the service fee is generally non-refundable.",
      },
    ],
  },
  {
    id: "drop-off",
    title: "Drop-off & Local",
    items: [
      {
        q: "Do you take drop-offs?",
        a: "Yes. Book on the site, select \"I'll ship them myself\" at checkout, then message @the_card_doc on Instagram to schedule your drop-off. We're in Ridgewood, NJ.",
      },
    ],
  },
];
