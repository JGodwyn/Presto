import * as React from "react"

import {
  definePixelGradient,
  PixelGradient,
} from "@/components/shared/pixel-gradient"

// The sidebar's pixel staircase (see pixel-gradient.tsx for how it's drawn),
// replacing the old 384×930 webp: pink→violet→blue rows, each fading to the
// right, every lower row reaching further. Colours are sampled from that
// image, 16 points across each row. Rows are in its 930px-tall pixel space;
// the first 150 were plain white and are dropped.
const ART_TOP = 150
const ART_BOTTOM = 930

const ART = definePixelGradient({
  orientation: "rows",
  extent: [ART_TOP, ART_BOTTOM],
  samples: 16,
  bands: [
    { start: 150, end: 232, colors: ["#fefcfd", "#ffffff", "#ffffff", "#ffffff", "#ffffff", "#ffffff", "#ffffff", "#ffffff", "#ffffff", "#ffffff", "#ffffff", "#ffffff", "#ffffff", "#ffffff", "#ffffff", "#ffffff"] },
    { start: 232, end: 297, colors: ["#fad9f2", "#fbeaf7", "#fcf7fb", "#fefcfd", "#fffefe", "#ffffff", "#ffffff", "#ffffff", "#ffffff", "#ffffff", "#ffffff", "#ffffff", "#ffffff", "#ffffff", "#ffffff", "#ffffff"] },
    { start: 297, end: 358, colors: ["#f5b9ed", "#f7c6f0", "#f8d3f3", "#f9e0f6", "#faedf8", "#fbf6fb", "#fdfcfd", "#fefefe", "#ffffff", "#ffffff", "#ffffff", "#ffffff", "#ffffff", "#ffffff", "#ffffff", "#ffffff"] },
    { start: 358, end: 414, colors: ["#e890eb", "#eda7ee", "#f3bbf3", "#f4c5f3", "#f6cff5", "#f7daf6", "#f9e5f8", "#faeefa", "#fbf5fb", "#fdfbfd", "#fefefe", "#ffffff", "#ffffff", "#ffffff", "#ffffff", "#ffffff"] },
    { start: 414, end: 470, colors: ["#da70ee", "#e085ef", "#e69bf3", "#eaadf4", "#eebbf5", "#f1c5f6", "#f3cef8", "#f4d6f7", "#f6e0f8", "#f8e9f9", "#faeffa", "#fbf6fb", "#fcf9fc", "#fdfdfd", "#fefefe", "#ffffff"] },
    { start: 470, end: 523, colors: ["#ca55f5", "#d06af6", "#d87ef7", "#db8ff7", "#e1a0f8", "#e6b0f8", "#eabef9", "#ecc4f9", "#efccfa", "#f1d4fa", "#f3dbfa", "#f6e3fa", "#f6eafa", "#f9f0fb", "#faf5fb", "#fcf9fc"] },
    { start: 523, end: 574, colors: ["#c54bfb", "#c155fb", "#c768fd", "#cc77fc", "#d287fc", "#d797fc", "#dca5fb", "#e2b3fb", "#e6befc", "#e9c4fc", "#ebcbfd", "#edd2fc", "#efd8fc", "#f2dffb", "#f4e6fc", "#f6ebfb"] },
    { start: 574, end: 622, colors: ["#c349fb", "#bc4efb", "#b856fb", "#ba65fc", "#c174fc", "#c782fb", "#cd91fc", "#d29dfc", "#d6a8fb", "#deb6fb", "#e1befb", "#e4c4fc", "#e6cafd", "#e9d1fd", "#ebd6fc", "#eedcfb"] },
    { start: 622, end: 669, colors: ["#bf49fb", "#ba4ffb", "#b454fb", "#af57fb", "#b063fc", "#b671fc", "#bc7efb", "#c18bfc", "#c696fc", "#cda3fd", "#d1acfc", "#d8b7fb", "#dbbffc", "#dfc5fc", "#e2cbfd", "#e4d0fd"] },
    { start: 669, end: 714, colors: ["#b94afb", "#b44efb", "#b054fb", "#ab56fb", "#a75bfc", "#a764fc", "#ac71fb", "#b07cfb", "#b587fb", "#bc92fc", "#c09cfd", "#c6a6fc", "#cbaefc", "#d3b9fc", "#d7c1fc", "#d9c5fc"] },
    { start: 714, end: 760, colors: ["#b34bfb", "#af50fb", "#ab55fb", "#a658fb", "#a25bfc", "#9d60fc", "#9b66fc", "#9f70fc", "#a47bfc", "#a985fb", "#ae8efb", "#b598fd", "#b9a1fc", "#c0abfc", "#c5b3fc", "#ccb9fc"] },
    { start: 760, end: 803, colors: ["#ab4efb", "#a752fc", "#a557fb", "#9f59fc", "#9c5dfc", "#9860fc", "#9363fd", "#8f66fd", "#9170fc", "#987bfc", "#9d83fc", "#a28cfc", "#a893fd", "#ad9efc", "#b3a5fc", "#b8adfb"] },
    { start: 803, end: 846, colors: ["#a352fb", "#9f55fc", "#9c59fc", "#985bfc", "#945ffc", "#8f62fc", "#8c66fd", "#8767fc", "#836afc", "#8473fc", "#887afc", "#8f83fc", "#938afb", "#9a93fd", "#a09bfc", "#a6a2fb"] },
    { start: 846, end: 881, colors: ["#9755fc", "#9359fc", "#915dfc", "#8c5ffb", "#8962fc", "#8764fc", "#8268fc", "#7e6afc", "#796dfc", "#7670fc", "#7776fb", "#7c7efb", "#8085fb", "#878dfb", "#8c93fc", "#939afd"] },
    { start: 881, end: 930, colors: ["#8b5dfc", "#885ffc", "#8563fd", "#8165fd", "#7d68fd", "#7a6bfc", "#766efc", "#7170fc", "#6c72fc", "#6975fc", "#697afc", "#6f82fc", "#7589fb", "#7d91fc", "#8398fd", "#899dfc"] },
  ],
})

// Natural proportions of the drawn region (384px wide source). The sidebar
// holds this aspect until it's too short for it, then compresses the rows.
export const SIDEBAR_GRADIENT_ASPECT = `384 / ${ART_BOTTOM - ART_TOP}`

export function SidebarGradient({
  className,
  style,
}: {
  className?: string
  style?: React.CSSProperties
}) {
  return <PixelGradient art={ART} className={className} style={style} />
}
