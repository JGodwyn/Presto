// Folder-shaped project card from the Figma "Your projects" frame. The
// silhouette (tab + rounded body) is the exported vector path, so it stays an
// inline SVG behind the content — Purple400 fill, Purple700 inside stroke.
// Height stays the Figma-fixed 168 (h-42); width fills the grid track (the
// /projects grid uses fluid minmax(16rem,1fr) columns so rows span the full
// content width), with preserveAspectRatio="none" letting the silhouette
// stretch and vector-effect keeping the 2px stroke true while it does.
// The grow-in entrance plays when a folder node is inserted (project just
// created) via @starting-style, so it needs no client JS. Values per
// .agents/skills/review-animations/STANDARDS.md: never scale(0) — it starts
// at 75% + opacity 0 (a rare creation event, so more travel than the usual
// 0.9 floor for delight), strong ease-out curve, at the 300ms UI ceiling.
// Tailwind v4's scale-* animates the standalone `scale` property, so that's
// what the transition lists — `transform` would silently not animate.
export function ProjectFolder({ name }: { name: string }) {
  return (
    <div className="relative flex h-42 w-full min-w-64 flex-col justify-end p-pad-xl transition-[scale,opacity] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] starting:scale-75 starting:opacity-0">
      <svg
        viewBox="0 0 256 168"
        preserveAspectRatio="none"
        aria-hidden
        className="absolute inset-0 size-full"
      >
        <path
          vectorEffect="non-scaling-stroke"
          d="M26.9443 1H60.5791C63.44 1.00003 65.629 1.23476 67.8984 2.00977C70.1818 2.78961 72.6089 4.13793 75.9092 6.4541C78.8798 8.53944 79.4534 8.95307 79.7354 9.15625H79.7363L79.8457 9.23535L81.9629 10.7021L83.5166 11.7744C83.9245 12.0561 84.3337 12.3225 84.7422 12.5732C90.9133 16.3625 97.0924 16.7363 101.861 16.7363H229.056C233.786 16.7363 237.28 16.7372 240.042 16.9424C242.623 17.1341 244.493 17.5008 246.072 18.1738L246.385 18.3125C249.374 19.6975 251.787 21.8994 253.292 24.5859C254.113 26.051 254.551 27.7846 254.774 30.2676C254.999 32.7657 255 35.9296 255 40.2354V143.502C255 147.808 254.999 150.971 254.774 153.469C254.551 155.952 254.113 157.685 253.292 159.15V159.151C251.881 161.67 249.672 163.761 246.938 165.154L246.385 165.424C244.739 166.186 242.795 166.589 240.042 166.794C237.28 166.999 233.786 167 229.056 167H26.9443C22.2138 167 18.7205 166.999 15.958 166.794C13.2046 166.589 11.2606 166.186 9.61523 165.424C6.626 164.039 4.21305 161.838 2.70801 159.151V159.15C1.88693 157.685 1.44875 155.952 1.22559 153.469C1.00108 150.971 1 147.808 1 143.502V24.498C1 20.1924 1.00108 17.0293 1.22559 14.5312C1.44875 12.0482 1.88693 10.3147 2.70801 8.84961V8.84863C4.21306 6.16223 6.626 3.9611 9.61523 2.57617C11.2606 1.81392 13.2046 1.41059 15.958 1.20605C18.7205 1.00086 22.2138 1 26.9443 1Z"
          strokeWidth={2}
          className="fill-purple-400 stroke-purple-700"
        />
      </svg>

      <p className="relative line-clamp-2 text-heading-sm font-display break-words text-text-inverse">
        {name}
      </p>
    </div>
  )
}
