// A free, instant stand-in for real generation — selected via the
// "TasteTest" model option (components/generate/generate-card.tsx) so the
// Generate flow's UI can be exercised repeatedly without spending real
// model calls against the free-tier quota. post-actions.ts calls
// pickTasteTestContent instead of lib/ai/generate.ts::generatePost when
// this model is selected; everything else (prompt building, topic
// assignment, persistence) runs unchanged.

// A mix of lengths on purpose — short ones for quick pacing checks, long
// multi-paragraph ones (with real \n\n breaks) for exercising the card's
// scroll+fade content area and the double-click quick-edit textarea against
// something more realistic than a single short line.
const TASTE_TEST_CONTENTS = [
  `Waiting for permission to lead is the slowest way to grow your career. Pick a problem nobody owns, solve it well, and let the results speak.

I spent my first three years doing exactly this wrong. I'd sit in meetings with a clear opinion on what we should build next, then say nothing because "that's not really my job." Meanwhile a coworker two desks over kept quietly fixing things nobody had asked her to fix — a broken onboarding flow here, a confusing error message there — and within a year she was running the team I was still waiting to be invited onto.

The permission you're waiting for usually doesn't exist as a formal thing. Nobody is going to tap you on the shoulder and declare you ready. What actually happens is smaller and less dramatic: you notice something broken, you fix it without being asked, and people quietly start routing harder problems to you because you've already shown you'll handle them.

Three things that actually moved the needle for me once I stopped waiting:
1. I started keeping a running list of "annoying but nobody owns it" problems and picked off one a month.
2. I wrote a short note after each fix explaining what I did and why — not to brag, just so the reasoning was visible.
3. I asked for feedback on the fix itself, not on "how am I doing," which got me specific, usable answers instead of vague reassurance.

None of this required a promotion, a new title, or anyone's blessing. It just required going first.`,
  "Company culture isn't the snacks in the kitchen — it's what happens the first time someone makes a mistake. Watch that moment, not the perks.",
  `Great leaders don't hoard control. They set clear direction, remove obstacles, and get out of the way. Everything else is micromanagement in disguise.

I used to think good management meant staying close to the details — reviewing every decision, sitting in on every call, having an opinion on every ticket. It felt responsible. It felt thorough. What it actually did was cap my team's output at whatever I personally had the bandwidth to review, which is a pretty small number once you're managing more than three or four people.

The shift that changed everything was embarrassingly simple: I stopped asking "what are you doing" and started asking "what's in your way." The first question makes people justify their time. The second one makes you useful. It also forced me to actually notice the obstacles I'd unintentionally built myself — approval chains that existed because I didn't trust people yet, meetings that existed because I wanted visibility rather than because anyone needed them.

Here's the part nobody tells you: removing yourself from the loop is scarier for the manager than for the team. Your team already knows how to do the work. You're the one who has to get comfortable not knowing everything in real time, and trusting that if something's actually on fire, someone will tell you.

Set the direction clearly. Make sure people have what they need. Then genuinely leave them alone. The results will tell you if it's working — you don't need to watch the process to know the outcome.`,
  "Freelancing taught me more about business than any job did. When you're the whole company, you feel every decision immediately.",
  `Productivity isn't doing more things. It's doing fewer things that actually move the needle, and saying no to the rest without guilt.

For years I measured a good day by how full my calendar was and how long my "done" list looked by 6pm. I was busy constantly and somehow never felt like I was making progress on the things that actually mattered — the project that would matter in a year, not the seventeen small fires that would be forgotten by Friday.

What changed my mind wasn't a productivity app or a new note-taking system. It was tracking, for two weeks, what I actually worked on versus what I *meant* to work on. The gap was brutal. Almost 70% of my time went to things that felt urgent but weren't actually important — replying fast to messages that could've waited a day, sitting in status meetings that existed out of habit, polishing slides nobody would remember by the following week.

The fix wasn't a new system. It was a standing question before saying yes to anything: "if I only get one thing done this week, is this it?" Most things, when held up against that question, obviously aren't. Saying no to them stopped feeling like slacking off and started feeling like the actual job.

A full calendar was never the goal. A shipped thing that mattered was.`,
  "The best time to build the thing you're scared to build was a year ago. The second best time is after you finish reading this post.",
  `Nobody remembers the meeting that could have been an email. They remember the person who said so out loud and shortened it.

I sat through a 45-minute status meeting last year where the actual content could've fit in four bullet points. Nobody said anything, because saying "do we need this whole meeting" out loud feels like a small act of rebellion — like you're implicitly criticizing whoever scheduled it, or worse, that you don't care about alignment.

But here's what I've noticed after being the person who finally says it a few times: nobody's actually offended. Most people in that room are relieved someone else said it first. Meetings accumulate because cancelling one feels riskier than it is, not because anyone's genuinely attached to the ritual.

A few things that made this easier to say out loud without sounding like I was picking a fight:
– I proposed a replacement, not just a cancellation — an async doc update instead of the meeting, with a 24-hour comment window.
– I framed it around time, not around the meeting being "useless": "can we get this same alignment in 10 minutes instead of 45?"
– I did it once, showed it worked, and let the result make the case instead of arguing for it in the abstract.

The meetings that survive that scrutiny are usually the ones that actually needed to be meetings — real-time discussion, disagreement that needs to be worked through, decisions that benefit from everyone's reaction in the room. Everything else was just habit wearing a calendar invite.`,
  "Your network isn't the people you've met once at a conference. It's the five people who'd answer your call at 11pm without asking why.",
  `Most burnout isn't from working too hard. It's from working hard on things that don't matter to you, for reasons you stopped believing in.

I burned out twice in my career, and the two times looked nothing alike from the outside. The first time, I was working 60-hour weeks on a product I genuinely loved, at a company where I trusted the mission. I was tired, but it was the good kind of tired — I'd come back from a week off ready to go again.

The second time, I was working 40-hour weeks, well within normal bounds, on a product I'd quietly stopped believing in. Every task felt like pushing a boulder slightly uphill even when the task itself was small. I didn't recognize it as burnout for months because I kept comparing my hours to the first time and thinking "this isn't that bad."

What I've learned since: hours are a terrible proxy for what's actually driving burnout. The real question is closer to "do I believe this work matters, and do I trust the people I'm doing it with." When the answer is yes, a hard week recharges you. When the answer is no, even a light week drains you, because you're spending energy on doubt that never shows up on a timesheet.

If you're tired and can't figure out why the tiredness feels different this time, that's usually the question worth sitting with. Not "am I working too much" — "do I still believe in what I'm working on."`,
  "Ask better questions in your one-on-ones. \"How's it going\" gets a status update. \"What's the hardest part of your week\" gets the truth.",
]

export function pickTasteTestContent(index: number): string {
  return TASTE_TEST_CONTENTS[index % TASTE_TEST_CONTENTS.length]
}

// Regenerating has no batch index to key off — and picking by index would
// hand back the same string the user just asked to replace. Random instead,
// stepped forward once if it landed on the content already on the card, so a
// regenerate visibly changes something every time (which is the whole point of
// exercising the flow on this model).
export function pickDifferentTasteTestContent(current: string): string {
  const start = Math.floor(Math.random() * TASTE_TEST_CONTENTS.length)
  const picked = TASTE_TEST_CONTENTS[start]
  if (picked !== current) return picked
  return TASTE_TEST_CONTENTS[(start + 1) % TASTE_TEST_CONTENTS.length]
}
