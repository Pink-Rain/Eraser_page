/**
 * « Valeurs de la ligne » comme la fiche, disposées depuis la page : l'éditeur des formulaires
 * (sections, lignes de champs, colonne latérale, blocs), en grand, sur les vraies lignes de l'index
 * de la fiche-page. La disposition est gardée dans le bloc (`form`), pour cette page seulement ;
 * l'index ne sert que de point de départ (son formulaire) et de raccourci (« Enregistrer en preset »).
 */
import { useMemo, useRef, useState } from "react"
import { BookmarkPlus, Check, LayoutTemplate, LoaderCircle } from "lucide-react"

import { useContainedWheel, useDockArea } from "@/components/eraser/editor-dock"
import { IndexLayoutEditor } from "@/components/eraser/index-layout-editor"
import { NamePresetDialog } from "@/components/eraser/index-variants-panel"
import { useIndexSettings } from "@/components/eraser/index-windows"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { PageBlock } from "@/lib/custom-pages"
import { layoutColumnsFor } from "@/lib/index-appearance"
import { foldName } from "@/lib/index-columns"
import { automaticLayoutFor, eraserLayoutStarters, tabFormOrBuiltin, tabLayoutOrBuiltin } from "@/lib/index-layout-defaults"
import type { IndexLayout } from "@/lib/index-layouts"

import { useIndexData } from "./fiche-page-ui"

type RowFieldsBlock = Extract<PageBlock, { type: "rowfields" }>

export function RowFormStudio({ rowOf, block, onApply, onClose }: {
  rowOf: { index: string; tab?: string }
  block: RowFieldsBlock
  /** La disposition propre à la page ; `undefined` : celle du formulaire de l'index. */
  onApply: (form: IndexLayout | undefined) => void
  onClose: () => void
}) {
  const { data, error } = useIndexData(rowOf.index)
  const settings = useIndexSettings(rowOf.index)
  const table = data?.tables.find((item) => !rowOf.tab || foldName(item.tabName) === foldName(rowOf.tab)) ?? null
  const tabName = table?.tabName ?? rowOf.tab ?? ""
  const columns = useMemo(() => layoutColumnsFor((data?.columns[tabName] ?? []).map((column) => ({ header: column.header, spec: column.spec })), "form"), [data, tabName])
  const samples = useMemo(() => (table?.rows ?? []).slice(0, 40).map((row) => Object.fromEntries(table!.headers.map((header, at) => [header, row.values[at] ?? ""]))), [table])
  const idHeader = table?.headers.find((header) => /^id$/i.test(header.trim()))
  // La disposition du bloc, sinon le formulaire choisi de l'index, sinon son formulaire à l'étoile, sinon l'automatique.
  const fromIndex = (): IndexLayout => (block.formId ? tabFormOrBuiltin(settings.layouts, rowOf.index, tabName, block.formId) : tabLayoutOrBuiltin(settings.layouts, rowOf.index, tabName, "form")) ?? automaticLayoutFor("form", columns)
  const ready = Boolean(data) && settings.ready
  const [draft, setDraft] = useState<IndexLayout | null>(block.form ?? null)
  if (!draft && ready) setDraft(fromIndex())
  const [naming, setNaming] = useState(false)

  const dock = useDockArea()
  const area = dock?.area
  const GAP = 8
  const windowRef = useRef<HTMLDivElement>(null)
  useContainedWheel(windowRef, true)
  const docked = area && area.width > 2 * GAP && area.height > 2 * GAP ? { left: area.left + GAP, top: area.top + GAP, width: area.width - 2 * GAP, height: area.height - 2 * GAP, maxWidth: "none", maxHeight: "none", translate: "none" } : undefined

  return <>
    <Dialog open modal={!dock} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent ref={windowRef} onInteractOutside={(event) => event.preventDefault()} style={dock?.hidden ? { display: "none" } : docked} className="flex h-[94svh] max-h-[94svh] flex-col gap-3 sm:max-w-[min(96vw,1440px)]">
        <DialogHeader className="shrink-0">
          <div className="flex flex-wrap items-start justify-between gap-2 pr-8">
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2 font-display text-2xl"><LayoutTemplate className="size-5 text-primary" />Valeurs de la ligne, comme une fiche</DialogTitle>
              <DialogDescription>{data?.definition.title ?? rowOf.index}{tabName ? ` › ${tabName}` : ""}. Les sections, les champs, la colonne de côté et les blocs de cette fiche-page, sur les lignes de l’index. Pour cette page seulement : le formulaire de l’index ne change pas.</DialogDescription>
            </div>
            <Button type="button" size="sm" variant="outline" disabled={!draft} onClick={() => setNaming(true)} title="La garder en preset de formulaire, pour la reprendre ailleurs"><BookmarkPlus />Enregistrer en preset</Button>
          </div>
        </DialogHeader>
        <div className="grid min-h-0 flex-1 overflow-y-auto lg:overflow-hidden">
          {error ? <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>
            : !draft ? <div aria-busy="true" className="grid min-h-60 place-items-center text-sm text-muted-foreground"><span className="inline-flex items-center gap-2"><LoaderCircle className="size-4 animate-spin" />Lecture de l’index…</span></div>
              : <IndexLayoutEditor
                kind="form"
                columns={columns}
                value={draft}
                source="saved"
                onChange={setDraft}
                onReset={() => setDraft(fromIndex())}
                resetLabel="Repartir du formulaire de l’index"
                sample={samples[0]}
                samples={samples}
                indexTitle={data?.definition.title}
                sampleRow={samples[0] && idHeader ? { index: rowOf.index, id: samples[0][idHeader] ?? "", tab: tabName } : undefined}
                eraserStarters={eraserLayoutStarters(rowOf.index, tabName, "form")}
              />}
        </div>
        <DialogFooter className="shrink-0 items-center">
          {block.form && <Button type="button" variant="ghost" className="mr-auto" onClick={() => { onApply(undefined); onClose() }} title="Le bloc reprend le formulaire de l’index (ses changements s’y verront)">Reprendre le formulaire de l’index</Button>}
          <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
          <Button type="button" disabled={!draft} onClick={() => { if (draft) onApply(draft); onClose() }}><Check />Appliquer à la page</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    {naming && draft && <NamePresetDialog
      title="Enregistrer en preset de formulaire"
      description="Cette disposition, pour l’appliquer à d’autres onglets ou d’autres pages. Les colonnes absentes ailleurs sont simplement ignorées."
      initialName={`Fiche · ${tabName}`}
      existing={settings.layoutPresets.filter((preset) => preset.kind === "form")}
      onSave={(name, id) => settings.saveLayoutPreset({ id, name, kind: "form", layout: draft })}
      onClose={() => setNaming(false)}
    />}
  </>
}
