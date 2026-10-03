import { sql, session, AuthError, ForbiddenError } from "@elements/app";

export const WRITER_DEMO = {
  email: "maren@letterhearth.com",
  password: "hearth-writer",
};

export function isWriter(): boolean {
  if (!session.isLoggedIn() || session.get("role") !== "writer") {
    return false;
  }

  return !sql(`select 1 from users where id = ${session.getOrThrow("userId")}`).empty();
}

/** The guard at the top of every writer route and rpc. */
export function isWriterOrThrow() {
  session.isLoggedInOrThrow();

  if (!isWriter()) {
    throw new ForbiddenError("the writer's account is required");
  }
}

/** @rpc */
export function writerSignin(email: string, password: string) {
  let address = email.trim().toLowerCase();

  if (!address || !password) {
    throw new AuthError("enter your email and password");
  }

  let user = sql<{ id: string; name: string }>(`
    select id, name from users
    where email = ${address} and passwordHash = crypt(${password}, passwordHash)
  `).first();

  if (!user) {
    throw new AuthError("invalid email or password");
  }

  session.login({ userId: user.id, userName: user.name, role: "writer" });
}

/** @rpc */
export function signout() {
  session.logout();
}
