// A free, instant stand-in for real generation — selected via the
// "TasteTest" model option (components/generate/generate-card.tsx) so the
// Generate flow's UI can be exercised repeatedly without spending real
// model calls against the free-tier quota. post-actions.ts calls
// pickTasteTestContent instead of lib/ai/generate.ts::generatePost when
// this model is selected; everything else (prompt building, topic
// assignment, persistence) runs unchanged.

const TASTE_TEST_CONTENTS = [
  "Waiting for permission to lead is the slowest way to grow your career. Pick a problem nobody owns, solve it well, and let the results speak.",
  "Company culture isn't the snacks in the kitchen — it's what happens the first time someone makes a mistake. Watch that moment, not the perks.",
  "Great leaders don't hoard control. They set clear direction, remove obstacles, and get out of the way. Everything else is micromanagement in disguise.",
  "Freelancing taught me more about business than any job did. When you're the whole company, you feel every decision immediately.",
  "Productivity isn't doing more things. It's doing fewer things that actually move the needle, and saying no to the rest without guilt.",
  "The best time to build the thing you're scared to build was a year ago. The second best time is after you finish reading this post.",
  "Nobody remembers the meeting that could have been an email. They remember the person who said so out loud and shortened it.",
  "Your network isn't the people you've met once at a conference. It's the five people who'd answer your call at 11pm without asking why.",
  "Most burnout isn't from working too hard. It's from working hard on things that don't matter to you, for reasons you stopped believing in.",
  "Ask better questions in your one-on-ones. \"How's it going\" gets a status update. \"What's the hardest part of your week\" gets the truth.",
]

export function pickTasteTestContent(index: number): string {
  return TASTE_TEST_CONTENTS[index % TASTE_TEST_CONTENTS.length]
}
