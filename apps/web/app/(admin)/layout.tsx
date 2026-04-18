import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AdminLayoutInner from './AdminLayoutInner';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
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
    <AdminLayoutInner email={user.email ?? ''} role={profile?.role ?? 'admin'}>
      {children}
    </AdminLayoutInner>
  );
}
