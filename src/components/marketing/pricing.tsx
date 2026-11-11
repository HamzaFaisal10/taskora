export { PricingPlans } from "./pricing-plans";

const FAQ = [
  {
    q: "Is the demo a recording?",
    a: "No. It's the real app signed in to a shared demo workspace. Everything you do is saved, other visitors can see it, and the workspace is rebuilt every night.",
  },
  {
    q: "Do I need a card to start?",
    a: "No. The Free plan has no time limit and needs no card. You can upgrade from Settings when the team grows past five people or three projects.",
  },
  {
    q: "How does the AI work?",
    a: "The assistant can break a task into subtasks, summarize where it stands, or draft a description. In this build it runs on pre-written demo answers built from the task itself, and every answer is labelled Demo AI. With an OpenAI key it uses a live model.",
  },
  {
    q: "Are payments real?",
    a: "Not in this build. Upgrades go through a demo checkout that charges nothing and never asks for a card. With Stripe keys added, the same button opens Stripe Checkout.",
  },
  {
    q: "Who can see my data?",
    a: "Only members of your workspace. Access is checked inside the database on every row, so guests only see the projects you share with them and nobody outside your workspace sees anything.",
  },
  {
    q: "Does it work on my phone?",
    a: "Yes. Every screen works in a phone browser: press and hold a card to drag it, and the calendar turns into a day-by-day agenda.",
  },
];

export function Faq() {
  return (
    <div className="divide-border border-border divide-y border-y">
      {FAQ.map((f) => (
        <details key={f.q} className="group py-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-medium [&::-webkit-details-marker]:hidden">
            {f.q}
            <span
              className="text-subtle text-xl leading-none transition-transform group-open:rotate-45"
              aria-hidden
            >
              +
            </span>
          </summary>
          <p className="text-muted mt-3 max-w-2xl leading-relaxed">{f.a}</p>
        </details>
      ))}
    </div>
  );
}
