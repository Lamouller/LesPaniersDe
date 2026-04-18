-- ============================================================
-- Migration 0004 : Données de démonstration
-- ============================================================
-- Note : aucun compte utilisateur ici (créés via auth Supabase)
-- UUIDs fixes pour reproductibilité des seeds

-- ============================================================
-- Entité : Open Space Antislash
-- ============================================================
INSERT INTO public.entities (
  id,
  name,
  slug,
  description,
  address,
  pickup_address,
  pickup_lat,
  pickup_lng,
  pickup_instructions,
  timezone,
  contact_email,
  contact_phone,
  is_active,
  created_at,
  updated_at
) VALUES (
  '11111111-0000-0000-0000-000000000001',
  'Open Space Antislash',
  'open-space-antislash',
  'Espace de coworking parisien, communauté tech & créatifs.',
  '12 Rue de la République, 75011 Paris',
  'Salle café, rez-de-chaussée — sonner à "Antislash"',
  48.8566,  -- latitude Paris fictive
  2.3522,   -- longitude Paris fictive
  'Récupérer votre panier le samedi entre 10h et 12h à l''accueil.',
  'Europe/Paris',
  'bonjour@antislash.studio',
  '+33 1 23 45 67 89',
  true,
  timezone('UTC', now()),
  timezone('UTC', now())
);

-- ============================================================
-- Producteur : Les Paniers de Nadine
-- (sans user_id car pas de compte auth dans le seed)
-- ============================================================
INSERT INTO public.producers (
  id,
  user_id,
  name,
  slug,
  bio,
  photo_url,
  contact_email,
  contact_phone,
  default_order_deadline_hours,
  payment_reminder_days,
  payment_block_days,
  whatsapp_enabled,
  default_pickup_entity_id,
  is_active,
  created_at,
  updated_at
) VALUES (
  '22222222-0000-0000-0000-000000000001',
  NULL,  -- compte auth créé séparément
  'Les Paniers de Nadine',
  'les-paniers-de-nadine',
  'Maraîchère en Île-de-France depuis 12 ans. Légumes de saison cultivés en agriculture raisonnée, récoltés le matin même de la livraison.',
  'https://placehold.co/400x400/4ade80/ffffff?text=Nadine',
  'nadine@lespaniersdenadine.fr',
  '+33 6 12 34 56 78',
  48,   -- deadline 48h avant livraison
  3,    -- relance à 3 jours
  7,    -- blocage à 7 jours
  false,
  '11111111-0000-0000-0000-000000000001',
  true,
  timezone('UTC', now()),
  timezone('UTC', now())
);

-- ============================================================
-- Lien producteur ↔ entité
-- Livraison le samedi (delivery_day=6), 10h-12h
-- ============================================================
INSERT INTO public.producer_entities (
  producer_id,
  entity_id,
  delivery_day,
  time_from,
  time_to,
  is_active,
  created_at
) VALUES (
  '22222222-0000-0000-0000-000000000001',
  '11111111-0000-0000-0000-000000000001',
  6,         -- samedi
  '10:00',
  '12:00',
  true,
  timezone('UTC', now())
);

-- ============================================================
-- Produits : 5 références
-- ============================================================
-- Panier S — 15 €
INSERT INTO public.products (id, producer_id, kind, size, name, description, unit_price_cents, is_active, created_at, updated_at)
VALUES (
  '33333333-0000-0000-0000-000000000001',
  '22222222-0000-0000-0000-000000000001',
  'basket', 'S',
  'Panier S — Petit appétit',
  'Idéal pour 1 à 2 personnes. Environ 4-5 variétés de légumes de saison.',
  1500, true,
  timezone('UTC', now()), timezone('UTC', now())
);

-- Panier M — 22 €
INSERT INTO public.products (id, producer_id, kind, size, name, description, unit_price_cents, is_active, created_at, updated_at)
VALUES (
  '33333333-0000-0000-0000-000000000002',
  '22222222-0000-0000-0000-000000000001',
  'basket', 'M',
  'Panier M — Famille standard',
  'Pour 2 à 3 personnes. Environ 6-7 variétés, toujours une surprise de saison.',
  2200, true,
  timezone('UTC', now()), timezone('UTC', now())
);

-- Panier L — 30 €
INSERT INTO public.products (id, producer_id, kind, size, name, description, unit_price_cents, is_active, created_at, updated_at)
VALUES (
  '33333333-0000-0000-0000-000000000003',
  '22222222-0000-0000-0000-000000000001',
  'basket', 'L',
  'Panier L — Grande famille',
  'Pour 4 à 5 personnes. Assortiment complet de la semaine.',
  3000, true,
  timezone('UTC', now()), timezone('UTC', now())
);

-- Option fruits — 5 €
INSERT INTO public.products (id, producer_id, kind, size, name, description, unit_price_cents, is_active, created_at, updated_at)
VALUES (
  '33333333-0000-0000-0000-000000000004',
  '22222222-0000-0000-0000-000000000001',
  'fruit_option', NULL,
  'Option fruits de saison',
  'Petit sachet de fruits de saison en provenance de producteurs partenaires.',
  500, true,
  timezone('UTC', now()), timezone('UTC', now())
);

-- Option 6 œufs — 3 €
INSERT INTO public.products (id, producer_id, kind, size, name, description, unit_price_cents, is_active, created_at, updated_at)
VALUES (
  '33333333-0000-0000-0000-000000000005',
  '22222222-0000-0000-0000-000000000001',
  'egg_option', NULL,
  'Option 6 œufs fermiers',
  '6 œufs de poules élevées en plein air, non traités.',
  300, true,
  timezone('UTC', now()), timezone('UTC', now())
);

-- ============================================================
-- Catalogue hebdomadaire : semaine courante
-- week_start = prochain lundi, deadline jeudi 20h, livraison samedi
-- ============================================================
INSERT INTO public.weekly_catalogs (
  id,
  producer_id,
  week_start,
  order_deadline_at,
  delivery_date,
  status,
  max_orders,
  basket_composition,
  notes,
  created_at,
  updated_at
) VALUES (
  '44444444-0000-0000-0000-000000000001',
  '22222222-0000-0000-0000-000000000001',
  -- Prochain lundi (date_trunc + 7 jours si on est déjà après lundi)
  date_trunc('week', timezone('UTC', now())::date + 7)::date,
  -- Deadline : jeudi 20h de la même semaine
  date_trunc('week', timezone('UTC', now())::date + 7)::date + interval '3 days 20 hours',
  -- Livraison : samedi de la même semaine
  date_trunc('week', timezone('UTC', now())::date + 7)::date + 5,
  'open',
  40,  -- max 40 commandes
  -- Composition du panier de la semaine
  '[
    {"name": "Courgettes",       "qty": 3,   "unit": "pièces"},
    {"name": "Tomates cerises",  "qty": 250, "unit": "g"},
    {"name": "Carottes",         "qty": 4,   "unit": "pièces"},
    {"name": "Salade batavia",   "qty": 1,   "unit": "pièce"},
    {"name": "Haricots verts",   "qty": 300, "unit": "g"},
    {"name": "Betteraves rouges","qty": 2,   "unit": "pièces"}
  ]'::jsonb,
  'Superbe semaine pour les légumes d''été ! Profitez des tomates cerises qui sont au top.',
  timezone('UTC', now()),
  timezone('UTC', now())
);

-- ============================================================
-- Produits disponibles dans ce catalogue
-- ============================================================
INSERT INTO public.weekly_catalog_products (weekly_catalog_id, product_id, price_snapshot_cents, stock, is_available)
VALUES
  ('44444444-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', 1500, 15, true),
  ('44444444-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000002', 2200, 20, true),
  ('44444444-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000003', 3000,  5, true),
  ('44444444-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000004',  500, 30, true),
  ('44444444-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000005',  300, 50, true);
