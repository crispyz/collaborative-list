'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export type FilterValue = 'all' | 'active' | 'done';

interface Props {
  current: FilterValue;
}

export function FilterTabs({ current }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all') params.delete('filter');
    else params.set('filter', value);
    const qs = params.toString();
    router.replace((qs ? `${pathname}?${qs}` : pathname) as never, { scroll: false });
  }

  return (
    <Tabs value={current} onValueChange={handleChange}>
      <TabsList>
        <TabsTrigger value="all">All</TabsTrigger>
        <TabsTrigger value="active">Active</TabsTrigger>
        <TabsTrigger value="done">Done</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
