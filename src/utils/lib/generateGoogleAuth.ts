import passport from "passport";
// @ts-ignore
import GoogleStrategy from "passport-google-oidc";
import { Request, Response } from "express";

interface GoogleAuthOpts<SessionData, User> {
  /**
   * The Google OAuth Client ID
   */
  clientID: string;

  /**
   * The Google OAuth Client Secret
   */
  clientSecret: string;

  /**
   * Ensure that this url is also registered in the Google credentials console
   * Passport defaults to using localhost:3000 even for production so we have to
   * explicitly provide the domain of the production website through the env var
   * */
  domain?: string;

  /**
   * A function that fetches the session payload from the Gmail address
   * @param email The user's gmail address
   * @returns The session payload
   */
  getSessionDataFromEmail: (email: string) => Promise<SessionData>;

  /**
   * A function that fetches the user object from the session payload on request
   * @param sessionData The data from the session
   * @returns The user object
   */
  getUserFromSession: (sessionData: SessionData) => Promise<User | null>;
}

export const generateGoogleAuth = <SessionData, User>(opts: GoogleAuthOpts<SessionData, User>) => {
  const googleAuth = passport.use(
    new GoogleStrategy(
      {
        clientID: opts.clientID,
        clientSecret: opts.clientSecret,
        callbackURL: `${opts.domain ?? ""}/oauth2/redirect/google`,
        scope: ["profile", "email"],
      },

      function verify(issuer: any, profile: any, cb: any) {
        const user_gmail = profile.emails[0].value;
        opts
          .getSessionDataFromEmail(user_gmail)
          .then((sessionPayload) => cb(null, sessionPayload))
          .catch((err) => {
            console.error("Failed to retrieve user for:", user_gmail, err);
            return cb(new Error("Server side error, please try again"));
          });
      }
    )
  );

  const authenticate = async (req: Request, res: Response): Promise<User | null> => {
    if (req.isAuthenticated()) return await opts.getUserFromSession(req.user as SessionData);
    return null;
  };

  return { passport: googleAuth, authenticate };
};

passport.serializeUser(function (user, cb) {
  process.nextTick(function () {
    return cb(null, user);
  });
});

passport.deserializeUser(function (user: any, cb) {
  process.nextTick(function () {
    return cb(null, user);
  });
});
