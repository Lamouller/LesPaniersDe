-- Bucket public pour les photos produits
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('products', 'products', true, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true;

-- Policy : upload autorisé au producer connecté (sur son dossier)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'producer_own_folder_upload' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "producer_own_folder_upload" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'products'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'products_public_read' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "products_public_read" ON storage.objects
    FOR SELECT USING (bucket_id = 'products');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'producer_own_folder_delete' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "producer_own_folder_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (
      bucket_id = 'products'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;
END $$;
