import { test, equal, sql } from "@elements/app";
import { fakeRequest, fakeResponse, unique } from "#app/shared/testing/fixtures";
import route from "./index";

test("unsubscribe page", () => {
  test("one click unsubscribes", () => {
    let sub = sql<{ id: string; email: string; unsubscribeToken: string }>(`
      insert into subscribers (email) values (${unique("bye@test.dev")}) returning id, email, unsubscribeToken
    `).firstOrThrow();

    let page = (route(fakeRequest({ token: sub.unsubscribeToken }), fakeResponse) as any).attrs;

    equal(page.email, sub.email);
    equal(
      sql<{ emailsEnabled: boolean }>(`select emailsEnabled from subscribers where id = ${sub.id}`).firstOrThrow()
        .emailsEnabled,
      false,
    );
  });

  test("a bad token changes nothing", () => {
    let sub = sql<{ id: string }>(`insert into subscribers (email) values (${unique("stay@test.dev")}) returning id`).firstOrThrow();

    let page = (route(fakeRequest({ token: "00000000-0000-0000-0000-000000000000" }), fakeResponse) as any).attrs;

    equal(page.email, "");
    equal(
      sql<{ emailsEnabled: boolean }>(`select emailsEnabled from subscribers where id = ${sub.id}`).firstOrThrow()
        .emailsEnabled,
      true,
    );
  });
});
