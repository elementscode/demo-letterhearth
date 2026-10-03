/**
 * The keys the app stores in the session. The writer signs in with a password
 * and gets role "writer"; a reader signs in by subscribing or through an
 * emailed link and gets role "reader", with userId set to their subscriber id.
 */
declare module "@elements/app" {
  interface SessionData {
    userId: string;
    userName: string;
    role: "writer" | "reader";
  }
}

export {};
