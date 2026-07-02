import { Skeleton } from "./skeleton";
import { Card } from "./card";

/**
 * Skeleton that mirrors the iOS-style driver card used in DriversSlice:
 * a 14×14 avatar, a name line and a CURP line. Render a stack of these
 * while the drivers list is loading.
 */
export function DriverCardSkeleton() {
  return (
    <Card className="border border-border bg-card/40 rounded-[20px] p-3.5 flex items-center gap-4">
      <Skeleton className="w-14 h-14 rounded-[14px] shrink-0" />
      <div className="flex-1 space-y-2 min-w-0">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </Card>
  );
}

export function DriversListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-label="Cargando conductores">
      {Array.from({ length: count }).map((_, i) => (
        <DriverCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Skeleton that mirrors the vehicle row in VehiclesSlice: a square icon
 * tile, a title line, two secondary lines and a right-aligned plate badge.
 */
export function VehicleCardSkeleton() {
  return (
    <Card className="border border-border bg-card/40 rounded-2xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
          <div className="space-y-2 flex-1 min-w-0">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
        <Skeleton className="h-7 w-20 rounded-lg shrink-0" />
      </div>
    </Card>
  );
}

export function VehiclesListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-label="Cargando vehículos">
      {Array.from({ length: count }).map((_, i) => (
        <VehicleCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Skeleton that mirrors the rental/account row in FinancesSlice: a name,
 * a date and a status badge with the debt amount.
 */
export function FinanceCardSkeleton() {
  return (
    <Card className="border border-border bg-card/40 rounded-2xl p-4 flex items-center justify-between gap-3">
      <div className="space-y-2 flex-1 min-w-0">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <div className="space-y-1.5 text-right shrink-0">
        <Skeleton className="h-5 w-16 rounded-md" />
        <Skeleton className="h-4 w-20" />
      </div>
    </Card>
  );
}

export function FinancesListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-label="Cargando finanzas">
      {Array.from({ length: count }).map((_, i) => (
        <FinanceCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Skeleton for the Dashboard hero KPIs. */
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-2 border border-border bg-card rounded-2xl p-5 space-y-5">
          <div className="flex justify-between">
            <div className="space-y-2">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-6 w-20 rounded-md" />
          </div>
          <div className="flex items-end gap-6">
            <Skeleton className="h-12 w-24" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-border/40">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-6 w-16" />
              </div>
            ))}
          </div>
        </Card>
        <Card className="border border-border bg-card rounded-2xl p-5 space-y-3">
          <div className="flex justify-between">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-4 w-4 rounded-full" />
          </div>
          <Skeleton className="h-12 w-20" />
          <div className="space-y-2">
            <Skeleton className="h-1.5 w-full rounded-full" />
            <Skeleton className="h-3 w-40" />
          </div>
        </Card>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
