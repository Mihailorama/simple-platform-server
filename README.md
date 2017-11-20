Simple Platform Server
======================

Simple server for web apps using the CoreFiling True North Platform APIs.

The server can be configured with your OAuth 2 client ID and secret.  It
performs the OAuth 2 authorization code grant against the CoreFiling OAuth 2
server and maintains the bearer token needed for API access in the http
session.

If no credentials are configured it defaults to the demonstration client.

All API requests made by the UI are proxied through this server which adds
the token to the request.

Usage
-----

To run the server you need an OAuth 2 client ID and secret for the CoreFiling
Platform. The credentials for this are passed to the server via environment
variables `CLIENT_ID` and `CLIENT_SECRET`.

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

```
$ export CLIENT_ID=YOUR_ID
$ export CLIENT_SECRET=YOUR_SECRET
$ yarn start
```

You can then visit your app at <http://localhost:8080/name-of-your-app/>. The
first time you do it will redirect you to the CoreFiling platform login page.
Once you are logged in the application should run normally.

Your app consists of HTML and JavaScript files in the `--staticDir` directory.

Customize the port number listened to by setting environment variable `PORT` or
by adding a `--port` command-line option. Note that overriding the port will
prevent login if the port no longer matches a registered redirect URI for the
application. The default credentials support a redirect URI of
'http://localhost:8080/\*' for testing.


Conventions
-----------

APIs are available with URLs starting with `/api/`_name_`/v1/`. For example, the
base URL of the Document Service is
`http://localhost:8080/api/document-service/v1/`.

Additional URLs recognised by the server are

* `/auth/logout` to log the user out;
* `/api/user` provides information about the currently logged-in user;
* `/api/apps` provides information for the apps menu.

The last two are exceptions to the other API endpoints because they are supplied
by the gateway itself, not a backend service.


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
