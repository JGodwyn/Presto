import {
  CalendarDots,
  ChalkboardTeacher,
  HouseSimple,
  MagicWand,
  PlugsConnected,
  type Icon,
} from "@phosphor-icons/react"

export interface OnboardingStepContent {
  path: string
  icon: Icon
  heading: string
  description: string
}

// One entry per tour step, in step order — index 0 is step 1. `path` must
// match a path in ProjectSidebar's NAV_ITEMS (same order): the callout
// targets whichever nav item that segment belongs to.
export const ONBOARDING_STEPS: OnboardingStepContent[] = [
  {
    path: "dashboard",
    icon: HouseSimple,
    heading: "Dashboard",
    description:
      "See everything at a glance here. Your dashboard lets you know how you're doing.",
  },
  {
    path: "instructions",
    icon: ChalkboardTeacher,
    heading: "Start here.\nYour voice and references",
    description:
      "This is where you teach Presto how you write. Set your tone and rules, add articles or documents you reference, and paste in example posts. The AI reads all of this every time it writes for you.",
  },
  {
    path: "generate",
    icon: MagicWand,
    heading: "Create a full batch of posts in one go",
    description:
      "Pick your topic, tone, and how many posts you want. Hit Generate and Presto writes them all for you, ready to review and drop into your calendar.",
  },
  {
    path: "calendar",
    icon: CalendarDots,
    heading: "Your content,\nall in one place",
    description:
      "Every post lives here once it's generated or added manually. Review, edit, mark posts as ready, and keep track of what's been posted.",
  },
  {
    path: "connections",
    icon: PlugsConnected,
    heading: "Connect your platforms",
    description:
      "Link your LinkedIn or X account here. This is also where you set your primary platform — the one Presto defaults to when generating posts.",
  },
]
