import { SearchXIcon } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <EmptyState
      icon={SearchXIcon}
      title="Registro não encontrado"
      description="Este item não existe nos dados de demonstração."
      action={
        <Button nativeButton={false} render={<Link href="/" />}>
          Voltar para a visão geral
        </Button>
      }
      className="rounded-xl border bg-card"
    />
  );
}
