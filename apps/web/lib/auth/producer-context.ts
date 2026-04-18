import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export type ProducerContext = {
  producerId: string | null;
  producerName: string | null;
  isViewAs: boolean;   // true si admin en mode observation
  isReadOnly: boolean; // isViewAs OU role pas producer
  role: 'admin' | 'producer' | 'client' | null;
};

export async function getProducerContext(): Promise<ProducerContext> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { producerId: null, producerName: null, isViewAs: false, isReadOnly: true, role: null };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const role = (profile?.role as 'admin' | 'producer' | 'client' | undefined) ?? null;

  if (role === 'producer') {
    const { data: prod } = await supabase
      .from('producers')
      .select('id, name')
      .eq('user_id', user.id)
      .single();
    return {
      producerId: prod?.id ?? null,
      producerName: prod?.name ?? null,
      isViewAs: false,
      isReadOnly: false,
      role,
    };
  }

  if (role === 'admin') {
    const cookieStore = await cookies();
    const viewAs = cookieStore.get('lpd-view-as-producer')?.value;
    if (!viewAs) {
      return { producerId: null, producerName: null, isViewAs: false, isReadOnly: true, role };
    }
    const { data: prod } = await supabase
      .from('producers')
      .select('id, name')
      .eq('id', viewAs)
      .single();
    return {
      producerId: prod?.id ?? null,
      producerName: prod?.name ?? null,
      isViewAs: true,
      isReadOnly: true,
      role,
    };
  }

  return { producerId: null, producerName: null, isViewAs: false, isReadOnly: true, role };
}
