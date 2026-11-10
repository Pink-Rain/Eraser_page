/**
 * Le survol d'une apparence (ce qui s'ouvre au passage de la souris sur un élément), réglé comme une
 * carte ou un formulaire : l'éditeur des survols d'Eraser, en grand, sur les lignes de l'onglet. Le
 * survol est gardé dans l'apparence elle-même (`hoverLayout` d'une présentation ou d'une carte) : sur
 * une page, il est propre à la page ; l'index ne sert que de point de départ (son survol).
 * Le serveur ne montre jamais, dans un survol, que ce que le lecteur peut lire.
 */
import { useState } from "react"
import { Check, MessageSquareQuote } from "lucide-react"

import { IndexLayoutEditor, type LayoutColumn } from "@/components/eraser/index-layout-editor"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { automaticLayoutFor } from "@/lib/index-layout-defaults"
import type { IndexLayout } from "@/lib/index-layouts"

export function HoverStudio({ title, columns, samples, value, base, onApply, onClose }: {
  title: string
  /** Les colonnes que le survol peut montrer (typées). */
  columns: LayoutColumn[]
  /** Des lignes de l'onglet (en-tête → texte), pour l'aperçu. */
  samples: Array<Record<string, string>>
  /** Le survol propre déjà réglé ; absent : on part de `base`. */
  value?: IndexLayout
  /** Le survol de l'index (son point de départ) ; absent : l'automatique. */
  base?: IndexLayout | null
  /** Le survol propre ; `undefined` : plus de survol propre (celui de l'index revient). */
  onApply: (layout: IndexLayout | undefined) => void
  onClose: () => void
}) {
  const start = () => base ?? automaticLayoutFor("hover", columns)
  const [draft, setDraft] = useState<IndexLayout>(() => value ?? start())
  return <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
    <DialogContent className="flex h-[92svh] max-h-[92svh] flex-col gap-3 sm:max-w-[min(96vw,1360px)]">
      <DialogHeader className="shrink-0">
        <DialogTitle className="flex items-center gap-2 font-display text-2xl"><MessageSquareQuote className="size-5 text-primary" />{title}</DialogTitle>
        <DialogDescription>Ce qui s’ouvre au passage de la souris sur un élément : l’image, le sous-titre, les cases, les blocs. Réglé ici, il est propre à cette apparence ; les joueurs n’y voient jamais que ce qu’ils peuvent lire.</DialogDescription>
      </DialogHeader>
      <div className="grid min-h-0 flex-1 overflow-y-auto lg:overflow-hidden">
        <IndexLayoutEditor
          kind="hover"
          columns={columns}
          value={draft}
          source="saved"
          onChange={setDraft}
          onReset={() => setDraft(start())}
          resetLabel={base ? "Repartir du survol de l’index" : "Repartir du survol automatique"}
          sample={samples[0]}
          samples={samples}
        />
      </div>
      <DialogFooter className="shrink-0 items-center">
        {value && <Button type="button" variant="ghost" className="mr-auto" onClick={() => { onApply(undefined); onClose() }} title="L’apparence reprend le survol de l’index">Retirer ce survol</Button>}
        <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
        <Button type="button" onClick={() => { onApply(draft); onClose() }}><Check />Appliquer</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
}
