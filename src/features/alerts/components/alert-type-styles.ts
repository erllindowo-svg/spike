import {
  FilePlus2Icon,
  RadarIcon,
  ScrollTextIcon,
  type LucideIcon,
} from "lucide-react";

import type { AlertType } from "@/features/alerts/types";

// Ícone e cor de cada tipo de alerta.
export const alertTypeStyles: Record<
  AlertType,
  { icon: LucideIcon; className: string }
> = {
  new_lawsuit: { icon: FilePlus2Icon, className: "bg-primary/10 text-primary" },
  lawsuit_movement: { icon: ScrollTextIcon, className: "bg-info/10 text-info" },
  tracking_notice: { icon: RadarIcon, className: "bg-warning/10 text-warning" },
};
