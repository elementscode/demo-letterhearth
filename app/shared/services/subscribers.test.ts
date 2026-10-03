import { test, assert, equal, errorf, session, sql, ValidationError } from "@elements/app";
import {
  cancelSubscription,
  consumeSigninToken,
  expireCompPlans,
  requestSigninLink,
  resubscribeByToken,
  resumeSubscription,
  setEmailsEnabled,
  statsOf,
  subscribe,
  SubscriberRow,
  unsubscribeByToken,
  unsubscribeHeaders,
} from "#app/shared/services/subscribers";
import { unique } from "#app/shared/testing/fixtures";

function row(plan: "free" | "paid", emailsEnabled = true): SubscriberRow {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date(),
    email: "x@test.dev",
    plan,
    emailsEnabled,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: null,
  };
}

function compPaid(email: string) {
  return sql<{ id: string; email: string; unsubscribeToken: string }>(`
    insert into subscribers (email, plan, subscriptionStatus, currentPeriodEnd)
    values (${unique(email)}, 'paid', 'active', now() + interval '10 days')
    returning id, email, unsubscribeToken
  `).firstOrThrow();
}

test("subscribers", () => {
  test("stats count free readers who take email, paid readers, and revenue", () => {
    let stats = statsOf([row("free"), row("free"), row("free", false), row("paid"), row("paid", false)]);

    equal(stats, { free: 2, paid: 2, monthlyRevenueCents: 1600 });
  });

  test("a free subscribe adds the reader and signs them in", async () => {
    let address = unique("New.Reader@Test.dev");
    let result = await subscribe(`  ${address} `, "free");

    equal(result.status, "subscribed");
    equal(session.get("role"), "reader");

    let saved = sql<{ id: string; email: string; plan: string }>(
      `select id, email, plan from subscribers where email = ${address.toLowerCase()}`,
    ).firstOrThrow();
    equal({ email: saved.email, plan: saved.plan }, { email: address.toLowerCase(), plan: "free" });

    let welcome = sql(
      `select 1 from elements.jobs where path like '%SendWelcomeJob' and fields->>'subscriberId' = ${saved.id}`,
    ).all();
    equal(welcome.length, 1);
  });

  test("an address already on the list gets a link, not a session", async () => {
    let taken = sql<{ id: string; email: string }>(
      `insert into subscribers (email) values (${unique("taken@test.dev")}) returning id, email`,
    ).firstOrThrow();

    let result = await subscribe(taken.email, "free");

    equal(result.status, "check-inbox");
    assert(!session.isLoggedIn(), "a stranger was signed in as someone else");
    equal(sql(`select 1 from signinTokens where subscriberId = ${taken.id}`).all().length, 1);
  });

  test("a bad address is refused", async () => {
    try {
      await subscribe("not-an-email", "free");
      errorf("subscribed a bad address");
    } catch (err) {
      assert(err instanceof ValidationError, `got ${err}`);
    }
  });

  test("the unsubscribe link turns email off, and undo turns it back on", () => {
    let sub = compPaid("u@test.dev");

    let saved = () =>
      sql<{ emailsEnabled: boolean; plan: string }>(
        `select emailsEnabled, plan from subscribers where id = ${sub.id}`,
      ).firstOrThrow();

    equal(unsubscribeByToken(sub.unsubscribeToken)?.email, sub.email);
    equal(saved().emailsEnabled, false);
    equal(saved().plan, "paid", "unsubscribing keeps the plan");

    assert(resubscribeByToken(sub.unsubscribeToken));
    equal(saved().emailsEnabled, true);

    equal(unsubscribeByToken("not-a-token"), undefined);
  });

  test("every email carries one-click unsubscribe headers", () => {
    let headers = unsubscribeHeaders({ unsubscribeToken: "abc" });

    assert(headers["List-Unsubscribe"].includes("/unsubscribe/abc"));
    equal(headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
  });

  test("a sign-in link works once", () => {
    let sub = sql<{ id: string; email: string }>(
      `insert into subscribers (email) values (${unique("link@test.dev")}) returning id, email`,
    ).firstOrThrow();
    requestSigninLink(sub.email);

    let token = sql<{ token: string }>(`select token from signinTokens where subscriberId = ${sub.id}`).firstOrThrow().token;

    assert(consumeSigninToken(token));
    equal(session.get("userName"), sub.email);
    assert(!consumeSigninToken(token), "a used link signed in again");
  });

  test("a complimentary plan cancels at the end of its period", async () => {
    let sub = compPaid("comp@test.dev");
    session.login({ userId: sub.id, userName: sub.email, role: "reader" });

    let view = await cancelSubscription();
    assert(view.cancelAtPeriodEnd);
    equal(view.plan, "paid", "access lasts until the period ends");

    view = await resumeSubscription();
    assert(!view.cancelAtPeriodEnd);

    await cancelSubscription();
    equal(expireCompPlans(), 0, "the period has not ended yet");

    sql(`update subscribers set currentPeriodEnd = now() - interval '1 minute' where id = ${sub.id}`);
    equal(expireCompPlans(), 1);
    equal(sql<{ plan: string }>(`select plan from subscribers where id = ${sub.id}`).firstOrThrow().plan, "free");
  });

  test("a reader can turn their own email off", () => {
    let sub = compPaid("me@test.dev");
    session.login({ userId: sub.id, userName: sub.email, role: "reader" });

    equal(setEmailsEnabled(false).emailsEnabled, false);
    equal(setEmailsEnabled(true).emailsEnabled, true);
  });
});
