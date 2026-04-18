import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface ForecastEntityRow {
  producer_id: string;
  entity_id: string;
  entity_name: string;
  week_start: string;
  confirmed_orders_count: number;
  projected_orders_count: number;
  total_cents: number;
}

interface ProducerRow {
  id: string;
  name: string;
}

function escapeCsv(value: string | number): string {
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCsvRow(cells: (string | number)[]): string {
  return cells.map(escapeCsv).join(',');
}

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();

    // Auth + role check
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });
    }

    // Fetch forecast by entity (all producers, N to N+4)
    const { data: rows, error } = await supabase
      .from('v_producer_forecast_by_entity')
      .select('*')
      .order('week_start', { ascending: true });

    if (error) {
      console.error('forecast/export error:', error);
      return NextResponse.json({ error: 'Erreur lors de la recuperation des donnees' }, { status: 500 });
    }

    const forecastRows = (rows ?? []) as ForecastEntityRow[];

    // Fetch producer names
    const producerIds = [...new Set(forecastRows.map((r) => r.producer_id))];
    const { data: producersData } = await supabase
      .from('producers')
      .select('id, name')
      .in('id', producerIds);

    const producerMap = ((producersData ?? []) as ProducerRow[]).reduce<Record<string, string>>(
      (acc, p) => {
        acc[p.id] = p.name;
        return acc;
      },
      {}
    );

    // Build CSV
    const header = buildCsvRow([
      'producer',
      'entity',
      'week_start',
      'confirmed_orders',
      'projected_orders',
      'confirmed_cents',
      'projected_cents',
      'total_cents',
    ]);

    const csvRows = forecastRows.map((row) =>
      buildCsvRow([
        producerMap[row.producer_id] ?? row.producer_id,
        row.entity_name,
        row.week_start,
        row.confirmed_orders_count,
        row.projected_orders_count,
        0,
        0,
        row.total_cents,
      ])
    );

    const csv = [header, ...csvRows].join('\n');

    const today = new Date().toISOString().slice(0, 10);

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename=forecast-${today}.csv`,
      },
    });
  } catch (err) {
    console.error('Unexpected error in /api/admin/forecast/export:', err);
    return NextResponse.json({ error: 'Erreur serveur inattendue' }, { status: 500 });
  }
}
