/**
 * Turns a written brief into a list of tasks. This is the demo-mode planner: plain rules, no model.
 * It keeps requirements ("we need…", "users should be able to…", bullet points), turns them into short
 * imperative titles, guesses priority and size from the wording, and tags labels the project already has.
 */

export type PlanPriority = "low" | "medium" | "high" | "urgent";
export type PlanIdea = {
  title: string;
  priority: PlanPriority;
  estimate: number;
  labels: string[];
};

const VERBS = new Set(
  (
    "add build create design write set fix update launch ship test review migrate integrate implement " +
    "research plan draft prepare publish send move remove improve support allow let show track run " +
    "collect measure refactor document invite configure connect enable redesign rewrite translate " +
    "optimize audit interview schedule record hire define choose agree make get find keep replace " +
    "upgrade clean speed reduce export import sync rename localize price announce brief onboard " +
    "survey analyse analyze compare estimate check verify deploy monitor automate archive merge"
  ).split(" "),
);

const SUBJECT_CAN =
  /^(?:the\s+)?(users?|customers?|clients?|visitors?|admins?|people|members?|teams?|guests?|buyers?|sellers?)\s+(?:should\s+be\s+able\s+to|will\s+be\s+able\s+to|need\s+to\s+be\s+able\s+to|can|could|should|must|need\s+to)\s+(.+)$/i;

const LEAD =
  /^(?:(?:and|also|then|plus|finally|next|first|second|third|lastly)[,:]?\s+)*(?:(?:we|you|they|i|someone|(?:the|our|a)\s+[a-z]+)\s+)?(?:(?:will|would|should|must|need(?:s)?(?:\s+to)?|require(?:s)?|have\s+to|has\s+to|want(?:s)?(?:\s+to)?|'d\s+like(?:\s+to)?|would\s+like(?:\s+to)?|can|could|plan\s+to|are\s+going\s+to|is\s+going\s+to)\s+)+(?:also\s+)?/i;

const REQUIREMENT =
  /\b(need|needs|should|must|want|wants|has to|have to|would like|'d like|be able to|required|plan to|going to|asap|todo|to-do)\b/i;

const CONTEXT_START =
  /^(?:hi|hello|hey|thanks|thank you|cheers|fyi|note|background|context|the goal|our goal|goal|this|it|we are|we're|i am|i'm|our|right now|currently|today)\b/i;

const URGENT = /\b(asap|urgent|urgently|immediately|right away|blocker|blocking|today)\b/i;
const HIGH =
  /\b(must|critical|important|top priority|first|before launch|required|essential|key)\b/i;
const LOW =
  /\b(nice to have|nice-to-have|later|maybe|optional|if time allows|if there's time|eventually|stretch|someday|bonus)\b/i;
const HINTS =
  /\s*[([]?\b(?:nice to have|nice-to-have|optional|if time allows|if there's time|asap|urgent|stretch goal|bonus)\b[)\]]?\s*/gi;

const BIG =
  /\b(webhooks?|stripe|leaderboard|integrat\w*|migrat\w*|redesign\w*|system|engine|dashboard|sync\w*|payments?|billing|checkout|auth\w*|sign[- ]?in|login|search|import\w*|offline|permissions?|notifications?|analytics|onboarding|api)\b/i;
const SMALL =
  /\b(copy|text|wording|rename|link|button|typo|icon|colou?r|logo|favicon|meta|title|label|tweet|post)\b/i;

/** Hints for matching an item to a label the project already has, by label name. */
const LABEL_HINTS: Record<string, RegExp> = {
  backend: /\b(api|endpoints?|database|server|backend|webhooks?|sync|auth\w*|migrations?|queue)\b/i,
  frontend: /\b(ui|page|screens?|frontend|components?|layout|css|responsive)\b/i,
  design: /\b(design\w*|mockups?|wireframes?|screens?|figma|ux|visual|icons?|illustrations?)\b/i,
  mobile: /\b(ios|android|mobile|app store|play store|push notifications?|phone)\b/i,
  bug: /\b(bugs?|fix\w*|crash\w*|broken|errors?|regressions?)\b/i,
  marketing:
    /\b(email|campaign|blog|launch|announce\w*|social|newsletter|landing page|seo|ads?)\b/i,
  content: /\b(copy|blog|articles?|docs?|documentation|content|write|wording)\b/i,
  research: /\b(research|interviews?|survey|user testing|discovery|compare|competitors?)\b/i,
  infra: /\b(deploy\w*|ci|hosting|infrastructure|monitoring|logging|backups?|servers?)\b/i,
  qa: /\b(test\w*|qa|quality)\b/i,
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function firstWord(s: string) {
  return (s.match(/^[a-z']+/i)?.[0] ?? "").toLowerCase();
}

/** "users should be able to reset passwords" → "Let users reset passwords" */
function toTitle(raw: string): string | null {
  let s = raw
    .replace(HINTS, " ")
    .replace(/^\s*(?:[-*•]|\d+[.)]|\[[ xX]\])\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!;:,]+$/, "");
  if (!s) return null;
  const subject = s.match(SUBJECT_CAN);
  if (subject) s = `Let ${subject[1].toLowerCase()} ${subject[2]}`;
  else s = s.replace(LEAD, "");
  s = s.replace(/^to\s+/i, "").replace(/^be able to\s+/i, "Allow people to ");
  if (!s || s.split(" ").length < 2) return null;

  const verb = firstWord(s);
  if (!VERBS.has(verb) && !VERBS.has(verb.replace(/s$/, ""))) {
    // A noun phrase ("a pricing page", "Stripe integration"): pick a sensible verb from its head.
    const noun = s.replace(/^(?:a|an|the|some|new)\s+/i, "");
    const head = s.split(/\b(?:where|that|which|with|so|for|to|when|from)\b/i)[0];
    const article = /^(a|an|the|some)\s/i.test(s);
    if (
      /\b(copy|blog|post|article|docs?|documentation|email|newsletter|announcement)\b/i.test(head)
    )
      s = `Write ${article ? s : `the ${noun}`}`;
    else if (/\b(analytics|tracking|monitoring|integration|webhooks?|sso|ci)\b/i.test(head))
      s = `Set up ${article ? s : noun}`;
    else s = `Build ${article ? s : `the ${noun}`}`;
  } else if (VERBS.has(verb.replace(/s$/, "")) && !VERBS.has(verb)) {
    // "adds dark mode" → "Add dark mode"
    s = s.replace(/^[a-z']+/i, verb.replace(/s$/, ""));
  }
  s = cap(s.trim());
  return s.length > 120 ? `${s.slice(0, 117).trimEnd()}…` : s;
}

function priorityOf(text: string): PlanPriority {
  if (URGENT.test(text)) return "urgent";
  if (LOW.test(text)) return "low";
  if (HIGH.test(text)) return "high";
  return "medium";
}

function estimateOf(title: string): number {
  if (BIG.test(title)) return title.split(" ").length > 6 ? 8 : 5;
  if (SMALL.test(title) && title.split(" ").length <= 5) return 1;
  return title.split(" ").length > 7 ? 3 : 2;
}

function labelsFor(text: string, labelNames: string[]): string[] {
  return labelNames.filter((name) => {
    const hint = LABEL_HINTS[name.toLowerCase()];
    const own = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    return own.test(text) || (hint?.test(text) ?? false);
  });
}

/**
 * Splits "add X, build Y and we must write Z" into separate items. A part becomes its own item when it
 * starts with a verb and is its own clause (has its own "we need to…"), or when the sentence is a plain
 * list of actions. Anything else stays attached to the part before it.
 */
function splitCompound(sentence: string): string[] {
  const tokens = sentence.split(/(\s*(?:,\s*and\b|,|;|\band then\b|\band also\b|\band\b)\s*)/i);
  if (tokens.length < 3) return [sentence];
  const lead = sentence.match(LEAD)?.[0] ?? "";
  const firstIsVerb = VERBS.has(firstWord(tokens[0].replace(LEAD, "")));
  const out = [tokens[0]];
  for (let i = 1; i < tokens.length; i += 2) {
    const sep = tokens[i];
    const part = tokens[i + 1] ?? "";
    const ownLead = LEAD.test(part);
    const verb = VERBS.has(firstWord(part.replace(LEAD, "")));
    if (verb && (ownLead || firstIsVerb)) out.push(ownLead ? part : `${lead}${part}`);
    else out[out.length - 1] += sep + part;
  }
  return out;
}

const WRAP_UPS: { match: RegExp; title: string; estimate: number }[] = [
  {
    match: /\b(launch|release|ship|go live|announce)\b/i,
    title: "Plan the release and announce it",
    estimate: 2,
  },
  {
    match: /\b(build|implement|develop|app|feature|page|api)\b/i,
    title: "Test the flow end to end before release",
    estimate: 3,
  },
];

const FALLBACK: [string, number][] = [
  ["Agree on the goal and what done looks like", 1],
  ["List the requirements and open questions", 1],
  ["Build a first small version", 3],
  ["Review it with the team and stakeholders", 1],
  ["Polish, test and ship", 2],
];

export function demoPlan(brief: string, labelNames: string[] = []): PlanIdea[] {
  const text = brief.replace(/\r\n?/g, "\n").trim();
  const items: { raw: string; context: string; section: PlanPriority | null }[] = [];
  // A heading such as "Nice to have:" or "Must haves:" sets the priority of the list under it.
  let section: PlanPriority | null = null;

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      section = null;
      continue;
    }
    const bullet = /^(?:[-*•]|\d+[.)]|\[[ xX]\])\s+/.test(trimmed);
    if (bullet) {
      items.push({ raw: trimmed, context: trimmed, section });
      continue;
    }
    // A heading line ending in ":" introduces a list; it is context, not a task.
    if (/:\s*$/.test(trimmed)) {
      const p = priorityOf(trimmed);
      section = p === "medium" ? null : p;
      continue;
    }
    section = null;
    for (const sentence of trimmed.split(/(?<=[.!?])\s+|;\s+/)) {
      const s = sentence.trim();
      if (s.split(/\s+/).length < 3) continue;
      const stripped = s.replace(LEAD, "");
      const startsWithVerb = VERBS.has(firstWord(stripped));
      const requirement = REQUIREMENT.test(s) || SUBJECT_CAN.test(s);
      if (CONTEXT_START.test(s) && !requirement) continue;
      if (!startsWithVerb && !requirement) continue;
      for (const part of splitCompound(s)) items.push({ raw: part, context: s, section: null });
    }
  }

  const seen = new Set<string>();
  const ideas: PlanIdea[] = [];
  for (const { raw, context, section: fromSection } of items) {
    const title = toTitle(raw);
    if (!title) continue;
    const key = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    if (seen.has(key)) continue;
    seen.add(key);
    ideas.push({
      title,
      // Priority words apply to their own item; urgency ("ASAP") applies to the whole sentence.
      priority: URGENT.test(context)
        ? "urgent"
        : priorityOf(raw) !== "medium"
          ? priorityOf(raw)
          : (fromSection ?? "medium"),
      estimate: estimateOf(title),
      labels: labelsFor(raw, labelNames),
    });
  }

  if (ideas.length >= 3) {
    for (const w of WRAP_UPS) {
      if (ideas.length >= 12) break;
      if (w.match.test(text) && !seen.has(w.title.toLowerCase())) {
        seen.add(w.title.toLowerCase());
        ideas.push({
          title: w.title,
          priority: "medium",
          estimate: w.estimate,
          labels: labelsFor(w.title, labelNames),
        });
      }
    }
  } else {
    for (const [title, estimate] of FALLBACK) {
      if (ideas.length >= 5) break;
      if (!seen.has(title.toLowerCase()))
        ideas.push({ title, priority: "medium", estimate, labels: [] });
    }
  }
  return ideas.slice(0, 12);
}
