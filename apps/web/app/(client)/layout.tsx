import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import ClientLayoutInner from './ClientLayoutInner';

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
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
    <ClientLayoutInner email={user.email ?? ''} role={profile?.role ?? 'client'}>
      {children}
    </ClientLayoutInner>
  );
}
