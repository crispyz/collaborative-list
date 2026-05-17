import Link from 'next/link';
import type { List } from '@collab/shared';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  list: List;
  todoCount: number;
}

export function ListCard({ list, todoCount }: Props) {
  return (
    <Link href={`/lists/${list.id}`} className="block">
      <Card className="h-full transition-colors hover:bg-accent">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <CardTitle className="truncate text-base">{list.name}</CardTitle>
          {list.isFrozen && <Badge variant="secondary">Frozen</Badge>}
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {todoCount} {todoCount === 1 ? 'item' : 'items'}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
