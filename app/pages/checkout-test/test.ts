import { test, assert, equal, sql, AuthError, ForbiddenError, NotFoundError, ValidationError } from "@elements/app";
import { testCheckout } from "#app/shared/stripe";
import { fakeRequest, fakeResponse, signInReader, throws } from "#app/shared/testing/fixtures";
import {
  cancelSubscription,
  currentSubscriber,
  expireCompPlans,
  payTestCheckout,
  startUpgrade,
  subscribe,
} from "#app/shared/services/subscribers";
import route from "./index";

function subscriberRow(email: string) {
  return sql<{
    plan: string;
    stripeSubscriptionId: string | null;
    subscriptionStatus: string | null;
    currentPeriodEnd: Date | null;
    paidSince: Date | null;
  }>(`
    select plan, stripeSubscriptionId, subscriptionStatus, currentPeriodEnd, paidSince
    from subscribers
    where email = ${email}
  `).firstOrThrow();
}

function paidWelcomes(): number {
  return sql(`select 1 from elements.jobs where path like '%SendWelcomeJob' and (fields->>'paid')::boolean`).all().length;
}

test("test checkout", () => {
  // Tests read development.env, so once the owner adds a Stripe key the
  // test checkout is off and payments go to Stripe instead.
  if (!testCheckout()) {
    test("is off once a Stripe key is set", async () => {
      signInReader("off@test.dev", "free");

      assert(await throws(() => route(fakeRequest(), fakeResponse), NotFoundError), "the page still opened");
      assert(await throws(() => payTestCheckout(), ForbiddenError), "the test payment went through");
    });

    return;
  }

  test("a new paid subscriber goes to the test checkout and pays", async () => {
    let result = await subscribe("pay@test.dev", "paid");

    equal(result, { status: "checkout", url: "/checkout/test" });

    let page = (route(fakeRequest(), fakeResponse) as any).attrs;
    equal(page.email, "pay@test.dev");

    payTestCheckout();

    let row = subscriberRow("pay@test.dev");
    equal(row.plan, "paid");
    equal(row.subscriptionStatus, "active");
    assert(row.stripeSubscriptionId?.startsWith("test_"), `got ${row.stripeSubscriptionId}`);
    assert(row.currentPeriodEnd! > new Date(Date.now() + 27 * 86_400_000), "the period should run a month");
    assert(row.paidSince !== null, "paidSince was not stamped");
    equal(paidWelcomes(), 1, "the paid welcome goes out once");
  });

  test("a free reader upgrades through the test checkout", async () => {
    signInReader("up@test.dev", "free");

    equal(await startUpgrade(), "/checkout/test");

    payTestCheckout();

    equal(currentSubscriber()!.plan, "paid");
    equal(paidWelcomes(), 1);
  });

  test("a test subscription cancels in the app and ends with its period", async () => {
    signInReader("end@test.dev", "free");
    payTestCheckout();

    let view = await cancelSubscription();
    assert(view.cancelAtPeriodEnd);
    equal(view.plan, "paid", "access lasts until the period ends");

    sql(`update subscribers set currentPeriodEnd = now() - interval '1 minute' where email = 'end@test.dev'`);
    equal(expireCompPlans(), 1);
    equal(subscriberRow("end@test.dev").plan, "free");
  });

  test("refuses a visitor and a reader who already pays", async () => {
    assert(await throws(() => payTestCheckout(), AuthError), "a visitor paid");

    signInReader("paid@test.dev", "paid");
    assert(await throws(() => payTestCheckout(), ValidationError), "a paid reader paid twice");
  });
});
