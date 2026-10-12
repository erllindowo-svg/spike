"use client";

import { DistributionChart } from "@/components/shared/distribution-chart";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  DistributionDatum,
  DistributionDimension,
} from "@/features/processes/types";

export type DistributionData = Record<
  DistributionDimension,
  DistributionDatum[]
>;

export function DistributionCard({
  data,
  description = "Quantidade de processos encontrados por agrupamento.",
  className,
}: {
  data: DistributionData;
  description?: string;
  className?: string;
}) {
  return (
    <Card className={className}>
      <Tabs defaultValue="area" className="gap-4">
        <CardHeader>
          <CardTitle>Distribuição processual</CardTitle>
          <CardDescription>{description}</CardDescription>
          <CardAction>
            <TabsList>
              <TabsTrigger value="area">Área</TabsTrigger>
              <TabsTrigger value="tribunal">Tribunal</TabsTrigger>
            </TabsList>
          </CardAction>
        </CardHeader>
        <CardContent>
          <TabsContent value="area">
            <DistributionChart data={data.area} label="área jurídica" />
          </TabsContent>
          <TabsContent value="tribunal">
            <DistributionChart data={data.tribunal} label="tribunal" />
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  );
}
