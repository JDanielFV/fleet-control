import { Skeleton } from "./skeleton";

/**
 * Skeleton that mirrors the current driver table in DriversSlice:
 * 7 columns: Foto, Nombre, CURP, Licencia, Vence, Auto, Acciones
 */
export function DriverTableSkeleton() {
  return (
    <tr className="border-b border-border/20">
      <td className="py-3 px-2"><Skeleton className="w-8 h-8 rounded-full" /></td>
      <td className="py-3 px-2"><Skeleton className="h-4 w-28" /></td>
      <td className="py-3 px-2"><Skeleton className="h-3 w-24" /></td>
      <td className="py-3 px-2"><Skeleton className="h-3 w-20" /></td>
      <td className="py-3 px-2"><Skeleton className="h-3 w-16" /></td>
      <td className="py-3 px-2"><Skeleton className="h-3 w-24" /></td>
      <td className="py-3 px-2"><div className="flex justify-end gap-1"><Skeleton className="w-7 h-7 rounded-md" /><Skeleton className="w-7 h-7 rounded-md" /></div></td>
    </tr>
  );
}

export function DriversListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="w-full overflow-x-auto" aria-label="Cargando conductores">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/40">
            <th className="text-left py-2.5 px-2">Foto</th>
            <th className="text-left py-2.5 px-2">Nombre</th>
            <th className="text-left py-2.5 px-2">CURP</th>
            <th className="text-left py-2.5 px-2">Licencia</th>
            <th className="text-left py-2.5 px-2">Vence</th>
            <th className="text-left py-2.5 px-2">Auto</th>
            <th className="text-right py-2.5 px-2">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: count }).map((_, i) => (
            <DriverTableSkeleton key={i} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Skeleton that mirrors the current vehicle table in VehiclesSlice:
 * 5 columns: Auto, Placa, ID, Chofer, Acciones
 */
export function VehicleTableSkeleton() {
  return (
    <tr className="border-b border-border/20">
      <td className="py-3 px-2"><Skeleton className="h-4 w-32" /></td>
      <td className="py-3 px-2"><Skeleton className="h-3 w-16" /></td>
      <td className="py-3 px-2"><Skeleton className="h-3 w-12 font-mono" /></td>
      <td className="py-3 px-2"><Skeleton className="h-3 w-24" /></td>
      <td className="py-3 px-2"><div className="flex justify-end gap-1"><Skeleton className="w-7 h-7 rounded-md" /><Skeleton className="w-7 h-7 rounded-md" /></div></td>
    </tr>
  );
}

export function VehiclesListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="w-full overflow-x-auto" aria-label="Cargando vehículos">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/40">
            <th className="text-left py-2.5 px-2">Auto</th>
            <th className="text-left py-2.5 px-2">Placa</th>
            <th className="text-left py-2.5 px-2">ID</th>
            <th className="text-left py-2.5 px-2">Chofer</th>
            <th className="text-right py-2.5 px-2">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: count }).map((_, i) => (
            <VehicleTableSkeleton key={i} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Skeleton that mirrors the current checklist table in Dashboard:
 * 9 columns: Chofer, Auto, Placa, ID Auto, Km Anterior, Km Nuevo, Renta, Pendiente, Stats
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-5" aria-label="Cargando panel principal">
      <div className="flex items-center justify-between gap-4 pt-2">
        <div className="space-y-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-3 w-56" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="w-10 h-10 rounded-full" />
          <Skeleton className="w-10 h-10 rounded-full" />
        </div>
      </div>
      <Skeleton className="h-12 w-full rounded-2xl" />
      <div className="w-full overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/40">
              <th className="text-left py-2.5 px-2">Chofer</th>
              <th className="text-left py-2.5 px-2">Auto</th>
              <th className="text-left py-2.5 px-2">Placa</th>
              <th className="text-left py-2.5 px-2">ID Auto</th>
              <th className="text-right py-2.5 px-2">Km Ant.</th>
              <th className="text-right py-2.5 px-2">Km Nuevo</th>
              <th className="text-right py-2.5 px-2">Renta</th>
              <th className="text-right py-2.5 px-2">Pendiente</th>
              <th className="text-center py-2.5 px-2">Stats</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 4 }).map((_, i) => (
              <tr key={i} className="border-b border-border/20">
                <td className="py-3 px-2"><Skeleton className="h-4 w-28" /></td>
                <td className="py-3 px-2"><Skeleton className="h-3 w-24" /></td>
                <td className="py-3 px-2"><Skeleton className="h-3 w-16" /></td>
                <td className="py-3 px-2"><Skeleton className="h-3 w-12 font-mono" /></td>
                <td className="py-3 px-2 text-right"><Skeleton className="h-3 w-12 ml-auto" /></td>
                <td className="py-3 px-2 text-right"><Skeleton className="h-3 w-12 ml-auto" /></td>
                <td className="py-3 px-2 text-right"><Skeleton className="h-3 w-14 ml-auto" /></td>
                <td className="py-3 px-2 text-right"><Skeleton className="h-3 w-14 ml-auto" /></td>
                <td className="py-3 px-2 text-center"><Skeleton className="w-7 h-7 rounded-md mx-auto" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
