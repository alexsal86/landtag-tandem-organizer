import { Newspaper } from 'lucide-react';
import { NewsWidget } from '@/components/widgets/NewsWidget';

export default function NewsPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
      <h1 className="flex items-center gap-2 text-2xl font-semibold">
        <Newspaper className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        News
      </h1>
      <NewsWidget />
    </div>
  );
}
