/**
 * Server for our app.
 *
 * /auth/login and /auth/logout -- redirect to OAuth2 endpoints
 * /
 */

import * as express from 'express';
import { Request } from 'express';
import proxy = require('express-http-proxy');
import * as session from 'express-session';
import * as morgan from 'morgan';
import { create as simpleOAuth2Create, AccessToken } from 'simple-oauth2';
import * as path from 'path';
import { resolve as urlResolve } from 'url';

const APP = 'quick-xbrl-validator';

const BASE = 'https://login.corefiling.com';
const REALM = 'dev'; // TODO. Change to public realm.
const REALM_BASE = urlResolve(BASE, `/auth/realms/${REALM}/protocol/openid-connect/`);
// const USER_PATH = urlResolve(BASE_HOST, '/auth/realms/dev/protocol/openid-connect/userinfo');
const API_BASE = 'https://platform-api.cfl.io/';

const PORT = 8080;

// Note to self: One obtains endpoints from  /auth/realms/{realm}/.well-known/openid-configuration
const oauth2 = simpleOAuth2Create({
  client: {
    id: 'pdc-inv-109',
    secret: 'PUBLIC',
  },
  auth: {
    tokenHost: BASE,
    tokenPath: urlResolve(REALM_BASE, 'token'),
    authorizePath: urlResolve(REALM_BASE, 'auth'),
  },
});

const callbackPath = '/auth/callback';

const app = express();

// Access loggimg.
app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));

// We need sessions to store the access tokens.
app.use(session({
  name: `${APP}.sid`,
  secret: 'Perhaps-Attend-Know-Repair-8',  // TODO. Make this overridable in deployment.
  resave: false,  // This will need to be adjusted according to the type of session store.
  saveUninitialized: false,
  // In a production environment you need to add a `store` here.
}));

interface AuthState {
  next?: string;
}

/**
 * A printable version of an AccessToken or a token.
 *
 * @param token An AccessToken or a token.
 */
const sanitizeToken = (token: any): any => {
  if ('token' in token) {
    return {...token, token: sanitizeToken(token.token)};
  }
  if ('access_token' in token && 'refresh_token' in token) {
    return {...token, access_token: token.access_token.substr(0, 7) + '…', refresh_token: token.refresh_token.substr(0, 7) + '…'};
  }
  return token;
};

// Middleware to check whether user is logged in.
// If not then they are redirected to the login server.
app.use(`/${APP}/`, (req, res, next) => {
  if (req.session && req.session.token) {
    // Check token has not expired and consider refreshing it.
    const accessToken: AccessToken = oauth2.accessToken.create(req.session.token);
    if (!accessToken.expired()) {
      next();  // Everything is OK, so continue handling request.
      return;
    }
    accessToken.refresh()
      .then(result => {
        req.session!.token = result.token;
        next();
      })
      .catch(error => {
        console.log('Refresh Token Error', error.message, error);
        res.send(error.message);
      });
    return;
  }

  // Ask authentication server to ask user to log in.
  const state: AuthState = {
    next: req.path,
  };
  const authorizationUrl = oauth2.authorizationCode.authorizeURL({
    redirect_uri: redirectUriFromRequest(req),
    state: JSON.stringify(state),
  });
  res.redirect(authorizationUrl);
  // Don't call next.
});

const redirectUriFromRequest = (req: Request) => `${req.protocol}://${req.hostname}:${PORT}${callbackPath}`;

// Serve the static files from the app prefix.
app.use(`/${APP}/`, express.static(path.join(__dirname, '../../www')));

// When we introduce routing we will need to add a clause that maps all URLs
// not corresponding to static files to index.html.

// These 2 APIs are implemented not in backend servers but in the proxy (which this server is standing in for).
app.get('/api/user', (_, res) => {
  res.json({
    email: 'Suman.Normanson@example.com',
    name: 'Suman Normanson',
  });
});

app.get('/api/apps', (_, res) => {
  res.json([
    {id: APP, name: 'Quick XBRL Validator', href: `${APP}`, features: []},
    {id: 'name-generator', name: 'Name generator',
      href: 'https://www.behindthename.com/random/random.php?number=1&gender=u&surname=&randomsurname=yes&showextra=yes&all=yes',
       features: []},
  ]);
});

// Proxy API calls, adding the authentication header.
app.use(
  '/api',
  (req, _, next) => {
    // Refresh token if it exists and has expired.
    if (req.session && req.session.token) {
      const token: {access_token: string} = req.session.token;
      const accessToken = oauth2.accessToken.create(token);
      if (accessToken.expired()) {
        accessToken.refresh()
          .then(result => {
            req.session!.token = result.token;
            next();
          })
          .catch(error => console.log('Error refreshing token: ', error.message, error));
        return;
      }
    }
    next();
  },
  proxy(API_BASE, {
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      if (srcReq.session && srcReq.session.token) {
        const token: {access_token: string} = srcReq.session.token;
        const headerValue = `Bearer ${token.access_token}`;
        if (!proxyReqOpts.headers) {
          proxyReqOpts.headers = {Authorization: headerValue};
        } else {
          proxyReqOpts.headers.Authorization = headerValue;
        }
      }
      return proxyReqOpts;
    },
  }));

// For consistency with the way the app is deployed in labs.corefiling.com, we insert $APP/ as a URL prefix.
app.get('/', (_, res) => {
  res.redirect(`/${APP}/`);
});

// When user logs in the authentication server redirects them to this URL.{next: req.path}
app.get(callbackPath, (req, res) => {
  const tokenConfig = {
    code: req.query.code,
    redirect_uri: redirectUriFromRequest(req),
  };
  oauth2.authorizationCode.getToken(tokenConfig)
  .then(result => {
    if (!req.session) {
      // Pretty sure this should not happen, assuming session middleware is set up correctly.
      res.send('Could not store accessToken for user because no session manager configured.');
      return;
    }

    req.session.token = result;
    const state: AuthState = JSON.parse(req.query.state || '{}');
    res.redirect(state.next || `/${APP}/`);
  })
  .catch(error => {
    console.log('Access Token Error', error.message);
    res.send(error.message);
  });
});

app.get('/auth/logout', (_, res) => res.send('Logout'));  // TODO redirect to logout endpoint.

const server = app.listen(PORT, () => {
  console.log(`App listening on port ${server.address().port}`);
});
