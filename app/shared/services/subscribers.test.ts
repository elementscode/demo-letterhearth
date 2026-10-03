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
  return sql<{ id: string; unsubscribeToken: string }>(`
    insert into subscribers (email, plan, subscriptionStatus, currentPeriodEnd)
    values (${email}, 'paid', 'active', now() + interval '10 days')
    returning id, unsubscribeToken
  `).firstOrThrow();
}

test("subscribers", () => {
  test("stats count free readers who take email, paid readers, and revenue", () => {
    let stats = statsOf([row("free"), row("free"), row("free", false), row("paid"), row("paid", false)]);

    equal(stats, { free: 2, paid: 2, monthlyRevenueCents: 1600 });
  });

  test("a free subscribe adds the reader and signs them in", async () => {
    let result = await subscribe("  New.Reader@Test.dev ", "free");

    equal(result.status, "subscribed");
    equal(session.get("role"), "reader");

    let saved = sql<{ email: string; plan: string }>(`select email, plan from subscribers`).firstOrThrow();
    equal(saved, { email: "new.reader@test.dev", plan: "free" });

    let welcome = sql(`select 1 from elements.jobs where path like '%SendWelcomeJob'`).all();
    equal(welcome.length, 1);
  });

  test("an address already on the list gets a link, not a session", async () => {
    sql(`insert into subscribers (email) values ('taken@test.dev')`);

    let result = await subscribe("taken@test.dev", "free");

    equal(result.status, "check-inbox");
    assert(!session.isLoggedIn(), "a stranger was signed in as someone else");
    equal(sql(`select 1 from signinTokens`).all().length, 1);
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

    equal(unsubscribeByToken(sub.unsubscribeToken)?.email, "u@test.dev");
    equal(sql<{ emailsEnabled: boolean }>(`select emailsEnabled from subscribers`).firstOrThrow().emailsEnabled, false);
    equal(sql<{ plan: string }>(`select plan from subscribers`).firstOrThrow().plan, "paid", "unsubscribing keeps the plan");

    assert(resubscribeByToken(sub.unsubscribeToken));
    equal(sql<{ emailsEnabled: boolean }>(`select emailsEnabled from subscribers`).firstOrThrow().emailsEnabled, true);

    equal(unsubscribeByToken("not-a-token"), undefined);
  });

  test("every email carries one-click unsubscribe headers", () => {
    let headers = unsubscribeHeaders({ unsubscribeToken: "abc" });

    assert(headers["List-Unsubscribe"].includes("/unsubscribe/abc"));
    equal(headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
  });

  test("a sign-in link works once", () => {
    sql(`insert into subscribers (email) values ('link@test.dev')`);
    requestSigninLink("link@test.dev");

    let token = sql<{ token: string }>(`select token from signinTokens`).firstOrThrow().token;

    assert(consumeSigninToken(token));
    equal(session.get("userName"), "link@test.dev");
    assert(!consumeSigninToken(token), "a used link signed in again");
  });

  test("a complimentary plan cancels at the end of its period", async () => {
    let sub = compPaid("comp@test.dev");
    session.login({ userId: sub.id, userName: "comp@test.dev", role: "reader" });

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
    session.login({ userId: sub.id, userName: "me@test.dev", role: "reader" });

    equal(setEmailsEnabled(false).emailsEnabled, false);
    equal(setEmailsEnabled(true).emailsEnabled, true);
  });
});
