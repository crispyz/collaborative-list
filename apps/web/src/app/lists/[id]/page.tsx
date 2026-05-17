import { ListPage } from '@/components/list-page';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ListPage id={id} />;
}
