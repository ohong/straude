ALTER TABLE public.users ADD COLUMN referred_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
CREATE INDEX idx_users_referred_by ON public.users(referred_by) WHERE referred_by IS NOT NULL;

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('follow', 'kudos', 'comment', 'mention', 'message', 'referral'));
