import { session, sql } from "@elements/app";

/** A request with just the parts the routes read. */
export function fakeRequest(params: Record<string, string> = {}, query: Record<string, string> = {}): any {
  return { params, query, headers: {} };
}

export const fakeResponse: any = {};

export function signInWriter() {
  let user = sql<{ id: string }>(`
    insert into users (email, name, passwordHash)
    values ('writer@test.dev', 'Test Writer', crypt('pw', genSalt('bf', 4)))
    returning id
  `).firstOrThrow();

  session.login({ userId: user.id, userName: "Test Writer", role: "writer" });
}

export function signInReader(email: string, plan: "free" | "paid") {
  let sub = sql<{ id: string; unsubscribeToken: string }>(`
    insert into subscribers (email, plan) values (${email}, ${plan}) returning id, unsubscribeToken
  `).firstOrThrow();

  session.login({ userId: sub.id, userName: email, role: "reader" });

  return sub;
}

export function addPost(slug: string, access: "free" | "paid", body = "One.\n\nTwo.\n\nThree, the paid part.") {
  sql(`
    insert into posts (title, slug, body, access, publishAt, sentAt)
    values (${slug}, ${slug}, ${body}, ${access}, now() - interval '1 day', now() - interval '1 day')
  `);
}

/** Runs fn and reports whether it threw an error of the given class. */
export async function throws(fn: () => unknown, kind: Function): Promise<boolean> {
  try {
    await fn();
  } catch (err) {
    return err instanceof kind;
  }

  return false;
}
