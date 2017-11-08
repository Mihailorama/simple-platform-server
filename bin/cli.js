#! /usr/bin/env node

const cli = require('cli');
const express = require('express');
const session = require('express-session');
const morgan = require('morgan');
const path = require('path');
const { createRouter } = require('../build/serve');


const options = cli.parse({
  appName: ['a', 'Identifies the app', 'string', 'simple-platform-server'],
  port: ['p', 'Port to listen to', 'number', 8080],
  staticDir: ['d', 'Where to find HTML, JavaScript and CSS files.', 'dir', path.join(__dirname, '../www')],
});

const app = express();

// We need sessions to store the access tokens.
app.use(session({
  name: `${options.appName}.sid`,
  secret: 'Perhaps-Attend-Know-Repair-8',  // TODO. Make this overridable in deployment.
  resave: false,  // This will need to be adjusted according to the type of session store.
  saveUninitialized: false,
  // In a production environment you need to add a `store` here.
}));

// Access logging.
app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));

app.use(createRouter(options));

const server = app.listen(options.port, () => {
  console.log(`${options.appName} listening on port ${server.address().port}`);
});
