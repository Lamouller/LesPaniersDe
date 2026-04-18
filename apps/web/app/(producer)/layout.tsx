import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import ProducerLayoutInner from './ProducerLayoutInner';

export default async function ProducerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  return (
    <ProducerLayoutInner email={user.email ?? ''} role={profile?.role ?? 'producer'}>
      {children}
    </ProducerLayoutInner>
  );
}
