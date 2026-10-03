import { test, assert, equal, AuthError } from "@elements/app";
import { addPost, fakeRequest, fakeResponse, signInWriter, throws } from "#app/shared/testing/fixtures";
import route from "./index";

test("writer post list", () => {
  test("is for the writer only", async () => {
    assert(await throws(() => route(fakeRequest(), fakeResponse), AuthError));
  });

  test("lists every post with its status", () => {
    signInWriter();
    addPost("sent-one", "paid");

    let page = (route(fakeRequest({}, { done: "published" }), fakeResponse) as any).attrs;

    equal(page.posts.length, 1);
    assert(page.posts[0].sentAt !== null);
    equal(page.done, "published");
  });
});
