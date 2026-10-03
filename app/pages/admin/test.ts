import { test, assert, equal, AuthError, ForbiddenError } from "@elements/app";
import { fakeRequest, fakeResponse, signInReader, signInWriter, throws } from "#app/shared/testing/fixtures";
import { SubscriberRow } from "#app/shared/services/subscribers";
import route from "./index";
import { filterRows } from "./template";

function row(email: string, plan: "free" | "paid", emailsEnabled: boolean, daysAgo: number): SubscriberRow {
  return {
    id: email,
    createdAt: new Date(Date.now() - daysAgo * 86_400_000),
    email,
    plan,
    emailsEnabled,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: null,
  };
}

test("writer dashboard", () => {
  test("is for the writer only", async () => {
    assert(await throws(() => route(fakeRequest(), fakeResponse), AuthError), "a visitor got in");

    signInReader("nosy@test.dev", "paid");
    assert(await throws(() => route(fakeRequest(), fakeResponse), ForbiddenError), "a reader got in");
  });

  test("opens the live subscriber list for the writer", () => {
    signInWriter();

    let page = (route(fakeRequest(), fakeResponse) as any).attrs;
    assert(page.subscribers !== undefined);
  });

  test("filters and sorts the list", () => {
    let rows = [
      row("a", "free", true, 3),
      row("b", "paid", true, 1),
      row("c", "free", false, 2),
      row("d", "paid", false, 4),
    ];

    equal(filterRows(rows, "all").map((r) => r.id), ["b", "c", "a", "d"]);
    equal(filterRows(rows, "paid").map((r) => r.id), ["b", "d"]);
    equal(filterRows(rows, "free").map((r) => r.id), ["a"]);
    equal(filterRows(rows, "unsubscribed").map((r) => r.id), ["c", "d"]);
  });
});
