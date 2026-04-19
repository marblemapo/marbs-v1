-- Newsletter subscribers for the marbs.io "notebook"
CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ
);

CREATE INDEX idx_newsletter_subscribers_email ON public.newsletter_subscribers(email);

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Anyone can subscribe (anon or authenticated).
-- INSERT-only — no SELECT/UPDATE/DELETE policies, so emails cannot be read by clients.
CREATE POLICY "Anyone can subscribe"
  ON public.newsletter_subscribers FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    email IS NOT NULL
    AND email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  );
