import { test, assert, equal, sql, AuthError } from "@elements/app";
import { fakeRequest, fakeResponse, signInReader, signInWriter, throws, unique } from "#app/shared/testing/fixtures";
import route from "./index";

test("post editor", () => {
  test("is for the writer only", async () => {
    assert(await throws(() => route(fakeRequest({ id: "new" }), fakeResponse), AuthError));
  });

  test("a new post starts empty, with the audience it would reach", () => {
    signInWriter();

    let before = (route(fakeRequest({ id: "new" }), fakeResponse) as any).attrs.audience;

    sql(`insert into subscribers (email, plan) values (${unique("f@test.dev")}, 'free'), (${unique("p@test.dev")}, 'paid')`);
    sql(`insert into subscribers (email, plan, emailsEnabled) values (${unique("off@test.dev")}, 'free', false)`);

    let page = (route(fakeRequest({ id: "new" }), fakeResponse) as any).attrs;

    equal(page.post, null);
    equal(page.audience, { paid: before.paid + 1, free: before.free + 1 });
  });
});
