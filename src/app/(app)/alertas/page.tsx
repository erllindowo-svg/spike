import { redirect } from "next/navigation";

// Os alertas passaram a morar em Monitoramentos (círculo 1 do escopo,
// docs/etapa-7-escopo.md). O endereço antigo continua funcionando.
export default function AlertsPage() {
  redirect("/monitoramentos/alertas");
}
