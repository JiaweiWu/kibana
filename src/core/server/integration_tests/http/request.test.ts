/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'),
}));

import supertest from 'supertest';
import { loggingSystemMock } from '@kbn/core-logging-server-mocks';
import { executionContextServiceMock } from '@kbn/core-execution-context-server-mocks';
import { contextServiceMock } from '@kbn/core-http-context-server-mocks';
import { schema } from '@kbn/config-schema';
import { HttpService } from '@kbn/core-http-server-internal';
import { createInternalHttpService } from '../utilities';

let server: HttpService;

let logger: ReturnType<typeof loggingSystemMock.create>;
const contextSetup = contextServiceMock.createSetupContract();

const setupDeps = {
  context: contextSetup,
  executionContext: executionContextServiceMock.createInternalSetupContract(),
};

beforeEach(async () => {
  logger = loggingSystemMock.create();

  server = createInternalHttpService({ logger });
  await server.preboot({ context: contextServiceMock.createPrebootContract() });
});

afterEach(async () => {
  await server.stop();
});

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
describe('KibanaRequest', () => {
  describe('auth', () => {
    describe('isAuthenticated', () => {
      it('returns false if no auth interceptor was registered', async () => {
        const { server: innerServer, createRouter } = await server.setup(setupDeps);
        const router = createRouter('/');
        router.get(
          {
            path: '/',
            security: { authz: { enabled: false, reason: '' } },
            validate: false,
            options: { authRequired: true },
          },
          (context, req, res) => res.ok({ body: { isAuthenticated: req.auth.isAuthenticated } })
        );
        await server.start();

        await supertest(innerServer.listener).get('/').expect(200, {
          isAuthenticated: false,
        });
      });
      it('returns false if not authenticated on a route with authRequired: "optional"', async () => {
        const { server: innerServer, createRouter, registerAuth } = await server.setup(setupDeps);
        const router = createRouter('/');
        registerAuth((req, res, toolkit) => toolkit.notHandled());
        router.get(
          {
            path: '/',
            security: { authz: { enabled: false, reason: '' } },
            validate: false,
            options: { authRequired: 'optional' },
          },
          (context, req, res) => res.ok({ body: { isAuthenticated: req.auth.isAuthenticated } })
        );
        await server.start();

        await supertest(innerServer.listener).get('/').expect(200, {
          isAuthenticated: false,
        });
      });
      it('returns false if redirected on a route with authRequired: "optional"', async () => {
        const { server: innerServer, createRouter, registerAuth } = await server.setup(setupDeps);
        const router = createRouter('/');
        registerAuth((req, res, toolkit) => toolkit.redirected({ location: '/any' }));
        router.get(
          {
            path: '/',
            security: { authz: { enabled: false, reason: '' } },
            validate: false,
            options: { authRequired: 'optional' },
          },
          (context, req, res) => res.ok({ body: { isAuthenticated: req.auth.isAuthenticated } })
        );
        await server.start();

        await supertest(innerServer.listener).get('/').expect(200, {
          isAuthenticated: false,
        });
      });
      it('returns true if authenticated on a route with authRequired: "optional"', async () => {
        const { server: innerServer, createRouter, registerAuth } = await server.setup(setupDeps);
        const router = createRouter('/');
        registerAuth((req, res, toolkit) => toolkit.authenticated());
        router.get(
          {
            path: '/',
            security: { authz: { enabled: false, reason: '' } },
            validate: false,
            options: { authRequired: 'optional' },
          },
          (context, req, res) => res.ok({ body: { isAuthenticated: req.auth.isAuthenticated } })
        );
        await server.start();

        await supertest(innerServer.listener).get('/').expect(200, {
          isAuthenticated: true,
        });
      });
      it('returns true if authenticated', async () => {
        const { server: innerServer, createRouter, registerAuth } = await server.setup(setupDeps);
        const router = createRouter('/');
        registerAuth((req, res, toolkit) => toolkit.authenticated());
        router.get(
          {
            path: '/',
            security: { authz: { enabled: false, reason: '' } },
            validate: false,
            options: { authRequired: true },
          },
          (context, req, res) => res.ok({ body: { isAuthenticated: req.auth.isAuthenticated } })
        );
        await server.start();

        await supertest(innerServer.listener).get('/').expect(200, {
          isAuthenticated: true,
        });
      });
    });
  });

  describe('route options', () => {
    describe('authRequired', () => {
      it('returns false if a route configured with "authRequired": false', async () => {
        const { server: innerServer, createRouter, registerAuth } = await server.setup(setupDeps);
        registerAuth((req, res, t) => t.authenticated());
        const router = createRouter('/');
        router.get(
          {
            path: '/',
            security: { authz: { enabled: false, reason: '' } },
            validate: false,
            options: { authRequired: false },
          },
          (context, req, res) => res.ok({ body: { authRequired: req.route.options.authRequired } })
        );
        await server.start();

        await supertest(innerServer.listener).get('/').expect(200, {
          authRequired: false,
        });
      });
      it('returns "optional" if a route configured with "authRequired": optional', async () => {
        const { server: innerServer, createRouter, registerAuth } = await server.setup(setupDeps);
        registerAuth((req, res, t) => t.authenticated());
        const router = createRouter('/');
        router.get(
          {
            path: '/',
            security: { authz: { enabled: false, reason: '' } },
            validate: false,
            options: { authRequired: 'optional' },
          },
          (context, req, res) => res.ok({ body: { authRequired: req.route.options.authRequired } })
        );
        await server.start();

        await supertest(innerServer.listener).get('/').expect(200, {
          authRequired: 'optional',
        });
      });
      it('returns true if a route configured with "authRequired": true', async () => {
        const { server: innerServer, createRouter, registerAuth } = await server.setup(setupDeps);
        registerAuth((req, res, t) => t.authenticated());
        const router = createRouter('/');
        router.get(
          {
            path: '/',
            security: { authz: { enabled: false, reason: '' } },
            validate: false,
            options: { authRequired: true },
          },
          (context, req, res) => res.ok({ body: { authRequired: req.route.options.authRequired } })
        );
        await server.start();

        await supertest(innerServer.listener).get('/').expect(200, {
          authRequired: true,
        });
      });
    });
  });

  describe('events', () => {
    describe('aborted$', () => {
      it('emits once and completes when request aborted', async () => {
        expect.assertions(1);
        const { server: innerServer, createRouter } = await server.setup(setupDeps);
        const router = createRouter('/');

        const nextSpy = jest.fn();

        const done = new Promise<void>((resolve) => {
          router.get(
            { path: '/', security: { authz: { enabled: false, reason: '' } }, validate: false },
            async (context, request, res) => {
              request.events.aborted$.subscribe({
                next: nextSpy,
                complete: resolve,
              });

              // prevents the server to respond
              await delay(30000);
              return res.ok({ body: 'ok' });
            }
          );
        });

        await server.start();

        const incomingRequest = supertest(innerServer.listener)
          .get('/')
          // end required to send request
          .end();

        setTimeout(() => incomingRequest.abort(), 50);
        await done;
        expect(nextSpy).toHaveBeenCalledTimes(1);
      });

      it('emits once and completes when request aborted after the payload has been consumed', async () => {
        expect.assertions(1);
        const { server: innerServer, createRouter } = await server.setup(setupDeps);
        const router = createRouter('/');

        const nextSpy = jest.fn();

        const done = new Promise<void>((resolve) => {
          router.post(
            {
              path: '/',
              security: { authz: { enabled: false, reason: '' } },
              validate: { body: schema.any() },
            },
            async (context, request, res) => {
              request.events.aborted$.subscribe({
                next: nextSpy,
                complete: resolve,
              });

              // prevents the server to respond
              await delay(30000);
              return res.ok({ body: 'ok' });
            }
          );
        });

        await server.start();

        const incomingRequest = supertest(innerServer.listener)
          .post('/')
          .send({ hello: 'dolly' })
          // end required to send request
          .end();

        setTimeout(() => incomingRequest.abort(), 50);
        await done;
        expect(nextSpy).toHaveBeenCalledTimes(1);
      });

      it('completes & does not emit when request handled', async () => {
        const { server: innerServer, createRouter } = await server.setup(setupDeps);
        const router = createRouter('/');

        const nextSpy = jest.fn();
        const completeSpy = jest.fn();
        router.get(
          { path: '/', security: { authz: { enabled: false, reason: '' } }, validate: false },
          async (context, request, res) => {
            request.events.aborted$.subscribe({
              next: nextSpy,
              complete: completeSpy,
            });

            return res.ok({ body: 'ok' });
          }
        );

        await server.start();

        await supertest(innerServer.listener).get('/');

        expect(nextSpy).toHaveBeenCalledTimes(0);
        expect(completeSpy).toHaveBeenCalledTimes(1);
      });

      it('completes & does not emit when request rejected', async () => {
        const { server: innerServer, createRouter } = await server.setup(setupDeps);
        const router = createRouter('/');

        const nextSpy = jest.fn();
        const completeSpy = jest.fn();
        router.get(
          { path: '/', security: { authz: { enabled: false, reason: '' } }, validate: false },
          async (context, request, res) => {
            request.events.aborted$.subscribe({
              next: nextSpy,
              complete: completeSpy,
            });

            return res.badRequest();
          }
        );

        await server.start();

        await supertest(innerServer.listener).get('/');

        expect(nextSpy).toHaveBeenCalledTimes(0);
        expect(completeSpy).toHaveBeenCalledTimes(1);
      });

      it('does not complete before response has been sent', async () => {
        const {
          server: innerServer,
          createRouter,
          registerOnPreAuth,
        } = await server.setup(setupDeps);
        const router = createRouter('/');

        const nextSpy = jest.fn();
        const completeSpy = jest.fn();

        registerOnPreAuth((req, res, toolkit) => {
          req.events.aborted$.subscribe({
            next: nextSpy,
            complete: completeSpy,
          });
          return toolkit.next();
        });

        router.post(
          {
            path: '/',
            security: { authz: { enabled: false, reason: '' } },
            validate: { body: schema.any() },
          },
          async (context, request, res) => {
            expect(completeSpy).not.toHaveBeenCalled();
            return res.ok({ body: 'ok' });
          }
        );

        await server.start();

        await supertest(innerServer.listener).post('/').send({ data: 'test' }).expect(200);

        expect(nextSpy).toHaveBeenCalledTimes(0);
        expect(completeSpy).toHaveBeenCalledTimes(1);
      });
    });

    describe('completed$', () => {
      it('emits once and completes when response is sent', async () => {
        const { server: innerServer, createRouter } = await server.setup(setupDeps);
        const router = createRouter('/');

        const nextSpy = jest.fn();
        const completeSpy = jest.fn();

        router.get(
          { path: '/', security: { authz: { enabled: false, reason: '' } }, validate: false },
          async (context, req, res) => {
            req.events.completed$.subscribe({
              next: nextSpy,
              complete: completeSpy,
            });

            expect(nextSpy).not.toHaveBeenCalled();
            expect(completeSpy).not.toHaveBeenCalled();
            return res.ok({ body: 'ok' });
          }
        );

        await server.start();

        await supertest(innerServer.listener).get('/').expect(200);
        expect(nextSpy).toHaveBeenCalledTimes(1);
        expect(completeSpy).toHaveBeenCalledTimes(1);
      });

      it('emits once and completes when response is aborted', async () => {
        expect.assertions(2);
        const { server: innerServer, createRouter } = await server.setup(setupDeps);
        const router = createRouter('/');

        const nextSpy = jest.fn();

        const done = new Promise<void>((resolve) => {
          router.get(
            { path: '/', security: { authz: { enabled: false, reason: '' } }, validate: false },
            async (context, req, res) => {
              req.events.completed$.subscribe({
                next: nextSpy,
                complete: resolve,
              });

              expect(nextSpy).not.toHaveBeenCalled();
              await delay(30000);
              return res.ok({ body: 'ok' });
            }
          );
        });

        await server.start();

        const incomingRequest = supertest(innerServer.listener)
          .get('/')
          // end required to send request
          .end();
        setTimeout(() => incomingRequest.abort(), 50);
        await done;
        expect(nextSpy).toHaveBeenCalledTimes(1);
      });

      it('emits once and completes when response is aborted after the payload has been consumed', async () => {
        expect.assertions(2);
        const { server: innerServer, createRouter } = await server.setup(setupDeps);
        const router = createRouter('/');

        const nextSpy = jest.fn();

        const done = new Promise<void>((resolve) => {
          router.post(
            {
              path: '/',
              security: { authz: { enabled: false, reason: '' } },
              validate: { body: schema.any() },
            },
            async (context, req, res) => {
              req.events.completed$.subscribe({
                next: nextSpy,
                complete: resolve,
              });

              expect(nextSpy).not.toHaveBeenCalled();
              await delay(30000);
              return res.ok({ body: 'ok' });
            }
          );
        });

        await server.start();

        const incomingRequest = supertest(innerServer.listener)
          .post('/')
          .send({ foo: 'bar' })
          // end required to send request
          .end();
        setTimeout(() => incomingRequest.abort(), 50);
        await done;
        expect(nextSpy).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('request id', () => {
    it('accepts x-opaque-id header case-insensitively', async () => {
      const { server: innerServer, createRouter } = await server.setup(setupDeps);
      const router = createRouter('/');
      router.get(
        { path: '/', security: { authz: { enabled: false, reason: '' } }, validate: false },
        async (context, req, res) => {
          return res.ok({ body: { requestId: req.id } });
        }
      );
      await server.start();

      const st = supertest(innerServer.listener);

      const resp1 = await st.get('/').set({ 'x-opaque-id': 'alpha' }).expect(200);
      expect(resp1.body).toEqual({ requestId: 'alpha' });
      const resp2 = await st.get('/').set({ 'X-Opaque-Id': 'beta' }).expect(200);
      expect(resp2.body).toEqual({ requestId: 'beta' });
      const resp3 = await st.get('/').set({ 'X-OPAQUE-ID': 'gamma' }).expect(200);
      expect(resp3.body).toEqual({ requestId: 'gamma' });
    });
  });

  describe('request uuid', () => {
    it('generates a UUID', async () => {
      const { server: innerServer, createRouter } = await server.setup(setupDeps);
      const router = createRouter('/');
      router.get(
        { path: '/', security: { authz: { enabled: false, reason: '' } }, validate: false },
        async (context, req, res) => {
          return res.ok({ body: { requestUuid: req.uuid } });
        }
      );
      await server.start();

      const st = supertest(innerServer.listener);

      const resp1 = await st.get('/').expect(200);
      expect(resp1.body.requestUuid).toBe('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx');
    });
  });

  describe('httpVersion and protocol', () => {
    it('returns the correct values', async () => {
      const { server: innerServer, createRouter } = await server.setup(setupDeps);
      const router = createRouter('/');
      router.get(
        { path: '/', security: { authz: { enabled: false, reason: '' } }, validate: false },
        async (context, req, res) => {
          return res.ok({ body: { httpVersion: req.httpVersion, protocol: req.protocol } });
        }
      );
      await server.start();

      const st = supertest(innerServer.listener);

      const resp1 = await st.get('/').expect(200);
      expect(resp1.body).toEqual({
        httpVersion: '1.1',
        protocol: 'http1',
      });
    });
  });
});
