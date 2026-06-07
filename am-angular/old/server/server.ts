import 'dotenv/config';
import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { join } from 'node:path';
import apiRoutes from './api/api';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './api/lib/auth';
import morgan from 'morgan';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

app.use(
  cors({
    origin: [
      'https://demo.appointment-manager.dev',
      'http://localhost:4200',
      'http://localhost:4000',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  }),
);
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'self'", "'unsafe-inline'"],
    },
  }),
);

// Logger middleware (morgan)
if (process.env['NODE_ENV'] === 'production') {
  app.use(morgan('combined'));
} else {
  app.use(morgan('dev'));
}

// Register better-auth route BEFORE body parsers and helmet
app.all('/api/auth/{*any}', toNodeHandler(auth));

// Add body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Register API routes
app.use('/api', apiRoutes);

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url)) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
