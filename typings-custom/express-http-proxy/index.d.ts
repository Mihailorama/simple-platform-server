/**
 * Type declarations for express-http-proxy, based on <https://www.npmjs.com/package/express-http-proxy>.
 */

declare module 'express-http-proxy' {
  import { RequestHandler, Request, Response } from 'express';
  import { RequestOptions } from 'http';

  interface ProxyOptions {
    filter?: (req: Request, res: Response) => boolean;

    proxyReqPathResolver?: (req: Request) => string | Promise<string>;
    proxyReqOptDecorator?: (proxyReqOpts: RequestOptions, srcReq: Request) => RequestOptions | Promise<RequestOptions>;
    proxyReqBodyDecorator?: (bodyContent: string | Buffer) => string | Buffer | Promise<string> | Promise<Buffer>;

    userResDecorator?: (proxyRes: Response, proxyResData: any, userReq: Request, userRes: Response) => string | Promise<string>;

    limit?: string;
    memoizeHost?: boolean;
    https?: boolean;
    preserveHostHdr?: boolean;

    parseReqBody?: boolean;
    reqAsBuffer?: boolean;
    reqBodyEncoding?: string | null;

    timeout?: number;  // milliseconds
  }

  function proxy(host: string, options?: ProxyOptions): RequestHandler;

  export = proxy;
}
