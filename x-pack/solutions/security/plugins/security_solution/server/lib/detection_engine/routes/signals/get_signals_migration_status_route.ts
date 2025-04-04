/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { DocLinksServiceSetup } from '@kbn/core/server';
import { transformError, getIndexAliases } from '@kbn/securitysolution-es-utils';
import { buildRouteValidationWithZod } from '@kbn/zod-helpers';
import { ReadAlertsMigrationStatusRequestQuery } from '../../../../../common/api/detection_engine/signals_migration';
import type { SecuritySolutionPluginRouter } from '../../../../types';
import { DETECTION_ENGINE_SIGNALS_MIGRATION_STATUS_URL } from '../../../../../common/constants';
import { getIndexVersionsByIndex } from '../../migrations/get_index_versions_by_index';
import { getMigrationSavedObjectsByIndex } from '../../migrations/get_migration_saved_objects_by_index';
import { getSignalsIndicesInRange } from '../../migrations/get_signals_indices_in_range';
import { getSignalVersionsByIndex } from '../../migrations/get_signal_versions_by_index';
import { isOutdated, signalsAreOutdated } from '../../migrations/helpers';
import { getTemplateVersion } from '../index/check_template_version';
import { buildSiemResponse } from '../utils';

export const getSignalsMigrationStatusRoute = (
  router: SecuritySolutionPluginRouter,
  docLinks: DocLinksServiceSetup
) => {
  router.versioned
    .get({
      path: DETECTION_ENGINE_SIGNALS_MIGRATION_STATUS_URL,
      access: 'public',
      security: {
        authz: {
          requiredPrivileges: ['securitySolution'],
        },
      },
    })
    .addVersion(
      {
        version: '2023-10-31',
        validate: {
          request: { query: buildRouteValidationWithZod(ReadAlertsMigrationStatusRequestQuery) },
        },
        options: {
          deprecated: {
            documentationUrl: docLinks.links.securitySolution.signalsMigrationApi,
            severity: 'warning',
            reason: { type: 'remove' },
          },
        },
      },
      async (context, request, response) => {
        const siemResponse = buildSiemResponse(response);

        const core = await context.core;
        const securitySolution = await context.securitySolution;

        const esClient = core.elasticsearch.client.asCurrentUser;
        const soClient = core.savedObjects.client;

        try {
          const appClient = securitySolution?.getAppClient();
          if (!appClient) {
            return siemResponse.error({ statusCode: 404 });
          }
          const { from } = request.query;

          const signalsAlias = appClient.getSignalsIndex();
          const currentVersion = await getTemplateVersion({ alias: signalsAlias, esClient });
          const indexAliases = await getIndexAliases({
            alias: signalsAlias,
            esClient,
            index: `${signalsAlias}-*`,
          });
          const signalsIndices = indexAliases.map((indexAlias) => indexAlias.index);
          const indicesInRange = await getSignalsIndicesInRange({
            esClient,
            index: signalsIndices,
            from,
          });
          const migrationsByIndex = await getMigrationSavedObjectsByIndex({
            index: indicesInRange,
            soClient,
          });
          const indexVersionsByIndex = await getIndexVersionsByIndex({
            esClient,
            index: indicesInRange,
          });
          const signalVersionsByIndex = await getSignalVersionsByIndex({
            esClient,
            index: indicesInRange,
          });

          const indexStatuses = indicesInRange.map((index) => {
            const version = indexVersionsByIndex[index] ?? 0;
            const signalVersions = signalVersionsByIndex[index] ?? [];
            const migrations = migrationsByIndex[index] ?? [];

            return {
              index,
              version,
              signal_versions: signalVersions,
              migrations: migrations.map((m) => ({
                id: m.id,
                status: m.attributes.status,
                version: m.attributes.version,
                updated: m.attributes.updated,
              })),
              is_outdated:
                isOutdated({ current: version, target: currentVersion }) ||
                signalsAreOutdated({ signalVersions, target: currentVersion }),
            };
          });

          return response.ok({ body: { indices: indexStatuses } });
        } catch (err) {
          const error = transformError(err);
          return siemResponse.error({
            body: error.message,
            statusCode: error.statusCode,
          });
        }
      }
    );
};
