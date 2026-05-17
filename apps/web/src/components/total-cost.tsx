import type { TodoItem } from '@collab/shared';
import { formatCents } from '@/lib/money';
import type { FilterValue } from '@/components/filter-tabs';

interface Props {
  todos: TodoItem[];
  visible: TodoItem[];
  filter: FilterValue;
}

function sumCents(todos: TodoItem[]): number {
  return todos.reduce((acc, t) => acc + (t.priceCents ?? 0), 0);
}

export function TotalCost({ todos, visible, filter }: Props) {
  if (filter === 'all') {
    return (
      <div className="text-sm">
        Total: <span className="font-semibold tabular-nums">{formatCents(sumCents(todos))}</span>
      </div>
    );
  }
  return (
    <div className="text-right text-sm">
      <div>
        Visible:{' '}
        <span className="font-semibold tabular-nums">{formatCents(sumCents(visible))}</span>
      </div>
      <div className="text-muted-foreground">
        All: <span className="tabular-nums">{formatCents(sumCents(todos))}</span>
      </div>
    </div>
  );
}
