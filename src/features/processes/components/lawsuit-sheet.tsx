"use client";

import { ExternalLinkIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatCnj } from "@/features/processes/cnj";
import type { Lawsuit } from "@/features/processes/types";

import { LawsuitDetails, LawsuitTrackingAction } from "./lawsuit-details";

export function LawsuitSheet({
  lawsuit,
  onOpenChange,
}: {
  lawsuit: Lawsuit | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={!!lawsuit} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 data-[side=right]:sm:max-w-xl">
        {lawsuit && (
          <>
            <SheetHeader className="border-b">
              <SheetDescription>Processo</SheetDescription>
              <SheetTitle className="font-mono text-base">
                {formatCnj(lawsuit.cnj)}
              </SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto p-4">
              <LawsuitDetails lawsuit={lawsuit} />
            </div>
            <SheetFooter className="flex-row flex-wrap items-center justify-between border-t">
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href={`/processos/${lawsuit.cnj}`} />}
              >
                <ExternalLinkIcon data-icon="inline-start" />
                Abrir página
              </Button>
              <LawsuitTrackingAction lawsuit={lawsuit} />
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
