import { session, sql } from "@elements/app";

/** A request with just the parts the routes read. */
export function fakeRequest(params: Record<string, string> = {}, query: Record<string, string> = {}): any {
  return { params, query, headers: {} };
}

export const fakeResponse: any = {};

/**
 * Makes a value for a unique column unique to this call. Test files run in
 * parallel against one database, and two open transactions inserting the same
 * key block each other.
 */
export function unique(value: string): string {
  let suffix = crypto.randomUUID().slice(0, 8);
  let at = value.indexOf("@");

  return at < 0 ? `${value}-${suffix}` : `${value.slice(0, at)}-${suffix}${value.slice(at)}`;
}

export function signInWriter() {
  let user = sql<{ id: string }>(`
    insert into users (email, name, passwordHash)
    values (${unique("writer@test.dev")}, 'Test Writer', crypt('pw', genSalt('bf', 4)))
    returning id
  `).firstOrThrow();

  session.login({ userId: user.id, userName: "Test Writer", role: "writer" });
}

export function signInReader(email: string, plan: "free" | "paid") {
  let sub = sql<{ id: string; email: string; unsubscribeToken: string }>(`
    insert into subscribers (email, plan) values (${unique(email)}, ${plan}) returning id, email, unsubscribeToken
  `).firstOrThrow();

  session.login({ userId: sub.id, userName: sub.email, role: "reader" });

  return sub;
}

/** Adds a sent post and returns its slug, made unique so parallel files cannot collide. */
export function addPost(name: string, access: "free" | "paid", body = "One.\n\nTwo.\n\nThree, the paid part."): string {
  let slug = unique(name);

  sql(`
    insert into posts (title, slug, body, access, publishAt, sentAt)
    values (${slug}, ${slug}, ${body}, ${access}, now() - interval '1 day', now() - interval '1 day')
  `);

  return slug;
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
