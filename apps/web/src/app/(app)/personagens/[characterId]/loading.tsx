import { Skeleton } from '@/components/ui/states';

export default function CharacterSheetLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Carregando a ficha">
      <Skeleton className="h-4 w-32" />
      <div className="flex items-center gap-4">
        <Skeleton className="h-28 w-24 rounded-t-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-8 w-64 max-w-full" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      <Skeleton className="h-11 w-full" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
      </div>
    </div>
  );
}
