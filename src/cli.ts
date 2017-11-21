#! /usr/bin/env node

import * as cli from 'cli';
import * as express from 'express';
import * as session from 'express-session';
import * as morgan from 'morgan';
import * as path from 'path';
import { createRouter } from './serve';

const options = cli.parse({
  appName: ['a', 'Identifies the app.', 'string', 'simple-platform-server'],
  noAuth: ['n', 'Disables OAuth 2 authentication.', 'boolean'],
  port: ['p', 'Port to listen to.', 'number', process.env.PORT || 8080],
  staticDir: ['d', 'Where to find HTML, JavaScript and CSS files.', 'dir', path.join(__dirname, '../www')],
});

if (!process.env.CLIENT_ID !== !process.env.CLIENT_SECRET) {
  cli.fatal('CLIENT_ID and CLIENT_SECRET must both be unset (to use defaults) or both be set in the environment');
}
if (process.env.CLIENT_ID && process.env.CLIENT_SECRET) {
  cli.info('Running with authentication.');
  options.client = {
    id: process.env.CLIENT_ID,
    secret: process.env.CLIENT_SECRET,
  };
} else {
  if (options.noAuth) {
    cli.info('Running without authentication.');
  }
  else {
    cli.info('Running with default demonstration client credentials.');
    // Intentionally public demonstration credentials.  These require a user account.
    options.client = {
      id: 'platform-development-client',
      secret: 'not required',
    };
  }
}
if (process.env.CFL_DEV) {
  cli.info('Using CoreFiling internal development backend.');
  options.realmName = 'dev';
  options.apiBase = 'https://labs-api.cfl.io/';
}

const app = express();

if (process.env.CLIENT_ID && process.env.CLIENT_SECRET) {
  app.set('trust proxy', true);
}

// We need sessions to store the access tokens.
app.use(session({
  name: `${options.appName}.sid`,
  secret: 'Perhaps-Attend-Know-Repair-8',  // In production environment this should be configurable.
  resave: false,  // This will need to be adjusted according to the type of session store.
  saveUninitialized: false,
  // In a production environment you need to add a `store` here.
}));

// Access logging.
app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));

app.use(createRouter(options));

const server = app.listen(options.port, 'localhost', () => {
  const {port} = server.address();
  console.log(`${options.appName} running at http://localhost:${port}/${options.appName}/`);
});
