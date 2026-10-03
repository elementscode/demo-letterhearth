import { test, assert, equal, AuthError } from "@elements/app";
import { addPost, fakeRequest, fakeResponse, signInWriter, throws } from "#app/shared/testing/fixtures";
import route from "./index";

test("writer post list", () => {
  test("is for the writer only", async () => {
    assert(await throws(() => route(fakeRequest(), fakeResponse), AuthError));
  });

  test("lists every post with its status", () => {
    signInWriter();

    let before = (route(fakeRequest(), fakeResponse) as any).attrs.posts.length;

    let slug = addPost("sent-one", "paid");

    let page = (route(fakeRequest({}, { done: "published" }), fakeResponse) as any).attrs;

    equal(page.posts.length, before + 1);
    assert(page.posts.find((p: any) => p.slug === slug).sentAt !== null);
    equal(page.done, "published");
  });
});
