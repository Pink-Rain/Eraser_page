/**
 * Apparences d'un index : ses survols, ses cartes, ses formulaires et ses présentations (liste,
 * tableau de bord, galerie, chronologie, calendrier, arborescence, codex…), réglés ici, dans
 * l'atelier des pages, et non plus dans le « Modifier » de l'index. Le moteur n'y garde que ses
 * colonnes, son formulaire principal et sa carte officielle.
 *
 * L'éditeur est celui d'Eraser (`IndexEditor`, prêté), en périmètre « atelier » ; les réglages
 * s'enregistrent comme avant (`useIndexSettings`, mêmes clés sur le serveur partagé), pour toute
 * la table. Réservé aux MJ et aux administrateurs, comme les index ; Eraser vérifie les droits.
 */
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { LoaderCircle, Palette } from "lucide-react"

import { IndexEditor } from "@/components/eraser/index-editor"
import { useIndexSettings } from "@/components/eraser/index-windows"
import type { IndexEditorModel } from "@/lib/index-schema-shared"
import type { WorldIndexData } from "@/lib/world-indexes"

type Loaded = { model: IndexEditorModel; data: WorldIndexData }

export function Appearances({ indexKey, tab, mode }: { indexKey: string; tab: string | null; mode: string | null }) {
  const router = useRouter()
  const settings = useIndexSettings(indexKey)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    let alive = true
    const read = async (url: string) => {
      const response = await fetch(url, { cache: "no-store" })
      const body = await response.json().catch(() => ({})) as Record<string, unknown> & { error?: string }
      if (!response.ok) throw new Error(body.error || "Cet index n’a pas pu être lu.")
      return body
    }
    Promise.all([
      read(`/api/resources/index-schema?key=${encodeURIComponent(indexKey)}`),
      read(`/api/resources/world-indexes?key=${encodeURIComponent(indexKey)}`),
    ])
      .then(([schema, index]) => {
        if (!alive) return
        const model = schema.model as IndexEditorModel | undefined
        const data = index.data as WorldIndexData | undefined
        if (!model || !data) throw new Error("Cet index n’a pas pu être lu.")
        setLoaded({ model, data })
      })
      .catch((reason: unknown) => { if (alive) setError(reason instanceof Error ? reason.message : "Cet index n’a pas pu être lu.") })
    return () => { alive = false }
  }, [indexKey])

  // Des lignes de chaque onglet (en-tête → valeur) pour les aperçus, comme dans l'index.
  const samples = useMemo(() => {
    if (!loaded) return null
    const rowsOf = (count: number) => Object.fromEntries(loaded.data.tables.map((table) => [table.tabName, table.rows.slice(0, count).map((row) => Object.fromEntries(table.headers.map((header, at) => [header, row.values[at] ?? ""])))]))
    return { sample: rowsOf(3), preview: rowsOf(40) }
  }, [loaded])

  const title = loaded?.data.definition.title ?? indexKey
  const back = () => router.push(loaded?.data.definition.path ?? "/ressources")

  if (error) return <Notice title="Apparences" text={error} />
  if (!loaded || !samples) return <div aria-busy="true" className="grid min-h-[40svh] place-items-center text-muted-foreground"><LoaderCircle className="size-5 animate-spin" aria-label="Ouverture des apparences" /></div>
  return <>
    <Notice title={`Apparences · ${title}`} text="Les survols, les cartes, les formulaires et les présentations de cet index. Les colonnes, le formulaire principal et la carte officielle se règlent dans « Modifier », sur la page de l’index." />
    <IndexEditor
      model={loaded.model}
      scope="atelier"
      open
      title={`Apparences · ${title}`}
      intro="Survols, cartes, formulaires et présentations : enregistrés pour toute la table, ils servent dans l’index et dans les pages."
      initialMode={(mode as Parameters<typeof IndexEditor>[0]["initialMode"]) ?? "cards"}
      initialTab={tab ?? loaded.data.tables[0]?.tabName}
      onClose={back}
      onApply={back}
      layouts={settings.layouts}
      onSaveLayouts={settings.saveLayouts}
      cardsIndex={indexKey}
      cards={settings.cards}
      onSaveCards={settings.saveCards}
      presentations={settings.presentations}
      onSavePresentations={settings.savePresentations}
      viewPresets={settings.viewPresets}
      onSaveViewPreset={settings.saveViewPreset}
      onDeleteViewPreset={settings.deleteViewPreset}
      sampleRows={samples.sample}
      previewRows={samples.preview}
      optionsOf={(tabName, header) => (loaded.data.columns[tabName]?.find((column) => column.header === header)?.spec.options ?? []).map((option) => ({ value: option.value, color: option.color }))}
    />
  </>
}

function Notice({ title, text }: { title: string; text: string }) {
  return <div className="w-full px-5 py-9 sm:px-8 md:py-14">
    <div className="rounded-2xl border border-dashed bg-card/35 p-8 text-center">
      <Palette className="mx-auto size-9 text-primary/45" />
      <h1 className="font-display mt-3 text-2xl font-semibold">{title}</h1>
      <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">{text}</p>
    </div>
  </div>
}
