
CREATE TABLE public.promos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  reward_points bigint NOT NULL DEFAULT 50,
  max_claims integer NOT NULL DEFAULT 100,
  total_claimed integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.promo_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_id uuid NOT NULL REFERENCES public.promos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  claimed_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(promo_id, user_id)
);

ALTER TABLE public.promos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "open_promos" ON public.promos FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "open_promo_claims" ON public.promo_claims FOR ALL TO public USING (true) WITH CHECK (true);
