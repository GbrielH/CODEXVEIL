import { Skeleton } from '@/components/ui/states';

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true" aria-label="Carregando o painel">
      <div className="flex flex-col gap-3 border-b border-line pb-6">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-40" />
        ))}
      </div>
    </div>
  );
}
