"use client";

import { TriangleAlertIcon } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

export default function AppError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <EmptyState
      icon={TriangleAlertIcon}
      title="Não foi possível exibir esta página"
      description="Ocorreu um erro inesperado ao montar a interface. Tente novamente."
      action={<Button onClick={reset}>Tentar novamente</Button>}
      className="rounded-xl border bg-card"
    />
  );
}
