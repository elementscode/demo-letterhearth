import { test, assert, equal, errorf, session, sql, AuthError } from "@elements/app";
import { writerSignin, WRITER_DEMO } from "#app/shared/services/auth";

test("sign in", () => {
  test("the writer signs in with a password", () => {
    sql(`
      insert into users (email, name, passwordHash)
      values (${WRITER_DEMO.email}, 'Maren Holt', crypt(${WRITER_DEMO.password}, genSalt('bf', 4)))
    `);

    writerSignin(WRITER_DEMO.email.toUpperCase(), WRITER_DEMO.password);

    equal(session.get("role"), "writer");
  });

  test("a wrong password is refused", () => {
    sql(`
      insert into users (email, name, passwordHash)
      values (${WRITER_DEMO.email}, 'Maren Holt', crypt(${WRITER_DEMO.password}, genSalt('bf', 4)))
    `);

    try {
      writerSignin(WRITER_DEMO.email, "wrong");
      errorf("signed in with a wrong password");
    } catch (err) {
      assert(err instanceof AuthError, `got ${err}`);
    }

    assert(!session.isLoggedIn());
  });
});
