import { test, assert, equal, sql, AuthError } from "@elements/app";
import { fakeRequest, fakeResponse, signInReader, signInWriter, throws } from "#app/shared/testing/fixtures";
import route from "./index";

test("post editor", () => {
  test("is for the writer only", async () => {
    assert(await throws(() => route(fakeRequest({ id: "new" }), fakeResponse), AuthError));
  });

  test("a new post starts empty, with the audience it would reach", () => {
    signInWriter();
    sql(`insert into subscribers (email, plan) values ('f@test.dev', 'free'), ('p@test.dev', 'paid')`);
    sql(`insert into subscribers (email, plan, emailsEnabled) values ('off@test.dev', 'free', false)`);

    let page = (route(fakeRequest({ id: "new" }), fakeResponse) as any).attrs;

    equal(page.post, null);
    equal(page.audience, { paid: 1, free: 1 });
  });
});
