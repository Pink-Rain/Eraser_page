/**
 * Eraser Page : l'atelier des pages d'Eraser (l'Index des pages, l'atelier d'une page, l'éditeur
 * du menu). Eraser l'affiche dans sa coque à l'adresse `/extension/page/…` et lui prête ses
 * pièces (React, le routeur, l'affichage des pages, les éditeurs des index…) : tout import
 * « @/… » vient d'Eraser, à la version installée. Les données viennent de `/api/pages/atelier`
 * et l'enregistrement des API de pages d'Eraser, qui vérifient les droits.
 *
 * Adresses : `/extension/page` (Index des pages, `?dossier=`, `?vue=`, `?nouvelle=1&section=&modele=`),
 * `/extension/page/atelier/<id>`, `/extension/page/menu`, `/extension/page/apparences/<index>`
 * (`?onglet=`, `?modifier=` : survols, cartes, formulaires et présentations d'un index).
 *
 * Droits par module : les pages et le menu, les administrateurs ; les apparences des index, les MJ
 * et les administrateurs (comme les index). Les API d'Eraser les vérifient de toute façon.
 */
import { useEffect, useState, type ComponentProps, type ReactNode } from "react"
import { useSearchParams } from "next/navigation"
import { FilePenLine, LoaderCircle } from "lucide-react"

import { PageLabel } from "@/components/eraser/app-shell"
import { PAGES_HREF } from "@/lib/app-menu"

import { Appearances } from "./appearances"
import { MenuEditor } from "./menu-editor"
import { PageDirectory } from "./page-directory"
import { PageStudio } from "./page-studio"

/** Ce qu'Eraser donne à l'extension (components/eraser/extension-host.tsx, API 2). */
type EraserContext = {
  api: number
  account: { uid: string; displayName: string; role: "joueur" | "mj" | "admin" }
  path: string[]
  eraser: (path: string, init?: RequestInit) => Promise<Response>
}

type IndexData = Omit<ComponentProps<typeof PageDirectory>, "newPage" | "initialView">
type StudioData = Omit<ComponentProps<typeof PageStudio>, "backHref"> & { folder: string | null }
type MenuData = ComponentProps<typeof MenuEditor>

export function Page({ eraser }: { eraser: EraserContext }) {
  const [screen, id] = eraser.path
  const role = eraser.account.role
  if (screen === "apparences" && id) {
    if (role === "joueur") return <NoAccess text="Les apparences des index sont réservées aux MJ et aux administrateurs." />
    return <Appearances key={id} indexKey={id} tab={new URLSearchParams(window.location.search).get("onglet")} mode={new URLSearchParams(window.location.search).get("modifier")} />
  }
  if (role !== "admin") return <NoAccess text="L’atelier des pages et le menu sont réservés aux administrateurs." />
  if (screen === "atelier" && id) {
    return <Screen<StudioData> key={`page:${id}`} eraser={eraser} url={`/api/pages/atelier?ecran=page&id=${encodeURIComponent(id)}`} label="Atelier">
      {(data) => <PageLabel label={`Atelier · ${data.initial.title}`}>
        <PageStudio
          key={data.initial.id}
          initial={data.initial}
          pages={data.pages}
          campaigns={data.campaigns}
          linking={data.linking}
          role={data.role}
          backHref={data.folder ? `${PAGES_HREF}?dossier=${encodeURIComponent(data.folder)}` : PAGES_HREF}
        />
      </PageLabel>}
    </Screen>
  }
  if (screen === "menu") {
    return <Screen<MenuData> key="menu" eraser={eraser} url="/api/pages/atelier?ecran=menu" label="Menu">
      {(data) => <PageLabel label="Menu"><MenuEditor role={data.role} initial={data.initial} /></PageLabel>}
    </Screen>
  }
  return <PagesIndex eraser={eraser} />
}

function NoAccess({ text }: { text: string }) {
  return <div className="w-full flex-1 px-5 py-9 sm:px-8 md:py-14">
    <div className="grid min-h-52 place-items-center rounded-2xl border border-dashed bg-card/35 p-8 text-center">
      <div className="max-w-lg">
        <FilePenLine className="mx-auto size-9 text-primary/45" />
        <h1 className="font-display mt-3 text-2xl font-semibold">Réservé</h1>
        <p className="mt-2 text-sm text-muted-foreground">{text}</p>
      </div>
    </div>
  </div>
}

/** L'Index des pages : le dossier ou la vue ouverts et « Nouvelle page » viennent de l'adresse. */
function PagesIndex({ eraser }: { eraser: EraserContext }) {
  const parameters = useSearchParams()
  const wantsNew = parameters.get("nouvelle") === "1"
  const vue = parameters.get("vue")
  const initialView = parameters.get("dossier") || (vue === "toutes" || vue === "corbeille" || vue === "modeles" ? vue : "racine")
  return <Screen<IndexData> key="index" eraser={eraser} url="/api/pages/atelier?ecran=index" label="Index des pages">
    {(data) => <PageLabel label="Index des pages">
      <PageDirectory
        // Jamais remonté quand l'adresse change : ouvrir un dossier réécrit `?dossier=`, et le
        // remonter le repartait des données lues à l'ouverture (un dossier renommé reprenait son
        // ancien nom, une page rangée revenait). Le dossier et « Nouvelle page » suivent l'adresse.
        {...data}
        newPage={wantsNew ? { place: parameters.get("section") ?? undefined, template: parameters.get("modele") ?? undefined } : undefined}
        initialView={initialView}
      />
    </PageLabel>}
  </Screen>
}

/** Un écran de l'atelier : ses données lues sur Eraser, puis affichées. */
function Screen<T>({ eraser, url, label, children }: { eraser: EraserContext; url: string; label: string; children: (data: T) => ReactNode }) {
  const [state, setState] = useState<{ data: T } | { error: string } | null>(null)
  useEffect(() => {
    let alive = true
    eraser.eraser(url)
      .then(async (response) => {
        const body = await response.json().catch(() => ({})) as T & { error?: string }
        if (!alive) return
        setState(response.ok ? { data: body } : { error: body.error || "L'atelier n'a pas pu charger ses données." })
      })
      .catch(() => { if (alive) setState({ error: "Eraser ne répond pas : réessaie dans un instant." }) })
    return () => { alive = false }
  }, [eraser, url])
  if (!state) return <div aria-busy="true" className="grid min-h-[40svh] place-items-center text-muted-foreground"><LoaderCircle className="size-5 animate-spin" aria-label={`Ouverture : ${label}`} /></div>
  if ("error" in state) {
    return <div className="w-full flex-1 px-5 py-9 sm:px-8 md:py-14">
      <div className="grid min-h-52 place-items-center rounded-2xl border border-dashed bg-card/35 p-8 text-center">
        <div className="max-w-lg">
          <FilePenLine className="mx-auto size-9 text-primary/45" />
          <h1 className="font-display mt-3 text-2xl font-semibold">{label}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{state.error}</p>
        </div>
      </div>
    </div>
  }
  return <>{children(state.data)}</>
}
