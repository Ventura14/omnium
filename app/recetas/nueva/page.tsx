import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Page, PageHeader, btnGhost } from "@/components/kit";
import RecipeForm from "../RecipeForm";

export const metadata = { title: "Nueva receta" };

export default function NuevaRecetaPage() {
  return (
    <Page>
      <Link href="/recetas" className={btnGhost}>
        <ArrowLeft className="size-4" /> Recetas
      </Link>
      <PageHeader eyebrow="Recetas" title="Nueva receta" />
      <RecipeForm />
    </Page>
  );
}
