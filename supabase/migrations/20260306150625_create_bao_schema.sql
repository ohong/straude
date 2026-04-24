
-- Bao: Gift shares as digital red envelopes
-- Profiles table for Bao users
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Gifts table
CREATE TABLE IF NOT EXISTS gifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES profiles(id),
  recipient_id UUID REFERENCES profiles(id),
  claim_code TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN ('pending_payment', 'funded', 'sent', 'opened', 'claimed', 'expired')),
  stock_symbol TEXT NOT NULL,
  stock_name TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  share_qty NUMERIC,
  purchase_price_cents INTEGER,
  message TEXT,
  envelope_design TEXT NOT NULL DEFAULT 'classic',
  stripe_payment_intent_id TEXT,
  fee_cents INTEGER NOT NULL DEFAULT 0,
  alpaca_order_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  funded_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  claimed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

-- Thank yous table
CREATE TABLE IF NOT EXISTS thank_yous (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_id UUID NOT NULL REFERENCES gifts(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gifts_claim_code ON gifts(claim_code);
CREATE INDEX IF NOT EXISTS idx_gifts_sender ON gifts(sender_id);
CREATE INDEX IF NOT EXISTS idx_gifts_recipient ON gifts(recipient_id);
CREATE INDEX IF NOT EXISTS idx_gifts_status ON gifts(status);

-- Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE thank_yous ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Gifts policies
CREATE POLICY "Senders can view own gifts" ON gifts FOR SELECT USING (auth.uid() = sender_id);
CREATE POLICY "Recipients can view claimed gifts" ON gifts FOR SELECT USING (auth.uid() = recipient_id);
CREATE POLICY "Senders can create gifts" ON gifts FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Service role can read all gifts" ON gifts FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "Service role can update all gifts" ON gifts FOR UPDATE USING (auth.role() = 'service_role');

-- Thank yous policies
CREATE POLICY "Thank you sender can create" ON thank_yous FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Involved parties can view thank yous" ON thank_yous FOR SELECT USING (
  auth.uid() IN (
    SELECT g.sender_id FROM gifts g WHERE g.id = gift_id
    UNION
    SELECT g.recipient_id FROM gifts g WHERE g.id = gift_id
  )
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.users (id, github_username, avatar_url, timezone)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'user_name',
    NEW.raw_user_meta_data ->> 'avatar_url',
    COALESCE(NEW.raw_user_meta_data ->> 'timezone', 'UTC')
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Drop trigger if it already exists (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created_bao ON auth.users;
CREATE TRIGGER on_auth_user_created_bao
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
;
