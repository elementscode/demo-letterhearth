-- add newsletter

-- Auto-update updatedAt on row changes.
create or replace function touchUpdatedAt()
returns trigger
language plpgsql
as $$
begin
  new.updatedAt = now();
  return new;
end;
$$;

-- The writer. One admin account signs in with a password.
create table users (
  id uuid primary key default uuidGenerateV7(),
  createdAt timestamptz not null default now(),
  updatedAt timestamptz not null default now(),
  email text not null unique,
  name text not null,
  passwordHash text not null
);

create trigger usersTouchUpdatedAt
  before update on users
  for each row execute function touchUpdatedAt();

-- Readers. plan is what they can read; emailsEnabled is whether they get mail.
-- A paid reader who unsubscribes from email keeps reading on the web.
create table subscribers (
  id uuid primary key default uuidGenerateV7(),
  createdAt timestamptz not null default now(),
  updatedAt timestamptz not null default now(),
  email text not null unique,
  plan text not null default 'free' check (plan in ('free', 'paid')),
  emailsEnabled boolean not null default true,
  unsubscribeToken uuid not null unique default gen_random_uuid(),
  stripeCustomerId text,
  stripeSubscriptionId text unique,
  subscriptionStatus text,
  currentPeriodEnd timestamptz,
  cancelAtPeriodEnd boolean not null default false,
  paidSince timestamptz
);

create trigger subscribersTouchUpdatedAt
  before update on subscribers
  for each row execute function touchUpdatedAt();

-- Every write to subscribers reaches the writer's dashboard, whichever path
-- made it: a subscribe rpc, a Stripe webhook, an unsubscribe link, psql.
create or replace function subscribersNotify() returns trigger
language plpgsql as $$
declare
  r record;
begin
  r := coalesce(new, old);

  perform pg_notify(channel_name('subscribers'), json_build_object(
    'op', lower(tg_op),
    'data', json_build_object(
      'id', r.id,
      'createdAt', json_build_object('$type', 'Date', '$value', (extract(epoch from r.createdAt) * 1000)::bigint),
      'email', r.email,
      'plan', r.plan,
      'emailsEnabled', r.emailsEnabled,
      'cancelAtPeriodEnd', r.cancelAtPeriodEnd,
      'currentPeriodEnd', case when r.currentPeriodEnd is null then null
        else json_build_object('$type', 'Date', '$value', (extract(epoch from r.currentPeriodEnd) * 1000)::bigint) end
    )
  )::text);

  return r;
end;
$$;

create trigger subscribersNotifyTrigger
  after insert or update or delete on subscribers
  for each row execute function subscribersNotify();

-- Posts. publishAt null is a draft; a future publishAt is scheduled. sentAt is
-- set once, when the post's emails are queued, so a post is never sent twice.
create table posts (
  id uuid primary key default uuidGenerateV7(),
  createdAt timestamptz not null default now(),
  updatedAt timestamptz not null default now(),
  title text not null,
  slug text not null unique,
  body text not null default '',
  access text not null default 'free' check (access in ('free', 'paid')),
  publishAt timestamptz,
  sentAt timestamptz,
  recipientCount integer not null default 0
);

create index postsPublishAtIdx on posts (publishAt desc nulls last);

create trigger postsTouchUpdatedAt
  before update on posts
  for each row execute function touchUpdatedAt();

-- Emailed sign-in links for readers, who have no password.
create table signinTokens (
  id uuid primary key default uuidGenerateV7(),
  createdAt timestamptz not null default now(),
  updatedAt timestamptz not null default now(),
  token uuid not null unique default gen_random_uuid(),
  subscriberId uuid not null references subscribers (id) on delete cascade,
  expiresAt timestamptz not null default now() + interval '1 hour',
  usedAt timestamptz
);

create trigger signinTokensTouchUpdatedAt
  before update on signinTokens
  for each row execute function touchUpdatedAt();

-- The webhook endpoints the app registers with Stripe in production, one per
-- url it has served from, with the signing secret Stripe returns only once.
create table stripeWebhooks (
  url text primary key,
  createdAt timestamptz not null default now(),
  updatedAt timestamptz not null default now(),
  endpointId text not null,
  secret text not null
);

create trigger stripeWebhooksTouchUpdatedAt
  before update on stripeWebhooks
  for each row execute function touchUpdatedAt();
