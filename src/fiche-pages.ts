/**
 * Les fiches-pages : une page de l'atelier qui sert de page à chaque ligne d'un index (chaque
 * peuple, chaque lieu, chaque classe), à l'adresse /fiche/<index>/<ID>. Eraser l'appelle « page de
 * ligne » (`rowOf` d'une page, lib/custom-pages-rows.ts) et l'affiche ; l'atelier la crée, la
 * dessine sur une ligne d'exemple, et les cartes et les vues s'y relient (« Ouvrir sa fiche-page »).
 *
 * Règles pures : l'Index des pages, l'atelier et les tests s'en servent.
 */
import { newBlock, newId, type PageBlock, type PageContent, type PageSectionBlock } from "@/lib/custom-pages"
import type { RowContext } from "@/lib/custom-pages-rows"
import { foldName, isIdHeader } from "@/lib/index-columns"
import type { IndexColumnSpec } from "@/lib/index-columns"

/** Une colonne d'un onglet, avec son type (celui que l'index lui donne). */
export type FicheColumn = { header: string; spec?: Pick<IndexColumnSpec, "kind" | "rowLabel" | "file"> }

const nameHeaders = ["nom", "nom du pnj", "nom personnage", "nom de la campagne", "nom de la classe"]

/** La colonne du nom d'une ligne, comme Eraser la trouve pour la page de ligne (rowContextOf). */
export function ficheNameHeader(columns: FicheColumn[], entityName?: string): string {
  const headers = columns.map((column) => column.header).filter((header) => header.trim() && !isIdHeader(header))
  if (entityName && headers.some((header) => foldName(header) === foldName(entityName))) return headers.find((header) => foldName(header) === foldName(entityName))!
  return headers.find((header) => nameHeaders.includes(foldName(header)))
    ?? columns.find((column) => column.spec?.rowLabel && !isIdHeader(column.header))?.header
    ?? headers[0]
    ?? ""
}

/** La colonne d'image de l'onglet : une colonne fichier image, sinon une colonne au nom d'image. */
export function ficheImageHeader(columns: FicheColumn[]): string {
  const byType = columns.find((column) => column.spec?.kind === "file" && (column.spec.file?.accept === "image" || !column.spec.file?.accept))
  if (byType) return byType.header
  return columns.find((column) => /^(image|portrait|illustration|blason|embl[eè]me|banni[eè]re)$/i.test(foldName(column.header)))?.header ?? ""
}

/**
 * La fiche-page de départ d'un index : le nom de la ligne en titre (au-dessus, l'index), son
 * image s'il y en a une, ses valeurs disposées comme sa fiche (le formulaire à l'étoile), puis
 * « Cité dans ». Tout se modifie ensuite dans l'atelier.
 */
export function ficheStarter({ title, indexTitle, nameHeader, imageHeader }: { title: string; indexTitle: string; nameHeader: string; imageHeader: string }): PageContent {
  const block = <T extends PageBlock["type"]>(type: T, patch: Partial<Extract<PageBlock, { type: T }>>) => ({ ...newBlock(type), ...patch }) as PageBlock
  const heading = block("title", { eyebrow: indexTitle, text: nameHeader ? `{${nameHeader}}` : "{ID}", level: "h2", align: "left" })
  const values = block("rowfields", { columns: [], heading: "", style: "form" })
  const section = (layout: PageSectionBlock["layout"], ...cols: PageBlock[][]): PageSectionBlock => ({ id: newId("s"), layout, framed: false, cols })
  const top = imageHeader
    ? section("side-l", [block("image", { src: `{${imageHeader}}`, caption: "", ratio: "1/1", fit: "cover" })], [heading, values])
    : section("1", [heading, values])
  return {
    title,
    icon: "file-text",
    emoji: "",
    description: "",
    hideHeader: true,
    sections: [top, section("1", [block("backlinks", { heading: "Cité dans" })])],
  }
}

/** Une ligne lue dans l'index (comme l'API des index la rend). */
export type FicheRow = { values: string[]; html: string[] }

const plain = (value: string) => value.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim()
const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

/** L'identifiant de chaque ligne d'un onglet (colonne ID) et son nom : les lignes d'exemple proposées. */
export function ficheExamples(headers: string[], rows: FicheRow[], nameHeader: string): Array<{ id: string; name: string }> {
  const id = headers.findIndex(isIdHeader)
  if (id < 0) return []
  const name = headers.findIndex((header) => foldName(header) === foldName(nameHeader))
  return rows.flatMap((row) => {
    const rowId = plain(row.values[id] ?? "")
    return rowId ? [{ id: rowId, name: (name >= 0 ? plain(row.values[name] ?? "") : "") || rowId }] : []
  })
}

/**
 * La ligne d'exemple telle que la fiche-page la reçoit (comme `rowContextOf` d'Eraser pour un
 * administrateur : toutes les colonnes) ; `sanitize` nettoie le texte riche avant l'affichage.
 * `null` si la ligne n'existe pas.
 */
export function ficheRowContext(input: { index: string; indexTitle: string; tab: string; headers: string[]; rows: FicheRow[]; id: string; nameHeader: string }, sanitize: (html: string) => string): RowContext | null {
  const idAt = input.headers.findIndex(isIdHeader)
  if (idAt < 0) return null
  const row = input.rows.find((candidate) => plain(candidate.values[idAt] ?? "") === input.id)
  if (!row) return null
  const columns = input.headers.flatMap((header, at) => {
    if (!header.trim()) return []
    const html = row.html[at] ?? ""
    const value = row.values[at] ?? ""
    return [{ header, text: plain(value || html), html: sanitize(html || escapeHtml(value)) }]
  })
  const name = columns.find((column) => foldName(column.header) === foldName(input.nameHeader))?.text ?? ""
  return { index: input.index, indexTitle: input.indexTitle, tab: input.tab, id: input.id, name: name || input.id, columns, hidden: [] }
}

/** La ligne d'exemple choisie pour une fiche-page, gardée sur cet ordinateur. */
export const ficheExampleKey = (pageId: string) => `eraser-page:fiche-exemple:${pageId}`
