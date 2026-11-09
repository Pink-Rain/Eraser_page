/**
 * Les formes d'un bloc « Vue d'index », une seule rangée (le tableau, les cartes, chaque
 * présentation), et la forme que montre un bloc. Règles pures : l'atelier et ses tests s'en servent.
 */
import type { PageBlock, ViewBlockKind } from "@/lib/custom-pages"
import { foldName } from "@/lib/index-columns"
import { PRESENTATION_VARIANT_PREFIX, allPresentationKinds, builtinPresentationPresets, namedPresentationsOf, type Presentation, type PresentationPreset, type TabPresentations } from "@/lib/index-presentations"

type ViewBlock = Extract<PageBlock, { type: "view" }>

/** Les formes d'un bloc, une seule rangée : le tableau, les cartes, et chaque présentation. */
export const blockForms = allPresentationKinds.map((entry) => ({ ...entry, value: entry.value as ViewBlockKind, hint: entry.value === "cards" ? "Chaque ligne en carte, dessinée comme tu veux : image, couleurs, blocs, composition." : entry.hint }))

/** La forme d'une présentation que montre un bloc : la sienne, une version de l'onglet, un preset, sinon celle de l'onglet. */
export function blockForm(block: Pick<ViewBlock, "kind" | "layout" | "presetId" | "tab">, sources: { presentations: Record<string, TabPresentations>; viewPresets: PresentationPreset[]; tabForm?: Presentation }): Presentation {
  if (block.layout) return block.layout
  if (block.presetId?.startsWith(PRESENTATION_VARIANT_PREFIX)) {
    const tabViews = Object.entries(sources.presentations).find(([name]) => foldName(name) === foldName(block.tab))?.[1]
    const version = namedPresentationsOf(tabViews).find((item) => item.id === block.presetId!.slice(PRESENTATION_VARIANT_PREFIX.length))
    if (version) return { ...version.layout }
  } else if (block.presetId) {
    const preset = [...builtinPresentationPresets, ...sources.viewPresets].find((item) => item.id === block.presetId)
    if (preset) return { ...preset.layout, kind: block.kind as Presentation["kind"] }
  }
  return { ...(sources.tabForm ?? {}), kind: block.kind as Presentation["kind"] }
}

