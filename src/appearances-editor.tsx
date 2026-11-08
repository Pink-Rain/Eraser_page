/**
 * L'éditeur des apparences d'un index : ses formulaires, ses survols, ses cartes et ses
 * présentations (liste, kanban, calendrier, chronologie, galerie, arborescence, codex, tableau de
 * bord). C'était la partie « atelier » du « Modifier » d'Eraser ; le moteur (le « Modifier » de
 * l'index) n'y garde que ses colonnes, son formulaire principal et sa carte officielle.
 *
 * Rien n'est écrit avant « Enregistrer » ; les réglages vont sur le serveur partagé d'Eraser
 * (`useIndexSettings`, mêmes clés qu'avant), pour toute la table. Les colonnes ne changent pas
 * ici : quand une colonne est renommée dans le moteur, Eraser fait suivre ces réglages.
 *
 * Empruntés à Eraser parce que le moteur s'en sert aussi : l'éditeur de mise en page (formulaire
 * principal), l'éditeur des cartes (carte officielle), le panneau des versions.
 */
import { useMemo, useRef, useState, type ReactNode } from "react"
import { LayoutGrid, LayoutTemplate, LoaderCircle, MessageSquareQuote, PanelLeftClose, PanelLeftOpen, Save, Settings2, type LucideIcon } from "lucide-react"

import { useContainedWheel, useDockArea } from "@/components/eraser/editor-dock"
import { CardsPanel, IndexCardEditor, duplicateCard } from "@/components/eraser/index-card-editor"
import { IndexLayoutEditor } from "@/components/eraser/index-layout-editor"
import { LayoutViewsPanel } from "@/components/eraser/index-presets-ui"
import { layoutIcons } from "@/components/eraser/index-windows"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cardColumnsFor, layoutColumnsFor, viewColumnsFor } from "@/lib/index-appearance"
import { serializeTabCards, tabCardsOf, type CardTemplate, type TabCards } from "@/lib/index-cards"
import { foldName } from "@/lib/index-columns"
import { automaticLayoutFor, builtinLayoutFor, eraserLayoutStarters, tabLayoutsOf } from "@/lib/index-layout-defaults"
import { DEFAULT_FORM_ID, layoutId, serializeIndexLayout, serializeNamedLayouts, tabLayout, type IndexLayout, type LayoutKind, type NamedLayout, type TabLayouts } from "@/lib/index-layouts"
import { LIST_FAMILY, MAIN_PRESENTATION_ID, fitLayoutToColumns, isPresentationKind, namedPresentationsOf, presentationEntries, presentationKinds, type Presentation, type PresentationKind, type PresentationPreset, type TabPresentations } from "@/lib/index-presentations"
import type { IndexEditorModel } from "@/lib/index-schema-shared"
import type { StatDefinition } from "@/lib/index-stats"
import type { VersionMeta } from "@/lib/index-versions"

import { IndexPresentationsEditor, PresentationsPanel } from "./presentations-editor"

export type AppearanceMode = LayoutKind | "cards" | `view:${PresentationKind}`

/** Une adresse (`?modifier=`) qui désigne un onglet de l'éditeur, sinon rien. */
export function appearanceMode(value: string | null | undefined): AppearanceMode | null {
  if (value === "form" || value === "hover" || value === "cards") return value
  if (value?.startsWith("view:") && isPresentationKind(value.slice(5))) return value as AppearanceMode
  return null
}

type LayoutDraft = { form?: IndexLayout | null; hover?: IndexLayout | null; forms?: NamedLayout[]; hovers?: NamedLayout[]; formMain?: VersionMeta | null; hoverMain?: VersionMeta | null }
type EditorTab = IndexEditorModel["tabs"][number]

const sectionTitle = "text-[11px] font-semibold uppercase tracking-[.14em] text-muted-foreground"

export function AppearancesEditor({ model, open, title, intro, initialMode = "cards", initialTab, onClose, onSaved, layouts, onSaveLayouts, cardsIndex, cards, onSaveCards, presentations, onSavePresentations, viewPresets = [], onSaveViewPreset, onDeleteViewPreset, sampleRows = {}, previewRows = {}, optionsOf, valuesOf, stats = [] }: {
  model: IndexEditorModel
  open: boolean
  title: string
  intro?: ReactNode
  initialMode?: AppearanceMode
  /** L'onglet ouvert d'abord (son nom). */
  initialTab?: string
  /** Fermer sans enregistrer (après confirmation s'il reste des changements). */
  onClose: () => void
  /** Tout est enregistré. */
  onSaved: () => void
  layouts: Record<string, TabLayouts>
  onSaveLayouts: (changes: Array<{ tab: string; form: IndexLayout | null; hover: IndexLayout | null; forms?: NamedLayout[]; hovers?: NamedLayout[] }>) => Promise<void>
  /** La clé de l'index pour ses cartes (celles qu'Eraser avait déjà). */
  cardsIndex?: string
  cards: Record<string, TabCards>
  onSaveCards: (changes: Array<{ tab: string; cards: TabCards | null }>) => Promise<void>
  presentations: Record<string, TabPresentations>
  onSavePresentations: (changes: Array<{ tab: string; presentations: TabPresentations | null }>) => Promise<void>
  /** Les presets de vues, communs à tous les index. */
  viewPresets?: PresentationPreset[]
  onSaveViewPreset?: (preset: { id?: string; name: string; layout: Presentation }) => Promise<unknown>
  onDeleteViewPreset?: (id: string) => Promise<unknown>
  /** Les premières lignes de chaque onglet (en-tête → texte), pour les aperçus. */
  sampleRows?: Record<string, Array<Record<string, string>>>
  /** Des lignes de chaque onglet (une quarantaine), pour l'aperçu des vues. */
  previewRows?: Record<string, Array<Record<string, string>>>
  /** Les choix d'une colonne liste d'un onglet (couleurs des sections, du kanban). */
  optionsOf?: (tab: string, header: string) => Array<{ value: string; color?: string }>
  /** Les valeurs d'une colonne dans toutes les lignes de l'onglet. */
  valuesOf?: (tab: string, header: string) => string[]
  /** Les statistiques de l'index : une tuile du tableau de bord en dessine une. */
  stats?: StatDefinition[]
}) {
  const tabs = model.tabs
  const readOnly = Boolean(model.readOnly)
  const [selectedTab, setSelectedTab] = useState(() => tabs.find((candidate) => candidate.name === initialTab)?.name ?? tabs[0]?.name ?? "")
  const tab: EditorTab | undefined = tabs.find((candidate) => candidate.name === selectedTab) ?? tabs[0]
  const [mode, setMode] = useState<AppearanceMode>(initialMode)
  const [asideOpen, setAsideOpen] = useState(true)
  const [confirmClose, setConfirmClose] = useState(false)
  const [showChanges, setShowChanges] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState("")
  // La Liste réunit liste, kanban et maître-détail sous un seul onglet (« view:list ») : sa version choisie dit sa forme (« forme|id »).
  const openedKind = mode.startsWith("view:") ? mode.slice(5) as PresentationKind : null
  const listFamily = openedKind !== null && LIST_FAMILY.includes(openedKind)
  const viewKind = listFamily ? "list" as PresentationKind : openedKind
  const otherTabsOf = (current: EditorTab) => tabs.filter((candidate) => candidate.name !== current.name).map((candidate) => ({ id: candidate.name, name: candidate.name }))
  const sampleRowsOf = (current: EditorTab) => sampleRows[current.name] ?? []

  /* ---------- formulaires et survols ---------- */

  const [layoutDrafts, setLayoutDrafts] = useState<Record<string, LayoutDraft>>({})
  // Le formulaire ou le survol ouvert, par genre et par onglet (« principal » : l'étoilé).
  const [editedLayout, setEditedLayout] = useState<Record<string, string>>({})
  const savedLayoutsOf = (current: EditorTab) => tabLayoutsOf(layouts, current.name)
  /** La mise en page étoilée : la touchée, sinon l'enregistrée, sinon celle d'Eraser, sinon l'automatique. */
  const layoutOf = (current: EditorTab, kind: LayoutKind): { layout: IndexLayout; source: "saved" | "eraser" | "automatic" } => {
    const touched = layoutDrafts[current.name]
    const builtin = builtinLayoutFor(model.key, current.name, kind)
    const fallback = () => builtin ? { layout: builtin, source: "eraser" as const } : { layout: automaticLayoutFor(kind, layoutColumnsFor(current.columns, kind)), source: "automatic" as const }
    if (touched && kind in touched) return touched[kind] ? { layout: touched[kind]!, source: "saved" } : fallback()
    const saved = tabLayout(layouts, current.name, kind)
    return saved ? { layout: saved, source: "saved" } : fallback()
  }
  const namedLayoutsOf = (current: EditorTab, kind: LayoutKind): NamedLayout[] => {
    const key = kind === "form" ? "forms" : "hovers"
    const touched = layoutDrafts[current.name]
    if (touched && key in touched) return touched[key] ?? []
    return savedLayoutsOf(current)?.[key] ?? []
  }
  const mainMetaOf = (current: EditorTab, kind: LayoutKind): VersionMeta | undefined => {
    const key = kind === "form" ? "formMain" : "hoverMain"
    const touched = layoutDrafts[current.name]
    if (touched && key in touched) return touched[key] ?? undefined
    return savedLayoutsOf(current)?.[key]
  }
  const touchLayout = (current: EditorTab, changes: LayoutDraft) => setLayoutDrafts((state) => ({ ...state, [current.name]: { ...state[current.name], ...changes } }))
  const layoutChanges = useMemo(() => tabs.flatMap((current) => {
    const touched = layoutDrafts[current.name]
    if (!touched) return []
    const savedEntry = tabLayoutsOf(layouts, current.name)
    const saved = { form: savedEntry?.form ?? null, hover: savedEntry?.hover ?? null, forms: savedEntry?.forms ?? [], hovers: savedEntry?.hovers ?? [], formMain: savedEntry?.formMain ?? null, hoverMain: savedEntry?.hoverMain ?? null }
    const form = "form" in touched ? touched.form ?? null : saved.form
    const hover = "hover" in touched ? touched.hover ?? null : saved.hover
    const forms = "forms" in touched ? touched.forms ?? [] : saved.forms
    const hovers = "hovers" in touched ? touched.hovers ?? [] : saved.hovers
    const formMain = "formMain" in touched ? touched.formMain ?? null : saved.formMain
    const hoverMain = "hoverMain" in touched ? touched.hoverMain ?? null : saved.hoverMain
    const changed = serializeIndexLayout(form) !== serializeIndexLayout(saved.form) || serializeIndexLayout(hover) !== serializeIndexLayout(saved.hover) || serializeNamedLayouts(forms) !== serializeNamedLayouts(saved.forms) || serializeNamedLayouts(hovers) !== serializeNamedLayouts(saved.hovers)
      || JSON.stringify(formMain) !== JSON.stringify(saved.formMain) || JSON.stringify(hoverMain) !== JSON.stringify(saved.hoverMain)
    return changed ? [{ tab: current.name, form, hover, forms, hovers, formMain, hoverMain }] : []
  }), [layoutDrafts, layouts, tabs])

  /* ---------- cartes ---------- */

  // Les cartes touchées, par onglet ; `null` : retour aux cartes d'Eraser.
  const [cardDrafts, setCardDrafts] = useState<Record<string, TabCards | null>>({})
  const [selectedCard, setSelectedCard] = useState<Record<string, string | null>>({})
  const cardsKey = cardsIndex ?? model.key
  const cardsOf = (current: EditorTab): TabCards & { builtin: boolean } => {
    if (current.name in cardDrafts) {
      const touched = cardDrafts[current.name]
      return touched ? { ...touched, builtin: false } : { ...tabCardsOf({}, cardsKey, current.name), builtin: true }
    }
    return tabCardsOf(cards, cardsKey, current.name)
  }
  const cardChanges = useMemo(() => tabs.flatMap((current): Array<{ tab: string; cards: TabCards | null }> => {
    if (!(current.name in cardDrafts)) return []
    const saved = tabCardsOf(cards, cardsKey, current.name)
    const touched = cardDrafts[current.name]
    // « Revenir aux cartes d'Eraser » : l'entrée enregistrée est effacée.
    if (touched === null) return saved.builtin ? [] : [{ tab: current.name, cards: null }]
    const savedValue: TabCards = { cards: saved.cards, ...(saved.defaultId ? { defaultId: saved.defaultId } : {}) }
    if (!saved.builtin && serializeTabCards(touched) === serializeTabCards(savedValue)) return []
    return [{ tab: current.name, cards: touched }]
  }), [cardDrafts, cards, cardsKey, tabs])

  /* ---------- présentations ---------- */

  const [presentationDrafts, setPresentationDrafts] = useState<Record<string, TabPresentations>>({})
  // La version de chaque vue ouverte, par genre et par onglet (« principal » : l'étoilée).
  const [editedView, setEditedView] = useState<Record<string, string>>({})
  const savedPresentationsOf = (name: string) => Object.entries(presentations).find(([tabName]) => foldName(tabName) === foldName(name))?.[1] ?? {}
  const presentationsOf = (current: EditorTab) => presentationDrafts[current.name] ?? savedPresentationsOf(current.name)
  const presentationChanges = useMemo(() => tabs.flatMap((current): Array<{ tab: string; presentations: TabPresentations | null }> => {
    if (!(current.name in presentationDrafts)) return []
    const saved = savedPresentationsOf(current.name)
    const base = presentationDrafts[current.name]
    const next: TabPresentations = Object.fromEntries(presentationEntries(base))
    if (base.named?.length) next.named = base.named
    if (JSON.stringify(next) === JSON.stringify(saved)) return []
    return [{ tab: current.name, presentations: Object.keys(next).length ? next : null }]
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `presentations` est lu par savedPresentationsOf
  }), [presentationDrafts, presentations, tabs])

  /* ---------- enregistrer, fermer ---------- */

  const pendingCount = layoutChanges.length + cardChanges.length + presentationChanges.length
  async function submit() {
    setSaving(true); setSaveError("")
    try {
      if (presentationChanges.length) await onSavePresentations(presentationChanges)
      if (cardChanges.length) await onSaveCards(cardChanges)
      if (layoutChanges.length) await onSaveLayouts(layoutChanges)
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : "Les apparences n’ont pas pu être enregistrées.")
      setSaving(false)
      return
    }
    setSaving(false)
    onSaved()
  }
  const requestClose = () => {
    if (saving) return
    if (pendingCount > 0 && !readOnly) setConfirmClose(true)
    else onClose()
  }
  const canSave = !readOnly && !saving && pendingCount > 0

  // Posé dans le dock de la coque, comme le « Modifier » d'un index : la fenêtre couvre la zone des
  // pages seulement, et la molette n'y fait défiler qu'elle.
  const dock = useDockArea()
  const area = dock?.area
  const GAP = 8
  const windowRef = useRef<HTMLDivElement>(null)
  useContainedWheel(windowRef, open)
  const docked = area && area.width > 2 * GAP && area.height > 2 * GAP ? { left: area.left + GAP, top: area.top + GAP, width: area.width - 2 * GAP, height: area.height - 2 * GAP, maxWidth: "none", maxHeight: "none", translate: "none" } : undefined

  const modes = [
    ["form", LayoutTemplate, "Formulaire"],
    ["hover", MessageSquareQuote, "Survol"],
    ["cards", LayoutGrid, "Cartes"],
    ...presentationKinds.filter((kind) => kind.value === "list" || !LIST_FAMILY.includes(kind.value)).map((kind) => [`view:${kind.value}`, layoutIcons[kind.value], kind.label] as const),
  ] as Array<readonly [AppearanceMode, LucideIcon, string]>

  return <>
    <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
      <AlertDialogContent className="sm:max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Quitter sans enregistrer ?</AlertDialogTitle>
          <AlertDialogDescription>{pendingCount} changement{pendingCount > 1 ? "s" : ""} des apparences de « {model.title} » {pendingCount > 1 ? "ne sont pas enregistrés" : "n’est pas enregistré"} : en quittant, {pendingCount > 1 ? "ils seront perdus" : "il sera perdu"}.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row flex-wrap items-center gap-2 sm:flex-nowrap sm:justify-end">
          <AlertDialogAction variant="destructive" className="sm:mr-auto" onClick={() => { setConfirmClose(false); onClose() }}>Quitter sans enregistrer</AlertDialogAction>
          <AlertDialogCancel>Continuer à modifier</AlertDialogCancel>
          {canSave && <AlertDialogAction onClick={() => { setConfirmClose(false); void submit() }}><Save />Enregistrer</AlertDialogAction>}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <Dialog open={open} modal={!dock} onOpenChange={(next) => { if (!next) requestClose() }}>
      {/* Un clic hors de la fenêtre (un onglet, le menu) ne la ferme pas : seuls « Annuler », la croix et Échap (tapé dans la fenêtre). */}
      <DialogContent ref={windowRef} onInteractOutside={(event) => event.preventDefault()} onEscapeKeyDown={(event) => { if (dock && !(event.target instanceof Node && windowRef.current?.contains(event.target))) event.preventDefault() }} style={dock?.hidden ? { display: "none" } : docked} className="flex h-[94svh] max-h-[94svh] flex-col gap-3 sm:max-w-[min(96vw,1440px)]">
        <DialogHeader className="shrink-0">
          <div className="flex flex-wrap items-start justify-between gap-2 pr-8">
            <div>
              <DialogTitle className="font-display text-2xl">{title}</DialogTitle>
              <DialogDescription>{intro ?? "Rien n’est enregistré avant « Enregistrer »."}</DialogDescription>
            </div>
            <span className="inline-flex flex-wrap rounded-lg border bg-muted/30 p-0.5" role="tablist" aria-label="Que modifier">
              {modes.map(([key, Icon, label]) => <Button key={key} type="button" role="tab" aria-selected={mode === key || (key === "view:list" && listFamily)} size="sm" variant={mode === key || (key === "view:list" && listFamily) ? "default" : "ghost"} className="h-7" onClick={() => setMode(key)}><Icon />{label}</Button>)}
            </span>
          </div>
        </DialogHeader>
        <div className={`grid min-h-0 flex-1 gap-3 overflow-hidden ${asideOpen ? "md:grid-cols-[13rem_minmax(0,1fr)]" : "md:grid-cols-[2.25rem_minmax(0,1fr)]"}`}>
          {!asideOpen && <aside className="flex min-h-0 flex-col items-center gap-2 rounded-xl border bg-muted/20 py-2">
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => setAsideOpen(true)} aria-label="Afficher les onglets" title="Afficher le panneau des onglets"><PanelLeftOpen /></Button>
            <span className="[writing-mode:vertical-rl] rotate-180 text-[11px] font-semibold uppercase tracking-[.14em] text-muted-foreground">{tab?.name ?? "Onglets"}</span>
          </aside>}
          <aside className={`min-h-0 flex-col gap-2 overflow-y-auto ${asideOpen ? "flex" : "hidden"}`}>
            <section className="flex shrink-0 flex-col gap-1 rounded-xl border bg-muted/20 p-2" aria-label="Onglets">
              <div className="flex items-center justify-between gap-1 px-1">
                <p className={sectionTitle}>Onglets</p>
                <Button type="button" variant="ghost" size="icon-xs" onClick={() => setAsideOpen(false)} aria-label="Replier les onglets" title="Replier le panneau des onglets"><PanelLeftClose /></Button>
              </div>
              {tabs.map((candidate) => <button key={candidate.name} type="button" onClick={() => setSelectedTab(candidate.name)} className={`truncate rounded-lg px-2.5 py-1.5 text-left text-sm ${candidate.name === tab?.name ? "bg-primary/10" : "hover:bg-muted/60"}`}>{candidate.name}</button>)}
            </section>

            {(mode === "form" || mode === "hover") && tab && (() => {
              const kind: LayoutKind = mode
              const named = namedLayoutsOf(tab, kind)
              const editKey = `${kind}:${tab.name}`
              const chosen = named.find((item) => item.id === editedLayout[editKey])
              const current = chosen ? chosen.layout : layoutOf(tab, kind).layout
              const label = kind === "form" ? "Formulaire" : "Survol"
              const select = (id: string) => setEditedLayout((state) => ({ ...state, [editKey]: id }))
              const setNamed = (list: NamedLayout[], main?: IndexLayout) => touchLayout(tab, { ...(kind === "form" ? { forms: list } : { hovers: list }), ...(main ? kind === "form" ? { form: main } : { hover: main } : {}) })
              const mainMeta = mainMetaOf(tab, kind)
              const mainName = mainMeta?.name ?? `${label} principal`
              /** Les versions nommées, la version à l'étoile (`null` : celle d'Eraser ou l'automatique) et son nom (`null` : aucun). */
              const setMain = (list: NamedLayout[], main: IndexLayout | null, meta: VersionMeta | null) => touchLayout(tab, kind === "form" ? { forms: list, form: main, formMain: meta } : { hovers: list, hover: main, hoverMain: meta })
              const add = (name: string, layout: IndexLayout) => { const id = layoutId(); setNamed([...named, { id, name, layout }]); select(id) }
              return <LayoutViewsPanel
                key={editKey}
                kind={kind}
                tabName={tab.name}
                items={[{ id: DEFAULT_FORM_ID, name: mainName }, ...named.map((item) => ({ id: item.id, name: item.name }))]}
                selectedId={chosen?.id ?? DEFAULT_FORM_ID}
                onSelect={select}
                onStar={(id) => {
                  // L'étoile passe à cette version, avec son nom et son identifiant ; l'ancienne prend sa
                  // place dans la liste, avec les siens. Rien n'est renommé.
                  const target = named.find((item) => item.id === id)
                  if (!target) return
                  const old = mainMeta ?? { id: layoutId(), name: mainName }
                  setMain(named.map((item) => item.id === id ? { id: old.id, name: old.name, layout: layoutOf(tab, kind).layout } : item), target.layout, { id: target.id, name: target.name })
                  select(DEFAULT_FORM_ID)
                }}
                onRename={(id, name) => id === DEFAULT_FORM_ID
                  // La version à l'étoile se renomme comme les autres (celle d'Eraser est alors gardée telle quelle, sous ce nom).
                  ? setMain(named, layoutOf(tab, kind).layout, { id: mainMeta?.id ?? layoutId(), name })
                  : setNamed(named.map((item) => item.id === id ? { ...item, name } : item))}
                onMove={(delta) => {
                  // Seules les versions nommées se déplacent : l'étoilée reste en tête.
                  if (!chosen) return
                  const at = named.findIndex((item) => item.id === chosen.id)
                  const to = at + delta
                  if (at < 0 || to < 0 || to >= named.length) return
                  const list = [...named]
                  list.splice(to, 0, list.splice(at, 1)[0])
                  setNamed(list)
                }}
                onNew={() => add(`${label} ${named.length + 2}`, automaticLayoutFor(kind, layoutColumnsFor(tab.columns, kind)))}
                onDuplicate={() => add(`${chosen ? chosen.name : `${label} principal`} (copie)`, current)}
                onRemove={() => {
                  if (chosen) { setNamed(named.filter((item) => item.id !== chosen.id)); return select(DEFAULT_FORM_ID) }
                  // Retirer la version à l'étoile : l'étoile passe à la suivante (avec son nom) ; seule, c'est le retour à l'affichage d'Eraser.
                  const [next, ...rest] = named
                  if (next) setMain(rest, next.layout, { id: next.id, name: next.name })
                  else setMain([], null, null)
                  select(DEFAULT_FORM_ID)
                }}
                mainRemovable={named.length > 0 || layoutOf(tab, kind).source === "saved" || Boolean(mainMeta)}
                full={named.length >= 11}
                layout={current}
                otherTabs={otherTabsOf(tab).map((other) => { const target = tabs.find((candidate) => candidate.name === other.id); return target && namedLayoutsOf(target, kind).length >= 11 ? { ...other, disabled: true, hint: "12 versions au plus" } : other })}
                disabled={readOnly || saving}
                onApply={(layout) => chosen ? setNamed(named.map((item) => item.id === chosen.id ? { ...item, layout } : item)) : touchLayout(tab, kind === "form" ? { form: layout } : { hover: layout })}
                onCopyTo={(ids, star) => setLayoutDrafts((state) => ({ ...state, ...Object.fromEntries(ids.flatMap((id) => {
                  // La copie s'ajoute aux versions de l'onglet, sans rien remplacer ; à l'étoile, l'ancienne étoilée garde une place nommée.
                  const target = tabs.find((candidate) => candidate.name === id)
                  if (!target) return []
                  const key = kind === "form" ? "forms" : "hovers"
                  const touched = state[id]
                  const list = touched && key in touched ? touched[key] ?? [] : savedLayoutsOf(target)?.[key] ?? []
                  if (list.length >= 11) return []
                  const copy = { id: layoutId(), name: `${chosen ? chosen.name : `${label} principal`} (de « ${tab.name} »)`, layout: current }
                  if (!star) return [[id, { ...touched, [key]: [...list, copy] }]]
                  const previous = { id: layoutId(), name: `Ancien ${label.toLocaleLowerCase("fr")} principal`, layout: layoutOf(target, kind).layout }
                  return [[id, { ...touched, [kind]: current, [key]: [...list, previous] }]]
                })) }))}
              />
            })()}
            {mode === "cards" && tab && (() => {
              const entry = cardsOf(tab)
              return <CardsPanel
                key={tab.name}
                tabName={tab.name}
                columns={cardColumnsFor(tab.columns)}
                value={entry}
                builtin={entry.builtin}
                builtins={tabCardsOf({}, cardsKey, tab.name).cards}
                samples={sampleRowsOf(tab)}
                otherTabs={otherTabsOf(tab).map((other) => { const target = tabs.find((candidate) => candidate.name === other.id); return target && cardsOf(target).cards.length >= 12 ? { ...other, disabled: true, hint: "12 cartes au plus" } : other })}
                selected={selectedCard[tab.name] ?? null}
                onSelect={(id) => setSelectedCard((current) => ({ ...current, [tab.name]: id }))}
                disabled={readOnly || saving}
                onChange={(next) => setCardDrafts((current) => ({ ...current, [tab.name]: { cards: next.cards, ...(next.defaultId ? { defaultId: next.defaultId } : {}) } }))}
                onCopyTo={(ids, card, star) => setCardDrafts((current) => ({ ...current, ...Object.fromEntries(ids.flatMap((id) => {
                  // La carte s'ajoute (un onglet plein n'est pas proposé) ; à l'étoile, elle devient celle montrée d'abord.
                  const target = tabs.find((candidate) => candidate.name === id)
                  const base = target ? cardsOf(target) : { cards: [] as CardTemplate[] }
                  if (base.cards.length >= 12) return []
                  const copy = duplicateCard(card)
                  return [[id, { ...base, cards: [...base.cards, copy], ...(star ? { defaultId: copy.id } : {}) }]]
                })) }))}
                onReset={() => setCardDrafts((current) => ({ ...current, [tab.name]: null }))}
              />
            })()}
            {viewKind && tab && (() => {
              const editKey = `${viewKind}:${tab.name}`
              return <PresentationsPanel
                key={editKey}
                kind={viewKind}
                family={listFamily ? LIST_FAMILY : undefined}
                tabName={tab.name}
                columns={viewColumnsFor(tab.columns)}
                value={presentationsOf(tab)}
                selectedId={editedView[editKey] ?? (listFamily ? `${openedKind}|${MAIN_PRESENTATION_ID}` : MAIN_PRESENTATION_ID)}
                onSelect={(id) => setEditedView((state) => ({ ...state, [editKey]: id }))}
                onChange={(next) => setPresentationDrafts((state) => ({ ...state, [tab.name]: next }))}
                presets={viewPresets}
                onSavePreset={onSaveViewPreset}
                onDeletePreset={onDeleteViewPreset}
                otherTabs={otherTabsOf(tab).map((other) => { const target = tabs.find((candidate) => candidate.name === other.id); return target && namedPresentationsOf(presentationsOf(target), viewKind).length >= 11 ? { ...other, disabled: true, hint: "12 versions au plus" } : other })}
                onCopyTo={(ids, layout, star, name) => setPresentationDrafts((state) => ({ ...state, ...Object.fromEntries(ids.flatMap((id) => {
                  // La vue s'ajoute aux versions de l'onglet, sans rien remplacer ; à l'étoile, l'ancienne étoilée garde une place nommée.
                  // Sa forme est la sienne (une version kanban de la Liste reste un kanban).
                  const form = isPresentationKind(layout.kind) ? layout.kind : viewKind
                  const target = tabs.find((candidate) => candidate.name === id)
                  if (!target) return []
                  const value = state[id] ?? presentationsOf(target)
                  if (namedPresentationsOf(value, form).length >= 11) return []
                  const fitted = { ...fitLayoutToColumns(layout, viewColumnsFor(target.columns)), kind: form }
                  const copyId = () => Math.random().toString(36).slice(2, 10)
                  if (!star) return [[id, { ...value, named: [...(value.named ?? []), { id: copyId(), name: `${name} (de « ${tab.name} »)`, layout: fitted }] }]]
                  const previous = value[form] ? [{ id: copyId(), name: "Ancienne vue principale", layout: { ...value[form]!, kind: form } }] : []
                  return [[id, { ...value, [form]: fitted, named: [...(value.named ?? []), ...previous] }]]
                })) }))}
                disabled={readOnly || saving}
              />
            })()}
          </aside>

          {viewKind && tab && (() => {
            // La version ouverte : « forme|id » pour la Liste (la liste principale d'office), sinon son identifiant.
            const chosen = editedView[`${viewKind}:${tab.name}`] ?? (listFamily ? `${openedKind}|${MAIN_PRESENTATION_ID}` : MAIN_PRESENTATION_ID)
            const [editedKind, versionId] = listFamily && chosen.includes("|") ? [chosen.split("|")[0] as PresentationKind, chosen.split("|")[1]] : [viewKind, chosen]
            return <section className="grid min-h-0 content-start gap-3 overflow-y-auto pr-1 lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden lg:pr-0">
              <IndexPresentationsEditor
                key={`${tab.name}:${editedKind}:${versionId}`}
                kind={editedKind}
                versionId={versionId}
                tabName={tab.name}
                columns={viewColumnsFor(tab.columns)}
                rows={previewRows[tab.name] ?? sampleRowsOf(tab)}
                value={presentationsOf(tab)}
                onChange={(next) => setPresentationDrafts((current) => ({ ...current, [tab.name]: next }))}
                optionsOf={optionsOf ? (header) => optionsOf(tab.name, header) : undefined}
                cards={cardsOf(tab).cards}
                cardColumns={cardColumnsFor(tab.columns)}
                forms={[{ id: DEFAULT_FORM_ID, name: "Formulaire principal", layout: layoutOf(tab, "form").layout }, ...namedLayoutsOf(tab, "form")]}
                hovers={namedLayoutsOf(tab, "hover").map((hover) => ({ id: hover.id, name: hover.name }))}
                stats={stats}
              />
            </section>
          })()}

          {mode === "cards" && tab && <section className="grid min-h-0 content-start gap-3 overflow-y-auto pr-1 lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden lg:pr-0">
            <IndexCardEditor
              key={tab.name}
              tabName={tab.name}
              columns={cardColumnsFor(tab.columns)}
              value={cardsOf(tab)}
              builtins={tabCardsOf({}, cardsKey, tab.name).cards}
              samples={sampleRowsOf(tab)}
              selected={selectedCard[tab.name] ?? null}
              onSelect={(id) => setSelectedCard((current) => ({ ...current, [tab.name]: id }))}
              hovers={namedLayoutsOf(tab, "hover").map((hover) => ({ id: hover.id, name: hover.name }))}
              extras={{ forms: [{ id: DEFAULT_FORM_ID, name: "Formulaire principal" }, ...namedLayoutsOf(tab, "form").map((form) => ({ id: form.id, name: form.name }))], indexes: model.relationTargets, tabs: tabs.map((item) => item.name), family: model.family === "objects" ? "objects" : "world" }}
              disabled={readOnly || saving}
              onChange={(next) => setCardDrafts((current) => ({ ...current, [tab.name]: { cards: next.cards, ...(next.defaultId ? { defaultId: next.defaultId } : {}) } }))}
            />
          </section>}

          {(mode === "form" || mode === "hover") && tab && (() => {
            const formId = editedLayout[`${mode}:${tab.name}`] ?? DEFAULT_FORM_ID
            const list = namedLayoutsOf(tab, mode)
            const named = formId !== DEFAULT_FORM_ID ? list.find((item) => item.id === formId) : undefined
            const main = layoutOf(tab, mode)
            const current = named ? { layout: named.layout, source: "saved" as const } : main
            // L'aperçu en grand passe d'une ligne à l'autre : celles de l'aperçu des vues (une quarantaine), sinon les premières.
            const rows = previewRows[tab.name]?.length ? previewRows[tab.name] : sampleRowsOf(tab)
            const update = (layout: IndexLayout) => {
              if (!named) return touchLayout(tab, mode === "form" ? { form: layout } : { hover: layout })
              const next = list.map((item) => item.id === named.id ? { ...item, layout } : item)
              touchLayout(tab, mode === "form" ? { forms: next } : { hovers: next })
            }
            return <section className="grid min-h-0 content-start gap-3 overflow-y-auto pr-1 lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden lg:pr-0">
              <IndexLayoutEditor
                key={`${tab.name}:${mode}:${named?.id ?? DEFAULT_FORM_ID}`}
                kind={mode}
                columns={layoutColumnsFor(tab.columns, mode)}
                value={current.layout}
                source={current.source}
                onChange={update}
                onReset={named ? undefined : () => touchLayout(tab, mode === "form" ? { form: null } : { hover: null })}
                resetLabel={builtinLayoutFor(model.key, tab.name, mode) ? "Revenir à la mise en page d’Eraser" : "Revenir à l’affichage automatique"}
                sample={rows[0]}
                samples={rows}
                indexTitle={model.title}
                sampleRow={rows[0] ? { index: model.key, id: rows[0].ID ?? "", tab: tab.name } : undefined}
                forms={[{ id: DEFAULT_FORM_ID, name: "Formulaire principal" }, ...namedLayoutsOf(tab, "form").map((item) => ({ id: item.id, name: item.name }))]}
                valuesOf={valuesOf ? (header) => valuesOf(tab.name, header) : undefined}
                eraserStarters={eraserLayoutStarters(model.key, tab.name, mode)}
                disabled={readOnly || saving}
              />
            </section>
          })()}
        </div>

        {/* Résumé : toujours lisible, jamais écrasé */}
        <div className="shrink-0 rounded-xl border bg-muted/30 px-3 py-2 text-xs">
          {saveError && <p className="mb-1 text-destructive">{saveError}</p>}
          <div className="flex items-center gap-2">
            <Settings2 className="size-3.5 shrink-0" />
            <span className="font-semibold">{pendingCount
              ? [
                layoutChanges.length ? `${layoutChanges.length} mise${layoutChanges.length > 1 ? "s" : ""} en page à enregistrer dans Eraser (pour tout le monde)` : "",
                presentationChanges.length ? `Vues de ${presentationChanges.filter((change) => change.presentations).length || presentationChanges.length} onglet(s) à enregistrer dans Eraser (pour tout le monde)` : "",
                cardChanges.length ? (() => { const count = cardChanges.filter((change) => change.cards).length || cardChanges.length; return `Cartes de ${count} onglet${count > 1 ? "s" : ""} à enregistrer dans Eraser (pour tout le monde)` })() : "",
              ].filter(Boolean).join(" · ")
              : "Aucun changement pour l’instant"}</span>
            {pendingCount > 0 && <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setShowChanges(!showChanges)}>{showChanges ? "Masquer le détail" : "Voir le détail"}</Button>}
          </div>
          {showChanges && <ul className="mt-1 grid max-h-32 gap-0.5 overflow-y-auto text-muted-foreground">
            {presentationChanges.map((change, index) => <li key={`views-${index}`}>• Vues de « {change.tab} » (dans Eraser) : {change.presentations ? `${presentationEntries(change.presentations).length} réglée(s)${change.presentations.named?.length ? `, ${change.presentations.named.length} autre(s) version(s)` : ""}` : "réglages d’office"}</li>)}
            {cardChanges.map((change, index) => <li key={`cards-${index}`}>• Cartes de « {change.tab} » (dans Eraser) : {change.cards ? `${change.cards.cards.length} carte${change.cards.cards.length > 1 ? "s" : ""}` : "retour aux cartes d’Eraser"}</li>)}
            {layoutChanges.map((change, index) => <li key={`layout-${index}`}>• Mise en page de « {change.tab} » (dans Eraser) : {!change.form && !change.hover && !change.forms?.length && !change.hovers?.length ? "affichage d’Eraser" : [change.form ? "formulaire réglé" : "formulaire d’Eraser", change.hover ? "survol réglé" : "survol d’Eraser", ...(change.forms?.length ? [`${change.forms.length} autre${change.forms.length > 1 ? "s" : ""} formulaire${change.forms.length > 1 ? "s" : ""}`] : []), ...(change.hovers?.length ? [`${change.hovers.length} autre${change.hovers.length > 1 ? "s" : ""} survol${change.hovers.length > 1 ? "s" : ""}`] : [])].join(", ")}</li>)}
          </ul>}
        </div>
        <DialogFooter className="shrink-0">
          {/* « Annuler » est un choix clair : il ferme sans rien enregistrer, sans redemander. */}
          <Button type="button" variant="outline" onClick={() => { if (!saving) onClose() }} disabled={saving}>{readOnly ? "Fermer" : "Annuler"}</Button>
          {!readOnly && <Button type="button" disabled={!canSave} onClick={() => void submit()}>{saving ? <LoaderCircle className="animate-spin" /> : <Save />}Enregistrer</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
}
