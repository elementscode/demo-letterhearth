import { test, equal, sql } from "@elements/app";
import { fakeRequest, fakeResponse, signInReader } from "#app/shared/testing/fixtures";
import route from "./index";

test("account page", () => {
  test("shows the reader their own plan", () => {
    signInReader("acct@test.dev", "paid");

    let page = (route(fakeRequest({}, { paid: "1" }), fakeResponse) as any).attrs;

    equal(page.initial.email, "acct@test.dev");
    equal(page.initial.plan, "paid");
    equal(page.initial.billedByStripe, false);
    equal(page.paidNotice, "paid");
  });

  test("says a payment is processing until the plan is paid", () => {
    signInReader("wait@test.dev", "free");

    let page = (route(fakeRequest({}, { paid: "1" }), fakeResponse) as any).attrs;

    equal(page.paidNotice, "processing");
  });
});
