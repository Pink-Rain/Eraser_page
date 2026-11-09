/**
 * L'apparence d'un bloc « Vue d'index », réglée depuis la page : une seule rangée de formes
 * (tableau, cartes, liste, kanban, maître-détail, galerie, calendrier, chronologie, arborescence,
 * codex, tableau de bord), toutes construites comme une carte :
 * - les cartes : la carte propre au bloc, dans l'éditeur des cartes (`block.card`) ;
 * - les présentations : leurs réglages à gauche, l'aperçu en grand à droite, où l'on clique un
 *   morceau (en-tête, section, élément, barre d'outils, pied) pour ouvrir ses réglages ; l'élément
 *   peut être une carte sur mesure, faite dans le même éditeur des cartes.
 *
 * L'apparence est celle de la page (rien n'est écrit dans l'index). L'index ne sert que de
 * raccourci : « Partir de » reprend une de ses apparences ou un preset, « Enregistrer en preset » en
 * garde une pour d'autres pages. L'aperçu montre les lignes que la page montrera (ses conditions et
 * son tri compris), lues par Eraser comme pour le bloc.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { BookmarkPlus, Check, LayoutGrid, LoaderCircle, Palette, Plus, Sparkles } from "lucide-react"

import { useContainedWheel, useDockArea } from "@/components/eraser/editor-dock"
import { NewCardDialog, SingleCardEditor, duplicateCard } from "@/components/eraser/index-card-editor"
import { NamePresetDialog } from "@/components/eraser/index-variants-panel"
import { PageViewBlock } from "@/components/eraser/page-index-block"
import { useIndexSettings } from "@/components/eraser/index-windows"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select"
import type { PageBlock, ViewBlockKind } from "@/lib/custom-pages"
import type { ViewBlockData } from "@/lib/custom-pages-data"
import { cardColumnsFor, layoutColumnsFor, viewColumnsFor } from "@/lib/index-appearance"
import { tabCardsOf, type CardTemplate } from "@/lib/index-cards"
import { foldName } from "@/lib/index-columns"
import { automaticLayoutFor, tabLayoutOrBuiltin, tabLayoutsOf } from "@/lib/index-layout-defaults"
import { DEFAULT_FORM_ID, type NamedLayout } from "@/lib/index-layouts"
import { DEFAULT_ITEM_CARD, LIST_FAMILY, MAIN_PRESENTATION_ID, PRESENTATION_ITEM_CARD, builtinPresentationPresets, fitLayoutToColumns, isPresentationKind, namedPresentationsOf, type Presentation, type PresentationKind, type TabPresentations } from "@/lib/index-presentations"
import { cn } from "@/lib/utils"

import { blockIcons } from "./page-studio-icons"
import { IndexPresentationsEditor } from "./presentations-editor"
import { presentationStartersFor } from "./presentation-starters"
import { useIndexDetails } from "./page-studio-settings"
import { blockForm, blockForms } from "./block-forms"

type ViewBlock = Extract<PageBlock, { type: "view" }>
/** L'apparence en cours de réglage : la forme, et ce qui la dessine. */
type Draft = { kind: ViewBlockKind; layout?: Presentation; card?: CardTemplate; cardId?: string }

/** Ce qui dessine chaque ligne (l'élément), gardé d'une forme à l'autre : la carte suit. */
function elementOf(draft: Draft): Partial<Presentation> {
  if (draft.kind === "cards") return draft.card ? { itemCard: PRESENTATION_ITEM_CARD, itemTemplate: draft.card } : draft.cardId ? { itemCard: draft.cardId } : {}
  if (!draft.layout) return {}
  const { itemCard, itemTemplate, itemForm, hover, click, clickByRole } = draft.layout
  return Object.fromEntries(Object.entries({ itemCard, itemTemplate, itemForm, hover, click, clickByRole }).filter(([, value]) => value !== undefined)) as Partial<Presentation>
}

/** Les lignes que montrera le bloc (ses conditions et son tri), lues par Eraser comme pour la page : l'aperçu. */
function useBlockRows(block: ViewBlock) {
  const url = block.index && block.tab ? `/api/pages/block-data?index=${encodeURIComponent(block.index)}&def=${encodeURIComponent(JSON.stringify({ tab: block.tab, kind: "table", limit: 60, where: block.where, sort: block.sort }))}` : ""
  const [state, setState] = useState<{ url: string; data: ViewBlockData | null; error: string }>({ url, data: null, error: "" })
  useEffect(() => {
    if (!url) return
    let alive = true
    fetch(url).then(async (response) => {
      const body = (await response.json().catch(() => ({}))) as { data?: ViewBlockData; error?: string }
      if (!alive) return
      if (!response.ok || !body.data) setState({ url, data: null, error: body.error || "Les lignes de l’onglet n’ont pas pu être lues." })
      else setState({ url, data: body.data, error: "" })
    }).catch(() => { if (alive) setState({ url, data: null, error: "Eraser ne répond pas : réessaie dans un instant." }) })
    return () => { alive = false }
  }, [url])
  return state.url === url ? state : { url, data: null, error: "" }
}

export function BlockAppearanceStudio({ block, onApply, onClose }: {
  block: ViewBlock
  /** Les réglages du bloc changés (la page s'enregistre d'elle-même). */
  onApply: (patch: Partial<ViewBlock>) => void
  onClose: () => void
}) {
  const { details } = useIndexDetails(block.index)
  const settings = useIndexSettings(block.index)
  const rows = useBlockRows(block)
  const tab = details?.tabs.find((item) => item.name === block.tab)
  const ready = Boolean(details) && settings.ready

  /* ---------- Ce que l'index offre : ses colonnes, ses cartes, ses formulaires, ses survols ---------- */

  const data = rows.data
  const sourceColumns = useMemo(() => (data?.headers ?? []).map((header) => ({ header, spec: data!.specs[header] ?? { kind: "rich" as const } })), [data])
  const cardColumns = useMemo(() => cardColumnsFor(sourceColumns), [sourceColumns])
  const viewColumns = useMemo(() => viewColumnsFor(sourceColumns), [sourceColumns])
  const samples = useMemo(() => (data?.rows ?? []).map((row) => Object.fromEntries((data?.headers ?? []).map((header, at) => [header, row.cells[at] ?? ""]))), [data])
  const tabCards = useMemo(() => tabCardsOf(settings.cards, block.index, block.tab).cards, [block.index, block.tab, settings.cards])
  const tabViews: TabPresentations = useMemo(() => Object.entries(settings.presentations).find(([name]) => foldName(name) === foldName(block.tab))?.[1] ?? {}, [block.tab, settings.presentations])
  const tabLayouts = tabLayoutsOf(settings.layouts, block.tab)
  const forms: NamedLayout[] = useMemo(() => [
    { id: DEFAULT_FORM_ID, name: "Formulaire principal", layout: tabLayoutOrBuiltin(settings.layouts, block.index, block.tab, "form") ?? automaticLayoutFor("form", layoutColumnsFor(sourceColumns, "form")) },
    ...(tabLayoutsOf(settings.layouts, block.tab)?.forms ?? []),
  ], [block.index, block.tab, settings.layouts, sourceColumns])
  const hovers = (tabLayouts?.hovers ?? []).map((hover) => ({ id: hover.id, name: hover.name }))
  const optionsOf = (header: string) => (data?.specs[header]?.options ?? []).map((option) => ({ value: option.value, color: option.color }))

  /* ---------- L'apparence en cours ---------- */

  const resolve = (): Draft => block.kind === "table" ? { kind: "table" }
    : block.kind === "cards" ? { kind: "cards", ...(block.card ? { card: block.card } : {}), ...(block.cardId ? { cardId: block.cardId } : {}) }
      : { kind: block.kind, layout: blockForm(block, { presentations: settings.presentations, viewPresets: settings.viewPresets, tabForm: tab?.forms?.[block.kind] }) }
  const [draft, setDraft] = useState<Draft | null>(() => block.layout || block.kind === "table" || block.kind === "cards" ? resolve() : null)
  const [initial, setInitial] = useState(() => draft ? JSON.stringify(draft) : "")
  // Une forme d'office ou un preset : retrouvés une fois l'index lu.
  if (!draft && ready) { const resolved = resolve(); setDraft(resolved); setInitial(JSON.stringify(resolved)) }
  // Chaque forme essayée garde ses réglages : y revenir les retrouve.
  const [memory, setMemory] = useState<Partial<Record<ViewBlockKind, Draft>>>({})
  const [creatingCard, setCreatingCard] = useState(false)
  const [naming, setNaming] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const changed = Boolean(draft) && JSON.stringify(draft) !== initial

  function pickForm(kind: ViewBlockKind) {
    if (!draft || draft.kind === kind) return
    setMemory((current) => ({ ...current, [draft.kind]: draft }))
    const remembered = memory[kind]
    if (remembered) { setDraft(remembered); return }
    const element = elementOf(draft)
    if (kind === "table") return setDraft({ kind })
    if (kind === "cards") {
      const own = element.itemCard === PRESENTATION_ITEM_CARD && element.itemTemplate ? { card: element.itemTemplate } : element.itemCard && element.itemCard !== DEFAULT_ITEM_CARD && element.itemCard !== PRESENTATION_ITEM_CARD ? { cardId: element.itemCard } : {}
      setDraft({ kind, ...own })
      if (!("card" in own) && !("cardId" in own)) setCreatingCard(true)
      return
    }
    // Liste, kanban et maître-détail partagent leurs réglages ; une autre présentation part de celle de
    // l'onglet, sinon de sa première forme de départ, bâtie sur les colonnes de l'onglet (une galerie a
    // ses images, un kanban ses colonnes, une chronologie ses dates).
    const form = kind as PresentationKind
    const shared = draft.layout && LIST_FAMILY.includes(form) && LIST_FAMILY.includes(draft.kind as PresentationKind)
    const starter = presentationStartersFor(form, cardColumns.length ? cardColumns : viewColumns.map((header) => ({ header })))[0]?.layout
    const base: Presentation = shared ? draft.layout! : fitLayoutToColumns({ ...(tab?.forms?.[form] ?? starter ?? {}), kind: form }, viewColumns)
    const layout: Presentation = { ...base, ...element, kind: form }
    // Une liste rangée en sections devient un kanban rangé en colonnes, sur la même colonne.
    if (form === "kanban" && !layout.kanbanColumn) { layout.kanbanColumn = layout.groupBy ?? starter?.kanbanColumn; if (layout.groupBy === layout.kanbanColumn) delete layout.groupBy }
    setDraft({ kind, layout })
  }

  /* ---------- Partir de l'index (raccourci) et enregistrer en preset ---------- */

  const startPoints = !draft ? [] : draft.kind === "cards"
    ? [
      ...tabCards.map((card) => ({ id: `carte:${card.id}`, group: "Les cartes de l’onglet", name: card.name })),
      ...settings.cardPresets.map((preset) => ({ id: `preset-carte:${preset.id}`, group: "Tes presets de cartes", name: preset.name })),
    ]
    : isPresentationKind(draft.kind)
      ? [
        ...(tab?.forms?.[draft.kind] ? [{ id: "onglet", group: "L’index", name: "Celle à l’étoile de l’onglet" }] : []),
        ...namedPresentationsOf(tabViews, draft.kind).map((item) => ({ id: `version:${item.id}`, group: "L’index", name: `Version « ${item.name} »` })),
        ...settings.viewPresets.filter((preset) => preset.layout.kind === draft.kind).map((preset) => ({ id: `preset:${preset.id}`, group: "Tes presets", name: preset.name })),
        ...builtinPresentationPresets.filter((preset) => preset.layout.kind === draft.kind).map((preset) => ({ id: `preset:${preset.id}`, group: "Presets d’Eraser", name: preset.name })),
      ]
      : []
  function startFrom(id: string) {
    if (!draft) return
    if (id.startsWith("carte:")) { const card = tabCards.find((item) => item.id === id.slice(6)); if (card) setDraft({ kind: "cards", card: duplicateCard(card, card.name) }); return }
    if (id.startsWith("preset-carte:")) { const preset = settings.cardPresets.find((item) => item.id === id.slice(13)); if (preset) setDraft({ kind: "cards", card: duplicateCard(preset.card, preset.name) }); return }
    if (!isPresentationKind(draft.kind)) return
    const kind = draft.kind
    const layout = id === "onglet" ? tab?.forms?.[kind]
      : id.startsWith("version:") ? namedPresentationsOf(tabViews, kind).find((item) => item.id === id.slice(8))?.layout
        : [...settings.viewPresets, ...builtinPresentationPresets].find((item) => item.id === id.slice(7))?.layout
    if (layout) setDraft({ kind, layout: fitLayoutToColumns({ ...layout, kind }, viewColumns) })
  }
  const canSavePreset = Boolean(draft && ((draft.kind === "cards" && draft.card) || (isPresentationKind(draft.kind) && draft.layout)))

  /* ---------- Appliquer ---------- */

  function apply() {
    if (!draft) return onClose()
    if (!changed) return onClose()
    if (draft.kind === "table") onApply({ kind: "table", layout: undefined, presetId: undefined, card: undefined })
    else if (draft.kind === "cards") onApply({ kind: "cards", card: draft.card, cardId: draft.card ? undefined : draft.cardId, layout: undefined, presetId: undefined })
    else onApply({ kind: draft.kind, layout: { ...draft.layout, kind: draft.kind as PresentationKind }, presetId: undefined, card: undefined })
    onClose()
  }
  const requestClose = () => { if (changed) setConfirmClose(true); else onClose() }

  // Posé dans la zone des pages, comme les apparences d'un index : la molette n'y fait défiler qu'elle.
  const dock = useDockArea()
  const area = dock?.area
  const GAP = 8
  const windowRef = useRef<HTMLDivElement>(null)
  useContainedWheel(windowRef, true)
  const docked = area && area.width > 2 * GAP && area.height > 2 * GAP ? { left: area.left + GAP, top: area.top + GAP, width: area.width - 2 * GAP, height: area.height - 2 * GAP, maxWidth: "none", maxHeight: "none", translate: "none" } : undefined

  const kindInfo = draft ? blockForms.find((entry) => entry.value === draft.kind) : undefined
  const loading = !draft || (!data && !rows.error)
  let body: ReactNode
  if (!draft) body = <Waiting text="Lecture de l’index…" />
  else if (rows.error) body = <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{rows.error}</p>
  else if (!data) body = <Waiting text="Lecture des lignes de l’onglet…" />
  else if (draft.kind === "table") body = <section className="grid min-h-0 content-start gap-2 overflow-y-auto rounded-xl border bg-muted/20 p-3">
    <p className="text-[11px] text-muted-foreground">Le tableau montre les colonnes de l’onglet que le lecteur peut voir, une ligne par ligne de l’index. Il n’a pas d’autre réglage : pour choisir ce qui s’affiche, prends une autre forme.</p>
    <div onClickCapture={(event) => { event.preventDefault(); event.stopPropagation() }}><PageViewBlock block={{ ...block, kind: "table", layout: undefined, presetId: undefined, card: undefined, heading: "" }} source={{ direct: true }} /></div>
  </section>
  else if (draft.kind === "cards") body = draft.card
    ? <section className="min-h-0 overflow-y-auto lg:overflow-hidden"><SingleCardEditor key={draft.card.id} card={draft.card} columns={cardColumns} samples={samples} onChange={(card) => setDraft({ kind: "cards", card })} extras={{ hovers: [{ id: DEFAULT_FORM_ID, name: "Survol principal" }, ...hovers], forms: forms.map((form) => ({ id: form.id, name: form.name })), cards: [], tabs: [block.tab], family: "world" }} /></section>
    : <section className="grid place-items-center rounded-xl border border-dashed p-10 text-center">
      <div className="grid max-w-md gap-3">
        <LayoutGrid className="mx-auto size-8 text-primary/50" />
        <p className="font-display text-xl font-semibold">Chaque ligne en carte</p>
        <p className="text-sm text-muted-foreground">{draft.cardId ? `Ce bloc montre la carte « ${tab?.cardList?.find((card) => card.id === draft.cardId)?.name ?? draft.cardId} » de l’index. Copie-la pour la régler ici, pour cette page.` : "Une taille, une image, une couleur, des blocs (titre, lignes, texte, pastilles, jauge…) et une composition libre. Pars d’une forme toute prête, remplie avec les colonnes de l’onglet."}</p>
        <div className="flex flex-wrap justify-center gap-2">
          {draft.cardId && tabCards.some((card) => card.id === draft.cardId) && <Button type="button" onClick={() => { const card = tabCards.find((item) => item.id === draft.cardId)!; setDraft({ kind: "cards", card: duplicateCard(card, card.name) }) }}><Sparkles />La copier pour cette page</Button>}
          <Button type="button" variant={draft.cardId ? "outline" : "default"} onClick={() => setCreatingCard(true)}><Plus />Créer la carte</Button>
        </div>
      </div>
    </section>
  else if (isPresentationKind(draft.kind) && draft.layout) body = <IndexPresentationsEditor
    key={draft.kind}
    kind={draft.kind}
    versionId={MAIN_PRESENTATION_ID}
    tabName={block.tab}
    columns={viewColumns}
    rows={samples}
    value={{ ...tabViews, [draft.kind]: draft.layout }}
    onChange={(next) => { const layout = next[draft.kind as PresentationKind]; if (layout) setDraft({ kind: draft.kind, layout }) }}
    optionsOf={optionsOf}
    cards={tabCards}
    cardColumns={cardColumns}
    forms={forms}
    hovers={hovers}
  />

  return <>
    <Dialog open modal={!dock} onOpenChange={(next) => { if (!next) requestClose() }}>
      <DialogContent ref={windowRef} onInteractOutside={(event) => event.preventDefault()} onEscapeKeyDown={(event) => { if (dock && !(event.target instanceof Node && windowRef.current?.contains(event.target))) event.preventDefault() }} style={dock?.hidden ? { display: "none" } : docked} className="flex h-[94svh] max-h-[94svh] flex-col gap-3 sm:max-w-[min(96vw,1440px)]">
        <DialogHeader className="shrink-0">
          <div className="flex flex-wrap items-start justify-between gap-2 pr-8">
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2 font-display text-2xl"><Palette className="size-5 text-primary" />Apparence du bloc</DialogTitle>
              <DialogDescription>{data?.title ?? block.index} › {block.tab}. Pour cette page seulement : rien n’est écrit dans l’index. {kindInfo?.hint ?? ""}</DialogDescription>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {startPoints.length > 0 && <NativeSelect aria-label="Partir de" value="" onChange={(event) => { if (event.target.value) startFrom(event.target.value) }} className="h-8 w-auto py-0 text-xs">
                <NativeSelectOption value="">Partir de…</NativeSelectOption>
                {[...new Set(startPoints.map((point) => point.group))].map((group) => <NativeSelectOptGroup key={group} label={group}>{startPoints.filter((point) => point.group === group).map((point) => <NativeSelectOption key={point.id} value={point.id}>{point.name}</NativeSelectOption>)}</NativeSelectOptGroup>)}
              </NativeSelect>}
              <Button type="button" size="sm" variant="outline" disabled={!canSavePreset} onClick={() => setNaming(true)} title="La garder en preset, pour la reprendre sur d’autres pages ou dans un index"><BookmarkPlus />Enregistrer en preset</Button>
            </div>
          </div>
        </DialogHeader>

        {/* Une seule rangée de formes : le tableau, les cartes et chaque présentation. */}
        <div role="radiogroup" aria-label="Forme" className="flex shrink-0 flex-wrap gap-1">
          {blockForms.map((entry) => {
            const Icon = blockIcons.views[entry.value]
            const active = draft?.kind === entry.value
            return <button key={entry.value} type="button" role="radio" aria-checked={active} disabled={!draft} title={entry.hint} onClick={() => pickForm(entry.value)} className={cn("inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[13px] transition disabled:opacity-50", active ? "border-foreground bg-foreground font-semibold text-background" : "border-border/80 bg-background/60 text-muted-foreground hover:border-border hover:text-foreground")}>
              <Icon className="size-4" />{entry.label}
            </button>
          })}
        </div>

        <div className="grid min-h-0 flex-1 overflow-hidden">{body}</div>

        <DialogFooter className="shrink-0 items-center">
          <span className="mr-auto text-xs text-muted-foreground">{loading ? "" : changed ? "Des changements à appliquer à la page." : "Aucun changement pour l’instant."}</span>
          <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
          <Button type="button" disabled={!draft} onClick={apply}><Check />Appliquer à la page</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {creatingCard && data && <NewCardDialog
      title="Cartes : la carte de cette page"
      columns={cardColumns}
      samples={samples}
      builtins={tabCards}
      builtinsLabel="Les cartes de cet onglet"
      builtinsHint="Une copie, à régler pour cette page seulement."
      onPick={(card) => { setDraft({ kind: "cards", card }); setCreatingCard(false) }}
      onClose={() => setCreatingCard(false)}
    />}

    {naming && draft && <NamePresetDialog
      title="Enregistrer en preset"
      description={draft.kind === "cards" ? "La carte de ce bloc, pour la reprendre dans d’autres pages et dans les index. Une colonne absente ailleurs est simplement sautée." : `Cette apparence (${kindInfo?.label ?? ""}), pour la reprendre dans d’autres pages et dans les index. Une colonne absente ailleurs est simplement sautée.`}
      initialName={draft.kind === "cards" ? draft.card?.name ?? "Carte" : `${kindInfo?.label ?? ""} · ${block.tab}`}
      existing={draft.kind === "cards" ? settings.cardPresets : settings.viewPresets.filter((preset) => preset.layout.kind === draft.kind)}
      onSave={(name, id) => draft.kind === "cards" ? settings.saveCardPreset({ id, name, card: draft.card! }) : settings.saveViewPreset({ id, name, layout: draft.layout! })}
      onClose={() => setNaming(false)}
    />}

    <Dialog open={confirmClose} onOpenChange={setConfirmClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Quitter sans appliquer ?</DialogTitle>
          <DialogDescription>Les changements de l’apparence de ce bloc ne sont pas encore dans la page.</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-row flex-wrap gap-2 sm:justify-end">
          <Button type="button" variant="destructive" className="sm:mr-auto" onClick={() => { setConfirmClose(false); onClose() }}>Quitter sans appliquer</Button>
          <Button type="button" variant="outline" onClick={() => setConfirmClose(false)}>Continuer</Button>
          <Button type="button" onClick={() => { setConfirmClose(false); apply() }}><Check />Appliquer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
}

function Waiting({ text }: { text: string }) {
  return <div aria-busy="true" className="grid min-h-60 place-items-center text-sm text-muted-foreground"><span className="inline-flex items-center gap-2"><LoaderCircle className="size-4 animate-spin" />{text}</span></div>
}
