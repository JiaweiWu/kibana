/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { ElasticsearchClient, Logger } from '@kbn/core/server';

import type { RouteDefinitionParams } from '..';
import { createLicensedRouteHandler } from '../licensed_route_handler';

interface NodeSettingsResponse {
  nodes: {
    [nodeId: string]: {
      settings: {
        script: {
          allowed_types?: string[];
          allowed_contexts?: string[];
        };
      };
    };
  };
}

interface XPackUsageResponse {
  remote_clusters?: {
    size: number;
  };
  security: {
    realms: {
      [realmName: string]: {
        available: boolean;
        enabled: boolean;
      };
    };
  };
}

const INCOMPATIBLE_REALMS = ['file', 'native'];

export function defineSecurityFeatureCheckRoute({ router, logger }: RouteDefinitionParams) {
  router.get(
    {
      path: '/internal/security/_check_security_features',
      security: {
        authz: {
          enabled: false,
          reason: `This route delegates authorization to Core's scoped ES cluster client`,
        },
      },
      validate: false,
    },
    createLicensedRouteHandler(async (context, request, response) => {
      const esClient = (await context.core).elasticsearch.client;
      const { has_all_requested: canReadSecurity } =
        await esClient.asCurrentUser.security.hasPrivileges({
          cluster: ['read_security'],
        });

      if (!canReadSecurity) {
        return response.ok({
          body: {
            canReadSecurity,
          },
        });
      }

      const enabledFeatures = await getEnabledSecurityFeatures(esClient.asInternalUser, logger);

      return response.ok({
        body: {
          ...enabledFeatures,
          canReadSecurity,
        },
      });
    })
  );
}

async function getEnabledSecurityFeatures(esClient: ElasticsearchClient, logger: Logger) {
  logger.debug(`Retrieving security features`);

  const nodeScriptSettingsPromise = esClient.nodes
    .info({ filter_path: 'nodes.*.settings.script' })
    .catch((error) => {
      // fall back to assuming that node settings are unset/at their default values.
      // this will allow the UI to permit both role template script types,
      // even if ES will disallow it at mapping evaluation time.
      logger.error(`Error retrieving node settings for security feature check: ${error}`);
      return {};
    });

  // `transport.request` is potentially unsafe when combined with untrusted user input.
  // Do not augment with such input.
  const xpackUsagePromise = esClient.transport
    .request({
      method: 'GET',
      path: '/_xpack/usage?filter_path=remote_clusters.*,security.realms.*',
    })
    .then((body) => body as XPackUsageResponse)
    .catch((error) => {
      // fall back to no external realms configured.
      // this will cause a warning in the UI about no compatible realms being enabled, but will otherwise allow
      // the mappings screen to function correctly.
      logger.error(`Error retrieving XPack usage info for security feature check: ${error}`);
      return {
        security: {
          realms: {},
        },
      } as XPackUsageResponse;
    });

  const [nodeScriptSettings, xpackUsage] = await Promise.all([
    nodeScriptSettingsPromise,
    xpackUsagePromise,
  ]);

  let canUseStoredScripts = true;
  let canUseInlineScripts = true;
  if (usesCustomScriptSettings(nodeScriptSettings)) {
    canUseStoredScripts = Object.values(nodeScriptSettings.nodes).some((node) => {
      const allowedTypes = node.settings.script.allowed_types;
      return !allowedTypes || allowedTypes.includes('stored');
    });

    canUseInlineScripts = Object.values(nodeScriptSettings.nodes).some((node) => {
      const allowedTypes = node.settings.script.allowed_types;
      return !allowedTypes || allowedTypes.includes('inline');
    });
  }

  const hasCompatibleRealms = Object.entries(xpackUsage.security.realms).some(
    ([realmName, realm]) => {
      return !INCOMPATIBLE_REALMS.includes(realmName) && realm.available && realm.enabled;
    }
  );

  return {
    hasCompatibleRealms,
    canUseStoredScripts,
    canUseInlineScripts,
    canUseRemoteIndices: Boolean(xpackUsage.remote_clusters),
    canUseRemoteClusters: Boolean(xpackUsage.remote_clusters),
  };
}

function usesCustomScriptSettings(
  nodeResponse: NodeSettingsResponse | {}
): nodeResponse is NodeSettingsResponse {
  return Object.hasOwn(nodeResponse, 'nodes');
}
