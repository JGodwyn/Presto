// Placeholder shape pending Presto_PRD_v1_1.docx / Presto_UX_Reference_v1_0.docx.
// This is the single definition of what an instructions set looks like —
// every page reads and writes through this type. Refine once the real spec
// is available.

export interface InstructionsSet {
  id: string
  name: string
  content: string
  resourceUrls: string[]
  createdAt: string
  updatedAt: string
}
