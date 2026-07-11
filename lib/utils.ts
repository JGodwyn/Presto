import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// tailwind-merge ships its own hardcoded class-group rules and has no way to
// see this project's custom @theme tokens (app/globals.css). Left unconfigured,
// a custom font-size utility like `text-heading-lg` doesn't match any known
// font-size pattern, so it falls into tailwind-merge's default catch-all for
// unrecognized `text-*` classes — the same bucket as real text-color utilities
// like `text-text-bold` — and gets silently evicted whenever both appear in
// one cn() call (last one in the string wins). Registering these names under
// the 'font-size' group is the root-cause fix so no call site has to route
// around it with bracket syntax (see dialog.tsx history / pill-input.tsx).
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "display-lg",
            "display-md",
            "display-sm",
            "heading-lg",
            "heading-md",
            "heading-sm",
            "title-lg",
            "title-md",
            "title-sm",
            "body-lg",
            "body-lg-bold",
            "body-md",
            "body-md-bold",
            "body-sm",
            "body-sm-bold",
            "btn-lg",
            "btn-sm",
            "others-link",
            "code-body-lg",
            "code-body-lg-bold",
            "code-body-md",
            "code-body-md-bold",
            "code-body-sm",
            "code-body-sm-bold",
            "code-link",
          ],
        },
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
