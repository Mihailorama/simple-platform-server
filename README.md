Simple Platform Server
======================

Simple server for web apps using the CoreFiling True North Platform APIs.

The conventions for a client-side platform app are for the APIs and the
application files to be served from the same domain. This means the JavaScript
or TypeScript code can always assume the User API is at `/api/user` instead of
having umpteen endpoints supplied via configuration. In CoreFiling’s production
deployment this is achieved through a gateway that handles OAuth2
authentication and proxies the back-end APIs and static files.

This server allows a web app to be run outside of the CoreFiling cluster, by
supplying basic versions of the facilities it provides.


Usage
-----

To run the server you need a client ID (in the OAuth2 sense) on the CoreFiling
Platform. The credentials for this are passed to the server via environment
variables `CLIENT_ID` and `CLIENT_SECRET`. This is compatible with the way
server secrets are passed to servers hosted on Kubernetes, Heroku, etc.

Add this package as a dependency of your project:

```shell
yarn add @cfl/simple-platform-server
```

Then add it as a script in `package.json`:

```json
"scripts": {
    …
    "start": "simple-platform-server --staticDir www -appName name-of-your-app"
}
```

And run the server with something like

    env $(cat .env) yarn start

You can then visit your app at <http://localhost:8080/name-of-your-app/>. The
first time you do it will redirect you to the CoreFiling platform log-in page.
Once you are logged in the application should run normally.

Your app consists of HTML and JavaScript files in the `--staticDir` directory.

Customize the port number listened to by setting environmwent variable `PORT` or
by adding a `--port` command-line option.


Conventions
-----------

APIs are available with URLs starting with `/api/`_name_`/v1/`. For example, the
base URL of the Document Service is
`http://localhost:8080/api/document-service/v1/`.

Additional URLs recognized by the server are

* `/auth/logout` to log the user out;
* `/api/user` provides information about the currently logged-in user;
* `/api/apps` provides information for the apps menu.

The last two are exceptions to the other API endpoints because they are supplied
by the gateway itself, not a backend service.


In production
-------------

There are three obvious options

* Place this server behind a suitable revers proxy like NGINX, Varnish, etc.;
* Use the router defined in `build/serve.js`, allowing you to supply a
  persistent session store and custom logging configuration;
* Write an entirely different server based on the conventions of this one,
  allowing you to align its behaviours with your existing infrastructure.


Licence
-------

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this software except in compliance with the License.
You may obtain a copy of the License at <http://www.apache.org/licenses/LICENSE-2.0>.

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
