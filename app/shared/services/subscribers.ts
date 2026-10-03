import Stripe from "stripe";
import {
  email,
  getAppUrl,
  session,
  sql,
  tx,
  AuthError,
  ForbiddenError,
  LiveTable,
  ValidationError,
} from "@elements/app";
import config from "#config";
import { stripe, testCheckout } from "#app/shared/stripe";
import { ensureWebhook } from "#app/shared/stripe-webhook";
import { SendWelcomeJob } from "#app/jobs/send-welcome";
import SigninLinkEmail from "#app/emails/signin-link";

export type Plan = "free" | "paid";

export interface Subscriber {
  id: string;
  createdAt: Date;
  email: string;
  plan: Plan;
  emailsEnabled: boolean;
  unsubscribeToken: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  subscriptionStatus: string | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  paidSince: Date | null;
}

/** One row of the writer's live subscriber list. */
export interface SubscriberRow {
  id: string;
  createdAt: Date;
  email: string;
  plan: Plan;
  emailsEnabled: boolean;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
}

/** What a reader sees of their own subscription on /account. */
export interface AccountView {
  email: string;
  plan: Plan;
  emailsEnabled: boolean;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
  billedByStripe: boolean;
}

export function accountView(subscriber: Subscriber): AccountView {
  return {
    email: subscriber.email,
    plan: subscriber.plan,
    emailsEnabled: subscriber.emailsEnabled,
    cancelAtPeriodEnd: subscriber.cancelAtPeriodEnd,
    currentPeriodEnd: subscriber.currentPeriodEnd,
    billedByStripe: subscriber.stripeSubscriptionId !== null,
  };
}

export interface SubscriberStats {
  free: number;
  paid: number;
  monthlyRevenueCents: number;
}

/**
 * The writer's live subscriber list. Nothing writes through it: every change
 * is made by an rpc or a webhook, and the trigger in the migration broadcasts
 * it on this channel.
 */
export let subscribers: LiveTable<SubscriberRow> = new LiveTable<SubscriberRow>({
  select: () => sql<SubscriberRow>(`
    select id, createdAt, email, plan, emailsEnabled, cancelAtPeriodEnd, currentPeriodEnd
    from subscribers
  `),
  insert: () => {
    throw new ForbiddenError();
  },
  update: () => {
    throw new ForbiddenError();
  },
  delete: () => {
    throw new ForbiddenError();
  },
});

/**
 * Free readers are the ones who still take email; a paid reader counts while
 * the plan lasts, whether or not they read by email.
 */
export function statsOf(rows: SubscriberRow[]): SubscriberStats {
  let paid = rows.filter((r) => r.plan === "paid").length;
  let free = rows.filter((r) => r.plan === "free" && r.emailsEnabled).length;

  return { free, paid, monthlyRevenueCents: paid * config.newsletter.priceCents };
}

export function normalizeEmail(address: string): string {
  return address.trim().toLowerCase();
}

export function isEmail(address: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address);
}

export function getSubscriber(id: string): Subscriber | undefined {
  return sql<Subscriber>(`
    select id, createdAt, email, plan, emailsEnabled, unsubscribeToken, stripeCustomerId,
      stripeSubscriptionId, subscriptionStatus, currentPeriodEnd, cancelAtPeriodEnd, paidSince
    from subscribers where id = ${id}
  `).first();
}

/** The signed-in reader, or undefined for a visitor or the writer. */
export function currentSubscriber(): Subscriber | undefined {
  if (!session.isLoggedIn() || session.get("role") !== "reader") {
    return undefined;
  }

  return getSubscriber(session.getOrThrow("userId"));
}

function currentSubscriberOrThrow(): Subscriber {
  let subscriber = currentSubscriber();

  if (!subscriber) {
    throw new AuthError("sign in to manage your subscription");
  }

  return subscriber;
}

export type SubscribeResult =
  | { status: "subscribed" }
  | { status: "checkout"; url: string }
  | { status: "check-inbox" }
  | { status: "already" };

/**
 * Subscribes an address. A new address is signed in on the spot. An address
 * already on the list gets a sign-in link instead, so typing someone else's
 * email never opens their account.
 *
 * @rpc
 */
export async function subscribe(address: string, plan: Plan): Promise<SubscribeResult> {
  let to = normalizeEmail(address);

  if (!isEmail(to)) {
    throw new ValidationError({ email: ["enter a valid email address"] });
  }

  if (session.get("role") === "writer") {
    throw new ValidationError("you're signed in as the writer; sign out to subscribe as a reader");
  }

  let existing = sql<Subscriber>(`select id, createdAt, email, plan, emailsEnabled, unsubscribeToken, stripeCustomerId,
      stripeSubscriptionId, subscriptionStatus, currentPeriodEnd, cancelAtPeriodEnd, paidSince from subscribers where email = ${to}`).first();

  if (existing) {
    if (session.get("userId") !== existing.id) {
      sendSigninLink(existing);
      return { status: "check-inbox" };
    }

    if (!existing.emailsEnabled) {
      sql(`update subscribers set emailsEnabled = true where id = ${existing.id}`);
    }

    if (plan === "paid" && existing.plan === "free") {
      return { status: "checkout", url: await startSubscriptionCheckout(existing) };
    }

    return { status: "already" };
  }

  let subscriber = tx(() => {
    let row = sql<Subscriber>(`
      insert into subscribers (email) values (${to})
      on conflict (email) do nothing
      returning id, createdAt, email, plan, emailsEnabled, unsubscribeToken, stripeCustomerId,
      stripeSubscriptionId, subscriptionStatus, currentPeriodEnd, cancelAtPeriodEnd, paidSince
    `).first();

    if (row) {
      new SendWelcomeJob({ subscriberId: row.id }).schedule();
    }

    return row;
  });

  if (!subscriber) {
    return { status: "check-inbox" };
  }

  session.login({ userId: subscriber.id, userName: subscriber.email, role: "reader" });

  if (plan === "paid") {
    return { status: "checkout", url: await startSubscriptionCheckout(subscriber) };
  }

  return { status: "subscribed" };
}

/** @rpc */
export async function startUpgrade(): Promise<string> {
  let subscriber = currentSubscriberOrThrow();

  if (subscriber.plan === "paid") {
    throw new ValidationError("you already have a paid subscription");
  }

  return await startSubscriptionCheckout(subscriber);
}

/** Returns the url to send the reader to: Stripe, or the test checkout. */
export async function startSubscriptionCheckout(subscriber: Subscriber): Promise<string> {
  if (testCheckout()) {
    return "/checkout/test";
  }

  await ensureWebhook();

  let checkout = await stripe().checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    ...(subscriber.stripeCustomerId
      ? { customer: subscriber.stripeCustomerId }
      : { customer_email: subscriber.email }),
    client_reference_id: subscriber.id,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: config.newsletter.priceCents,
        recurring: { interval: "month" },
        product_data: { name: `${config.newsletter.name} paid subscription` },
      },
    }],
    success_url: `${getAppUrl()}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${getAppUrl()}/account`,
  });

  return checkout.url!;
}

/**
 * Records a completed checkout. Idempotent: the return page and the webhook
 * both call it, in either order, any number of times.
 */
export async function fulfillCheckout(sessionId: string): Promise<boolean> {
  let checkout = await stripe().checkout.sessions.retrieve(sessionId);

  if (checkout.mode !== "subscription" || checkout.status !== "complete" || !checkout.client_reference_id) {
    return false;
  }

  await syncSubscription(checkout.subscription as string, checkout.client_reference_id);

  return true;
}

function isPaidStatus(status: string): boolean {
  return status === "active" || status === "trialing" || status === "past_due";
}

/** A subscription's state, from Stripe or from the test checkout. */
export interface SubscriptionState {
  id: string;
  customerId: string;
  status: string;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}

/**
 * Copies a Stripe subscription onto its subscriber. Only a caller that knows
 * the subscriber links a new subscription; a webhook for one the app has not
 * seen only updates.
 */
export async function syncSubscription(subscriptionId: string, subscriberId?: string) {
  let sub: Stripe.Subscription = await stripe().subscriptions.retrieve(subscriptionId);
  let periodEnd = sub.items.data[0]?.current_period_end;

  recordSubscription({
    id: sub.id,
    customerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    status: sub.status,
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
  }, subscriberId);
}

/**
 * The one place a subscription is recorded, real or test. Sets the plan, and
 * the first time a reader becomes paid, sends the paid welcome.
 */
export function recordSubscription(sub: SubscriptionState, subscriberId?: string) {
  let plan: Plan = isPaidStatus(sub.status) ? "paid" : "free";

  let rows = subscriberId
    ? sql<{ id: string }>(`
        update subscribers
           set stripeSubscriptionId = ${sub.id}, stripeCustomerId = ${sub.customerId},
               subscriptionStatus = ${sub.status}, currentPeriodEnd = ${sub.currentPeriodEnd},
               cancelAtPeriodEnd = ${sub.cancelAtPeriodEnd}, plan = ${plan},
               paidSince = case when ${plan} = 'paid' then paidSince end
         where id = ${subscriberId}
        returning id
      `).all()
    : sql<{ id: string }>(`
        update subscribers
           set subscriptionStatus = ${sub.status}, currentPeriodEnd = ${sub.currentPeriodEnd},
               cancelAtPeriodEnd = ${sub.cancelAtPeriodEnd}, plan = ${plan},
               paidSince = case when ${plan} = 'paid' then paidSince end
         where stripeSubscriptionId = ${sub.id}
        returning id
      `).all();

  for (let row of rows) {
    markPaidOnce(row.id);
  }
}

/**
 * Pays for the signed-in reader's plan on the test checkout. Development
 * without a Stripe key only; records through recordSubscription, as a real
 * payment does.
 *
 * @rpc
 */
export function payTestCheckout() {
  if (!testCheckout()) {
    throw new ForbiddenError("the test checkout is off");
  }

  let subscriber = currentSubscriberOrThrow();

  if (subscriber.plan === "paid") {
    throw new ValidationError("you already have a paid subscription");
  }

  let periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  recordSubscription({
    id: `test_${subscriber.id}`,
    customerId: `test_${subscriber.id}`,
    status: "active",
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: false,
  }, subscriber.id);
}

/** A subscription the test checkout made, with nothing behind it in Stripe. */
export function isTestSubscription(stripeSubscriptionId: string | null): boolean {
  return stripeSubscriptionId?.startsWith("test_") ?? false;
}

/**
 * Stamps paidSince the first time a subscriber becomes paid, and sends the
 * paid welcome then and only then.
 */
function markPaidOnce(subscriberId: string) {
  tx(() => {
    let first = sql<{ id: string }>(`
      update subscribers set paidSince = now()
       where id = ${subscriberId} and plan = 'paid' and paidSince is null
      returning id
    `).first();

    if (first) {
      new SendWelcomeJob({ subscriberId, paid: true }).schedule();
    }
  });
}

/**
 * Cancels at the end of the period, so the reader keeps what they paid for.
 * A complimentary plan (no Stripe subscription) ends the same way, when the
 * nightly job expires it.
 *
 * @rpc
 */
export async function cancelSubscription(): Promise<AccountView> {
  return await setCancelAtPeriodEnd(true);
}

/** @rpc */
export async function resumeSubscription(): Promise<AccountView> {
  return await setCancelAtPeriodEnd(false);
}

async function setCancelAtPeriodEnd(cancel: boolean): Promise<AccountView> {
  let subscriber = currentSubscriberOrThrow();

  if (subscriber.plan !== "paid") {
    throw new ValidationError("there is no paid subscription to change");
  }

  if (subscriber.stripeSubscriptionId && !isTestSubscription(subscriber.stripeSubscriptionId)) {
    await stripe().subscriptions.update(subscriber.stripeSubscriptionId, { cancel_at_period_end: cancel });
    await syncSubscription(subscriber.stripeSubscriptionId);
  } else {
    sql(`update subscribers set cancelAtPeriodEnd = ${cancel} where id = ${subscriber.id}`);
  }

  return accountView(getSubscriber(subscriber.id)!);
}

/**
 * Ends complimentary and test-checkout plans whose period is over, after a
 * cancel. Stripe ends its own.
 */
export function expireCompPlans(): number {
  return sql<{ id: string }>(`
    update subscribers
       set plan = 'free', subscriptionStatus = 'canceled', cancelAtPeriodEnd = false
     where plan = 'paid' and (stripeSubscriptionId is null or stripeSubscriptionId like 'test\_%')
       and cancelAtPeriodEnd and currentPeriodEnd <= now()
    returning id
  `).all().length;
}

/** @rpc */
export function setEmailsEnabled(enabled: boolean): AccountView {
  let subscriber = currentSubscriberOrThrow();

  sql(`update subscribers set emailsEnabled = ${enabled} where id = ${subscriber.id}`);

  return accountView(getSubscriber(subscriber.id)!);
}

/** Unsubscribes the owner of an unsubscribe token. Returns their address. */
export function unsubscribeByToken(token: string): { email: string; plan: Plan } | undefined {
  if (!isUuid(token)) {
    return undefined;
  }

  return sql<{ email: string; plan: Plan }>(`
    update subscribers set emailsEnabled = false
     where unsubscribeToken = ${token}
    returning email, plan
  `).first();
}

/** @rpc */
export function resubscribeByToken(token: string): boolean {
  if (!isUuid(token)) {
    return false;
  }

  return sql(`
    update subscribers set emailsEnabled = true where unsubscribeToken = ${token} returning id
  `).all().length > 0;
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function unsubscribeUrl(subscriber: { unsubscribeToken: string }): string {
  return `${getAppUrl()}/unsubscribe/${subscriber.unsubscribeToken}`;
}

/** The List-Unsubscribe headers mail clients turn into a one-click button. */
export function unsubscribeHeaders(subscriber: { unsubscribeToken: string }): Record<string, string> {
  return {
    "List-Unsubscribe": `<${unsubscribeUrl(subscriber)}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

function sendSigninLink(subscriber: Subscriber) {
  let row = sql<{ token: string }>(`
    insert into signinTokens (subscriberId) values (${subscriber.id}) returning token
  `).firstOrThrow();

  email({
    to: subscriber.email,
    subject: `Your ${config.newsletter.name} sign-in link`,
    body: new SigninLinkEmail({
      signinUrl: `/signin/${row.token}`,
      unsubscribeUrl: `/unsubscribe/${subscriber.unsubscribeToken}`,
    }),
    headers: unsubscribeHeaders(subscriber),
  });
}

/**
 * Emails a sign-in link. Says the same thing whether or not the address is
 * on the list.
 *
 * @rpc
 */
export function requestSigninLink(address: string) {
  let to = normalizeEmail(address);

  if (!isEmail(to)) {
    throw new ValidationError({ email: ["enter a valid email address"] });
  }

  let subscriber = sql<Subscriber>(`select id, createdAt, email, plan, emailsEnabled, unsubscribeToken, stripeCustomerId,
      stripeSubscriptionId, subscriptionStatus, currentPeriodEnd, cancelAtPeriodEnd, paidSince from subscribers where email = ${to}`).first();

  if (subscriber) {
    sendSigninLink(subscriber);
  }
}

/** Signs a reader in from an emailed link. Each link works once, for an hour. */
export function consumeSigninToken(token: string): boolean {
  if (!isUuid(token)) {
    return false;
  }

  let row = sql<{ subscriberId: string; email: string }>(`
    update signinTokens t set usedAt = now()
      from subscribers s
     where t.token = ${token} and t.usedAt is null and t.expiresAt > now() and s.id = t.subscriberId
    returning t.subscriberId, s.email
  `).first();

  if (!row) {
    return false;
  }

  session.login({ userId: row.subscriberId, userName: row.email, role: "reader" });

  return true;
}

export interface Audience {
  paid: number;
  free: number;
}

/** Who a post would be emailed to right now. */
export function audience(): Audience {
  return sql<Audience>(`
    select count(*) filter (where plan = 'paid')::int as paid,
           count(*) filter (where plan = 'free')::int as free
      from subscribers where emailsEnabled
  `).firstOrThrow();
}
