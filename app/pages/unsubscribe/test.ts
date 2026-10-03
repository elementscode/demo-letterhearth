import { test, equal, sql } from "@elements/app";
import { fakeRequest, fakeResponse } from "#app/shared/testing/fixtures";
import route from "./index";

test("unsubscribe page", () => {
  test("one click unsubscribes", () => {
    let sub = sql<{ unsubscribeToken: string }>(`
      insert into subscribers (email) values ('bye@test.dev') returning unsubscribeToken
    `).firstOrThrow();

    let page = (route(fakeRequest({ token: sub.unsubscribeToken }), fakeResponse) as any).attrs;

    equal(page.email, "bye@test.dev");
    equal(sql<{ emailsEnabled: boolean }>(`select emailsEnabled from subscribers`).firstOrThrow().emailsEnabled, false);
  });

  test("a bad token changes nothing", () => {
    sql(`insert into subscribers (email) values ('stay@test.dev')`);

    let page = (route(fakeRequest({ token: "00000000-0000-0000-0000-000000000000" }), fakeResponse) as any).attrs;

    equal(page.email, "");
    equal(sql<{ emailsEnabled: boolean }>(`select emailsEnabled from subscribers`).firstOrThrow().emailsEnabled, true);
  });
});
