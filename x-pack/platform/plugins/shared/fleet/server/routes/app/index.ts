/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { RequestHandler } from '@kbn/core/server';
import type { TypeOf } from '@kbn/config-schema';
import { schema } from '@kbn/config-schema';

import { parseExperimentalConfigValue } from '../../../common/experimental_features';
import type { FleetAuthzRouter } from '../../services/security';
import { APP_API_ROUTES } from '../../constants';
import { API_VERSIONS } from '../../../common/constants';
import { appContextService } from '../../services';
import type { CheckPermissionsResponse, GenerateServiceTokenResponse } from '../../../common/types';
import { GenerateServiceTokenError } from '../../errors';
import type { FleetRequestHandler } from '../../types';
import { CheckPermissionsRequestSchema, CheckPermissionsResponseSchema } from '../../types';
import { enableSpaceAwarenessMigration } from '../../services/spaces/enable_space_awareness';
import { type FleetConfigType } from '../../config';
import { genericErrorResponse } from '../schema/errors';
import { FLEET_API_PRIVILEGES } from '../../constants/api_privileges';

export const getCheckPermissionsHandler: FleetRequestHandler<
  unknown,
  TypeOf<typeof CheckPermissionsRequestSchema.query>
> = async (context, request, response) => {
  const missingSecurityBody: CheckPermissionsResponse = {
    success: false,
    error: 'MISSING_SECURITY',
  };

  const isServerless = appContextService.getCloud()?.isServerlessEnabled;

  if (!appContextService.getSecurityLicense().isEnabled()) {
    return response.ok({ body: missingSecurityBody });
  } else {
    const fleetContext = await context.fleet;
    if (
      !fleetContext.authz.fleet.all &&
      !fleetContext.authz.fleet.readAgents &&
      !fleetContext.authz.fleet.readAgentPolicies &&
      !fleetContext.authz.fleet.readSettings
    ) {
      return response.ok({
        body: {
          success: false,
          error: 'MISSING_PRIVILEGES',
        } as CheckPermissionsResponse,
      });
    }
    // check the manage_service_account cluster privilege only on stateful
    else if (request.query.fleetServerSetup && !isServerless) {
      const esClient = (await context.core).elasticsearch.client.asCurrentUser;
      const { has_all_requested: hasAllPrivileges } = await esClient.security.hasPrivileges({
        cluster: ['manage_service_account'],
      });

      if (!hasAllPrivileges) {
        return response.ok({
          body: {
            success: false,
            error: 'MISSING_FLEET_SERVER_SETUP_PRIVILEGES',
          } as CheckPermissionsResponse,
        });
      }
    }

    return response.ok({ body: { success: true } as CheckPermissionsResponse });
  }
};

export const postEnableSpaceAwarenessHandler: FleetRequestHandler = async (
  context,
  request,
  response
) => {
  await enableSpaceAwarenessMigration();

  return response.ok({
    body: {},
  });
};

export const generateServiceTokenHandler: RequestHandler<
  null,
  null,
  TypeOf<typeof GenerateServiceTokenRequestSchema.body>
> = async (context, request, response) => {
  // Generate the fleet server service token as the current user as the internal user do not have the correct permissions
  const esClient = (await context.core).elasticsearch.client.asCurrentUser;
  const serviceAccount = request.body?.remote ? 'fleet-server-remote' : 'fleet-server';
  appContextService
    .getLogger()
    .debug(`Creating service token for account elastic/${serviceAccount}`);
  try {
    const tokenResponse = await esClient.transport.request<{
      created?: boolean;
      token?: GenerateServiceTokenResponse;
    }>({
      method: 'POST',
      path: `_security/service/elastic/${serviceAccount}/credential/token/token-${Date.now()}`,
    });

    if (tokenResponse.created && tokenResponse.token) {
      const body: GenerateServiceTokenResponse = tokenResponse.token;
      return response.ok({
        body,
      });
    } else {
      const error = new GenerateServiceTokenError('Unable to generate service token');
      throw error;
    }
  } catch (e) {
    const error = new GenerateServiceTokenError(e);
    throw error;
  }
};

export const getAgentPoliciesSpacesHandler: FleetRequestHandler<
  null,
  null,
  TypeOf<typeof GenerateServiceTokenRequestSchema.body>
> = async (context, request, response) => {
  const spaces = await (await context.fleet).getAllSpaces();
  const security = appContextService.getSecurity();
  const spaceIds = spaces.map(({ id }) => id);
  const res = await security.authz.checkPrivilegesWithRequest(request).atSpaces(spaceIds, {
    kibana: [security.authz.actions.api.get(`fleet-agent-policies-all`)],
  });

  const authorizedSpaces = spaces.filter(
    (space) =>
      res.privileges.kibana.find((privilege) => privilege.resource === space.id)?.authorized ??
      false
  );

  return response.ok({
    body: {
      items: authorizedSpaces,
    },
  });
};

export const GenerateServiceTokenRequestSchema = {
  body: schema.nullable(
    schema.object({
      remote: schema.boolean({ defaultValue: false }),
    })
  ),
};

export const GenerateServiceTokenResponseSchema = schema.object({
  name: schema.string(),
  value: schema.string(),
});

export const registerRoutes = (router: FleetAuthzRouter, config: FleetConfigType) => {
  const experimentalFeatures = parseExperimentalConfigValue(config.enableExperimental);
  router.versioned
    .get({
      path: '/internal/fleet/telemetry/usage',
      access: 'internal',
      security: {
        authz: {
          requiredPrivileges: [
            FLEET_API_PRIVILEGES.AGENTS.ALL,
            FLEET_API_PRIVILEGES.AGENT_POLICIES.ALL,
            FLEET_API_PRIVILEGES.SETTINGS.ALL,
          ],
        },
      },
    })
    .addVersion(
      {
        version: API_VERSIONS.internal.v1,
        validate: {},
      },
      getTelemetryUsageHandler
    );
  if (experimentalFeatures.useSpaceAwareness) {
    router.versioned
      .post({
        path: APP_API_ROUTES.SPACE_AWARENESS_MIGRATION,
        access: 'internal',
        security: {
          authz: {
            requiredPrivileges: [
              FLEET_API_PRIVILEGES.AGENTS.ALL,
              FLEET_API_PRIVILEGES.AGENT_POLICIES.ALL,
              FLEET_API_PRIVILEGES.SETTINGS.ALL,
            ],
          },
        },
      })
      .addVersion(
        {
          version: API_VERSIONS.internal.v1,
          validate: {},
        },
        postEnableSpaceAwarenessHandler
      );
  }
  router.versioned
    .get({
      path: APP_API_ROUTES.CHECK_PERMISSIONS_PATTERN,
      summary: `Check permissions`,
      options: {
        tags: ['oas-tag:Fleet internals'],
      },
      security: {
        authz: {
          enabled: false,
          reason: `This route performs its own authorization checks.`,
        },
      },
    })
    .addVersion(
      {
        version: API_VERSIONS.public.v1,
        validate: {
          request: CheckPermissionsRequestSchema,
          response: {
            200: {
              body: () => CheckPermissionsResponseSchema,
            },
            400: {
              body: genericErrorResponse,
            },
          },
        },
      },
      getCheckPermissionsHandler
    );

  router.versioned
    .get({
      path: APP_API_ROUTES.AGENT_POLICIES_SPACES,
      access: 'internal',
      security: {
        authz: {
          requiredPrivileges: [FLEET_API_PRIVILEGES.AGENT_POLICIES.READ],
        },
      },
    })
    .addVersion(
      {
        version: API_VERSIONS.internal.v1,
        validate: {},
      },
      getAgentPoliciesSpacesHandler
    );

  router.versioned
    .post({
      path: APP_API_ROUTES.GENERATE_SERVICE_TOKEN_PATTERN,
      security: {
        authz: {
          requiredPrivileges: [FLEET_API_PRIVILEGES.AGENTS.ALL],
        },
      },
      summary: `Create a service token`,
      options: {
        tags: ['oas-tag:Fleet service tokens'],
      },
    })
    .addVersion(
      {
        version: API_VERSIONS.public.v1,
        validate: {
          request: GenerateServiceTokenRequestSchema,
          response: {
            200: {
              body: () => GenerateServiceTokenResponseSchema,
            },
            400: {
              body: genericErrorResponse,
            },
          },
        },
      },
      generateServiceTokenHandler
    );
};
const getTelemetryUsageHandler: FleetRequestHandler = async (context, request, response) => {
  const fetchUsage = appContextService.getFetchUsage();
  if (!fetchUsage) {
    throw new Error('Fetch usage is not initialized.');
  }
  const usage = await fetchUsage(new AbortController());

  return response.ok({
    body: {
      usage,
    },
  });
};
