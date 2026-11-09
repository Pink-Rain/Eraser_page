/**
 * Les fiches-pages dans l'atelier : « Nouvelle fiche-page » (l'Index des pages) et la ligne
 * d'exemple sur laquelle on la dessine (l'atelier d'une fiche-page). Une fiche-page est une page de
 * l'atelier réglée sur un index (`rowOf`) : Eraser en fait la page de chacune de ses lignes, à
 * /fiche/<index>/<ID>, et les cartes et les vues qui « ouvrent sa fiche-page » y mènent.
 *
 * Les données viennent d'Eraser : l'index (`/api/resources/world-indexes`), ses formulaires
 * (`useIndexSettings`), et l'enregistrement des pages (`/api/pages`), qui vérifie les droits et
 * refuse une seconde fiche-page pour le même index (ou le même onglet).
 */
import { useEffect, useMemo, useState } from "react"
import { Eye, FileText, LoaderCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useIndexSettings } from "@/components/eraser/index-windows"
import { sanitizeRichText } from "@/components/eraser/rich-text"
import type { PageDraft, PageSummary, StudioPage } from "@/lib/custom-pages"
import type { RowContext } from "@/lib/custom-pages-rows"
import { foldName } from "@/lib/index-columns"
import { tabFormOrBuiltin, tabLayoutOrBuiltin } from "@/lib/index-layout-defaults"
import type { IndexLayout } from "@/lib/index-layouts"
import type { WorldIndexData } from "@/lib/world-indexes"

import { ficheExampleKey, ficheExamples, ficheImageHeader, ficheNameHeader, ficheRowContext, ficheStarter } from "./fiche-pages"
import { Field, Hint, IndexPicker, fieldClass, useIndexCatalog } from "./page-studio-settings"

/* ---------- L'index d'une fiche-page ---------- */

const indexCache = new Map<string, Promise<WorldIndexData>>()

function loadIndex(key: string) {
  let promise = indexCache.get(key)
  if (!promise) {
    promise = fetch(`/api/resources/world-indexes?key=${encodeURIComponent(key)}`).then(async (response) => {
      const body = (await response.json().catch(() => ({}))) as { data?: WorldIndexData; error?: string }
      if (!response.ok || !body.data) throw new Error(body.error || "Cet index n’a pas pu être lu.")
      return body.data
    })
    promise.catch(() => indexCache.delete(key))
    indexCache.set(key, promise)
  }
  return promise
}

/** L'index (ses onglets, leurs colonnes et leurs lignes) d'une fiche-page. */
function useIndexData(key: string) {
  const [state, setState] = useState<{ key: string; data: WorldIndexData | null; error: string }>({ key, data: null, error: "" })
  useEffect(() => {
    if (!key) return
    let alive = true
    loadIndex(key).then((data) => { if (alive) setState({ key, data, error: "" }) }, (reason: unknown) => { if (alive) setState({ key, data: null, error: reason instanceof Error ? reason.message : "Cet index n’a pas pu être lu." }) })
    return () => { alive = false }
  }, [key])
  return state.key === key ? state : { key, data: null, error: "" }
}

/** Les onglets que couvre une fiche-page : le sien, ou tous ceux de l'index. */
function tablesOf(data: WorldIndexData | null, tab?: string) {
  return (data?.tables ?? []).filter((table) => !tab || foldName(table.tabName) === foldName(tab))
}

function nameHeaderOf(data: WorldIndexData, tabName: string) {
  return ficheNameHeader((data.columns[tabName] ?? []).map((column) => ({ header: column.header, spec: column.spec })), data.definition.entity?.nameHeader)
}

/* ---------- Nouvelle fiche-page ---------- */

const draftKeys = ["title", "icon", "emoji", "description", "hideHeader", "sections", "slug", "place", "campaignId", "vis", "replaces", "replaceMode", "rowOf"] as const

function draftOf(page: StudioPage): PageDraft {
  const out: Record<string, unknown> = {}
  for (const key of draftKeys) if (page[key] !== undefined) out[key] = page[key]
  return out as PageDraft
}

async function postPage(body: Record<string, unknown>) {
  const response = await fetch("/api/pages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null)
  const payload = (await response?.json().catch(() => ({})) ?? {}) as { page?: StudioPage; error?: string }
  return { ok: Boolean(response?.ok), page: payload.page, error: payload.error || (response ? "La fiche-page n’a pas pu être créée." : "Eraser ne répond pas : réessaie dans un instant.") }
}

/** La fiche-page déjà réglée sur cet index (et cet onglet), s'il y en a une. */
export function fichePageOf(pages: PageSummary[], index: string, tab = "") {
  return pages.find((page) => !page.trashedAt && page.rowOf?.index === index && foldName(page.rowOf.tab ?? "") === foldName(tab)) ?? null
}

/**
 * « Nouvelle fiche-page » : on choisit l'index (et, s'il en a plusieurs, l'onglet) ; la page naît
 * en brouillon, hors menu, ouverte à tous une fois publiée, avec une page de départ (le nom, l'image,
 * les valeurs comme la fiche, « Cité dans ») qu'on dessine ensuite dans l'atelier sur une ligne
 * d'exemple.
 */
export function NewFichePageDialog({ open, pages, onClose, onCreated, onOpenExisting }: {
  open: boolean
  /** Les pages de l'atelier : une fiche-page déjà faite pour cet index s'ouvre au lieu d'en créer une seconde. */
  pages: PageSummary[]
  onClose: () => void
  /** La fiche-page est créée (son identifiant) : l'Index des pages la range et ouvre l'atelier. */
  onCreated: (id: string) => Promise<void> | void
  onOpenExisting: (id: string) => void
}) {
  const [index, setIndex] = useState("")
  const [tab, setTab] = useState("")
  const [title, setTitle] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const catalog = useIndexCatalog()
  const { data, error: readError } = useIndexData(index)
  const indexTitle = catalog?.find((entry) => entry.key === index)?.title ?? data?.definition.title ?? index
  const tabs = (data?.tables ?? []).map((table) => table.tabName)
  const existing = index ? fichePageOf(pages, index, tab) : null

  async function create() {
    if (!data || busy) return
    setBusy(true); setError("")
    const table = tablesOf(data, tab)[0]
    const columns = table ? (data.columns[table.tabName] ?? []).map((column) => ({ header: column.header, spec: column.spec })) : []
    const content = ficheStarter({
      title: title.trim() || `Fiche · ${tab || indexTitle}`,
      indexTitle: tab ? `${indexTitle} · ${tab}` : indexTitle,
      nameHeader: table ? nameHeaderOf(data, table.tabName) : "",
      imageHeader: ficheImageHeader(columns),
    })
    // Créée d'abord comme une page (brouillon, hors menu), puis réglée sur l'index : Eraser refuse
    // alors une seconde fiche-page pour le même index (la page qu'on venait de créer repart).
    const created = await postPage({ action: "create", page: { ...content, place: "hors-menu", vis: "tous" } })
    if (!created.ok || !created.page) { setBusy(false); setError(created.error); return }
    const saved = await postPage({ action: "save", id: created.page.id, base: created.page.updatedAt, page: { ...draftOf(created.page), rowOf: tab ? { index, tab } : { index } } })
    if (!saved.ok) {
      await postPage({ action: "delete", id: created.page.id })
      setBusy(false); setError(saved.error); return
    }
    await onCreated(created.page.id)
    setBusy(false)
  }

  return <Dialog open={open} onOpenChange={(next) => { if (!next && !busy) { onClose(); setError("") } }}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle className="font-display text-2xl">Nouvelle fiche-page</DialogTitle>
        <DialogDescription>La page de chaque ligne d’un index : chaque peuple, chaque lieu, chaque classe a la sienne, dessinée une fois. Les cartes et les listes qui « ouvrent sa fiche-page » y mènent.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-3">
        <IndexPicker value={index} onChange={(key) => { setIndex(key); setTab(""); setError("") }} label="Index" hint="Ses lignes auront chacune leur fiche-page." />
        {index && tabs.length > 1 && <Field label="Onglet" hint="Tous les onglets : une seule fiche-page pour tout l’index. Un onglet : la sienne passe avant celle de l’index.">
          <select className={`${fieldClass} h-9 text-sm`} value={tab} onChange={(event) => { setTab(event.target.value); setError("") }}>
            <option value="">Tous les onglets</option>
            {tabs.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </Field>}
        {index && <Field label="Titre" hint="Son nom dans l’Index des pages. Sur la page, c’est le nom de la ligne qui s’affiche.">
          <input className={`${fieldClass} h-9 text-sm`} value={title} maxLength={120} placeholder={`Fiche · ${tab || indexTitle}`} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !existing) void create() }} />
        </Field>}
        {index && !data && !readError && <p className="flex items-center gap-2 text-xs text-muted-foreground"><LoaderCircle className="size-3.5 animate-spin" />Lecture de l’index…</p>}
        {readError && <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{readError}</p>}
        {existing && <div className="grid gap-2 rounded-lg border border-[#3b5c8a]/35 bg-[#3b5c8a]/[0.06] px-3 py-2.5 text-[13px]">
          <span>« {existing.title} » est déjà la fiche-page {tab ? `de l’onglet ${tab}` : "de cet index"}.</span>
          <Button type="button" size="sm" variant="outline" className="justify-self-start" onClick={() => onOpenExisting(existing.id)}><FileText />L’ouvrir dans l’atelier</Button>
        </div>}
        {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</p>}
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>Annuler</Button>
        <Button type="button" disabled={busy || !data || Boolean(existing)} onClick={() => void create()}>{busy ? <LoaderCircle className="animate-spin" /> : <FileText />}Créer et ouvrir l’atelier</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
}

/* ---------- La ligne d'exemple, dans l'atelier ---------- */

function readExample(pageId: string) {
  try { return window.localStorage.getItem(ficheExampleKey(pageId)) ?? "" } catch { return "" }
}
function writeExample(pageId: string, id: string) {
  try { window.localStorage.setItem(ficheExampleKey(pageId), id) } catch { /* l'exemple ne sera pas gardé : rien de grave */ }
}

/** Les formulaires que demandent les blocs « Valeurs de la ligne » disposés comme la fiche. */
function formIdsOf(sections: StudioPage["sections"]) {
  return [...new Set(sections.flatMap((section) => section.cols.flat()).flatMap((block) => block.type === "rowfields" && block.style === "form" && block.formId ? [block.formId] : []))]
}

/**
 * La ligne d'exemple d'une fiche-page : les lignes de son index (de son onglet), celle choisie
 * (gardée sur cet ordinateur, la première d'office), et ce que la fiche-page en reçoit, comme sur
 * sa vraie page (ses valeurs, sa fiche).
 */
export function useFicheExample(pageId: string, rowOf: { index: string; tab?: string } | undefined, sections: StudioPage["sections"]) {
  const key = rowOf?.index ?? ""
  const { data, error } = useIndexData(key)
  const { layouts } = useIndexSettings(key)
  const [chosen, setChosen] = useState(() => readExample(pageId))
  const examples = useMemo(() => tablesOf(data, rowOf?.tab).flatMap((table) => data ? ficheExamples(table.headers, table.rows, nameHeaderOf(data, table.tabName)).map((example) => ({ ...example, tab: table.tabName })) : []), [data, rowOf?.tab])
  const example = examples.find((item) => item.id === chosen) ?? examples[0] ?? null
  const formIds = formIdsOf(sections).join("|")
  const row = useMemo((): RowContext | null => {
    if (!data || !example) return null
    const table = tablesOf(data, example.tab)[0]
    if (!table) return null
    const context = ficheRowContext({ index: key, indexTitle: data.definition.title, tab: table.tabName, headers: table.headers, rows: table.rows, id: example.id, nameHeader: nameHeaderOf(data, table.tabName) }, sanitizeRichText)
    if (!context) return null
    const form = tabLayoutOrBuiltin(layouts, key, table.tabName, "form")
    const forms: Record<string, IndexLayout> = {}
    for (const formId of formIds ? formIds.split("|") : []) { const layout = tabFormOrBuiltin(layouts, key, table.tabName, formId); if (layout) forms[formId] = layout }
    return { ...context, ...(form ? { form } : {}), ...(Object.keys(forms).length ? { forms } : {}) }
  }, [data, example, formIds, key, layouts])
  const choose = (id: string) => { setChosen(id); writeExample(pageId, id) }
  return { indexTitle: data?.definition.title ?? key, examples, example, choose, row, loading: Boolean(key) && !data && !error, error }
}

/** Le bandeau d'une fiche-page dans l'atelier : son index, la ligne d'exemple, l'aperçu sur elle. */
export function FicheBar({ rowOf, fiche, onPreview, onOpen }: {
  rowOf: { index: string; tab?: string }
  fiche: ReturnType<typeof useFicheExample>
  /** L'aperçu de la page remplie avec la ligne d'exemple. */
  onPreview: () => void
  /** Sa vraie page (/fiche/<index>/<ID>), le brouillon enregistré. */
  onOpen: (href: string) => void
}) {
  const { example, examples } = fiche
  return <div className="mb-3.5 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-[#3b5c8a]/30 bg-[#3b5c8a]/[0.05] px-4 py-2.5 text-[13px]">
    <span className="inline-flex min-w-0 items-center gap-2"><FileText className="size-4 shrink-0 text-[#3b5c8a]" /><b className="truncate">Fiche-page · {fiche.indexTitle}{rowOf.tab ? ` › ${rowOf.tab}` : ""}</b></span>
    <span className="min-w-0 flex-[1_1_16rem] text-[12px] text-muted-foreground">Chaque ligne a la sienne : « {"{Colonne}"} » prend ses valeurs, « Valeurs de la ligne » et « Cité dans » la montrent.</span>
    {fiche.loading && <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><LoaderCircle className="size-3.5 animate-spin" />Lecture des lignes…</span>}
    {fiche.error && <span className="text-xs text-destructive">{fiche.error}</span>}
    {example && <>
      <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">Ligne d’exemple
        <select className={`${fieldClass} h-7 w-auto max-w-56 text-xs`} value={example.id} onChange={(event) => fiche.choose(event.target.value)}>
          {examples.map((item) => <option key={`${item.tab}|${item.id}`} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <Button type="button" size="xs" variant="outline" onClick={onPreview}><Eye />Voir sur « {example.name} »</Button>
      <Button type="button" size="xs" variant="ghost" onClick={() => onOpen(`/fiche/${encodeURIComponent(rowOf.index)}/${encodeURIComponent(example.id)}`)}>Ouvrir sa vraie page</Button>
    </>}
    {!fiche.loading && !fiche.error && !example && <Hint>Cet index n’a pas encore de ligne avec un identifiant : ajoutes-en une pour voir la fiche-page remplie.</Hint>}
  </div>
}
