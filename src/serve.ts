/**
 * Simple Server for web apps running against the CoreFiling True North Data Platform.
 *
 * • redirects from / to /APP/
 * • handles logging in user if user not logged in
 * • proxies API requests and adds Authorization header
 * • serves static files
 */

import express = require('express');
import { Request, Router } from 'express';
import proxy = require('express-http-proxy');
import request = require('request-promise');
import { create as simpleOAuth2Create, AccessToken } from 'simple-oauth2';
import { resolve as urlResolve } from 'url';

interface Options {
  appName: string;
  staticDir: string;
  client?: {
    id: string;
    secret: string;
  };
  authBase: string;
  realmName: string;
  apiBase: string;
  port: number;
}

/**
 * Create an Express router (mini-app).
 *
 * @param options Options
 */
export function createRouter(options: Partial<Options> = {}): Router {
  const {
    appName = 'simple-platform-server',
    staticDir = 'www',
    client,
    authBase = 'https://login.corefiling.com',
    realmName = 'platform',
    apiBase = 'https://labs-api.corefiling.com/',
    port = 8080,
  } = options;

  const router = Router();

  // If client.id is not set we must be running inside of CoreFiling’s cluster.
  const realmBase = client && urlResolve(authBase, `/auth/realms/${realmName}/protocol/openid-connect/`);

  // Note to self: One obtains endpoints from  /auth/realms/{realm}/.well-known/openid-configuration
  const oauth2 = client && realmBase && simpleOAuth2Create({
    client,
    auth: {
      tokenHost: authBase,
      tokenPath: urlResolve(realmBase, 'token'),
      authorizePath: urlResolve(realmBase, 'auth'),
    },
  });

  const callbackPath = '/auth/callback';
  const redirectUriFromRequest = (req: Request) => `${req.protocol}://${req.hostname}:${port}${callbackPath}`;

  if (oauth2) {
    // Middleware to check whether user is logged in.
    // If not then they are redirected to the login server.
    router.use(`/${appName}/`, (req, res, next) => {
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

      // Redirect to login page.
      const state = {
        next: req.path,
      };
      const authorizationUrl = oauth2.authorizationCode.authorizeURL({
        redirect_uri: redirectUriFromRequest(req),
        state: JSON.stringify(state),
      });
      res.redirect(authorizationUrl);
      // Don't call next.
    });
  }

  // Serve the static files from the app prefix.
  console.log('Static files from', staticDir);
  router.use(`/${appName}/`, express.static(staticDir));

  // When we introduce routing we will need to add a clause that maps all URLs
  // not corresponding to static files to index.html.

  if (realmBase && oauth2) {
    // Middleware to ensure if we have a token it is refreshed before handling API endpoints.
    router.use('/api', (req, _, next) => {
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
    });

    // These 2 APIs are implemented not in backend servers but in the proxy (which this server is standing in for).
    router.get('/api/user', (req, res) => {
      if (req.session && req.session.token) {
        request({
          url: urlResolve(realmBase, 'userinfo'),
          headers: {
            Authorization: `Bearer ${req.session.token.access_token}`,
          },
          json: true,
        })
        .then(data => res.json(data))
        .catch(error => {
          console.log('Error calling userinfo', error.message, error);
          res.send({error: error.message});
        });
      }
    });

    router.get('/api/apps', (_, res) => {
      res.json([
        {id: appName, name: appName, href: `/${appName}/`, features: []},
      ]);
    });

    router.use('/api', proxy(apiBase, {
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

    // When user logs in the authentication server redirects them to this URL.
    router.get(callbackPath, (req, res) => {
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
          const state = JSON.parse(req.query.state || '{}');
          res.redirect(state.next || `/${appName}/`);
        })
        .catch(error => {
          console.log('Access Token Error', error.message);
          res.send(error.message);
        });
    });

    router.get('/auth/logout', (req, res) => {
      if (req.session && req.session.token) {
        delete req.session.token;
      }
      const nextUrl = req.header('Referer') || `${req.protocol}://${req.hostname}:${port}/${appName}/`;
      const url = urlResolve(realmBase, `logout?redirect_uri=${encodeURIComponent(nextUrl)}`);
      res.redirect(url);
    });
  }

  // For consistency with the way the app is deployed in labs.corefiling.com, we insert $APP/ as a URL prefix.
  router.get('/', (_, res) => {
    res.redirect(`/${appName}/`);
  });

  return router;
}

/**
 * A printable version of an AccessToken or a token. Useful when debugging.
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
