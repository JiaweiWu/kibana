/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { Fragment } from 'react';
import moment from 'moment';
import { uniq, get } from 'lodash';
import {
  EuiLink,
  EuiPage,
  EuiPageBody,
  EuiSpacer,
  EuiScreenReaderOnly,
  EuiPanel,
} from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import { FormattedMessage } from '@kbn/i18n-react';
import { EuiMonitoringTable } from '../../table';
import { Status } from './status';
import { formatMetric } from '../../../lib/format_number';
import { getSafeForExternalLink } from '../../../lib/get_safe_for_external_link';
import { formatTimestampToDuration } from '../../../../common';
import { APM_SYSTEM_ID } from '../../../../common/constants';
import { ListingCallOut } from '../../setup_mode/listing_callout';
import { SetupModeBadge } from '../../setup_mode/badge';
import { isSetupModeFeatureEnabled } from '../../../lib/setup_mode';
import { SetupModeFeature } from '../../../../common/enums';
import type { AlertsByName } from '../../../alerts/types';
import type { Sorting, Pagination, TableChange } from '../../../application/hooks/use_table';
import type { SetupMode } from '../../setup_mode/types';

function getColumns(setupMode: SetupMode, cgroup: unknown) {
  const memoryField = cgroup
    ? {
        name: i18n.translate('xpack.monitoring.apm.instances.cgroupMemoryUsageTitle', {
          defaultMessage: 'Memory Usage (cgroup)',
        }),
        field: 'cgroup_memory',
        render: (value: number) => formatMetric(value, 'byte'),
      }
    : {
        name: i18n.translate('xpack.monitoring.apm.instances.allocatedMemoryTitle', {
          defaultMessage: 'Allocated Memory',
        }),
        field: 'memory',
        render: (value: number) => formatMetric(value, 'byte'),
      };
  return [
    {
      name: i18n.translate('xpack.monitoring.apm.instances.nameTitle', {
        defaultMessage: 'Name',
      }),
      field: 'name',
      render: (name: string, apm: { uuid: string; name: string }) => {
        let setupModeStatus = null;
        if (isSetupModeFeatureEnabled(SetupModeFeature.MetricbeatMigration)) {
          const list = get(setupMode, 'data.byUuid', {});
          const status = list[apm.uuid] || {};
          const instance = {
            uuid: apm.uuid,
            name: apm.name,
          };

          setupModeStatus = (
            <SetupModeBadge
              setupMode={setupMode}
              status={status}
              instance={instance}
              productName={APM_SYSTEM_ID}
            />
          );
        }

        return (
          <Fragment>
            <EuiLink
              href={getSafeForExternalLink(`#/apm/instances/${apm.uuid}`)}
              data-test-subj={`apmLink-${name}`}
            >
              {name}
            </EuiLink>
            {setupModeStatus}
          </Fragment>
        );
      },
    },
    {
      name: i18n.translate('xpack.monitoring.apm.instances.outputEnabledTitle', {
        defaultMessage: 'Output Enabled',
      }),
      field: 'output',
    },
    {
      name: i18n.translate('xpack.monitoring.apm.instances.totalEventsRateTitle', {
        defaultMessage: 'Total Events Rate',
      }),
      field: 'total_events_rate',
      render: (value: number) => formatMetric(value, '', '/s'),
    },
    {
      name: i18n.translate('xpack.monitoring.apm.instances.bytesSentRateTitle', {
        defaultMessage: 'Bytes Sent Rate',
      }),
      field: 'bytes_sent_rate',
      render: (value: number) => formatMetric(value, 'byte', '/s'),
    },
    {
      name: i18n.translate('xpack.monitoring.apm.instances.outputErrorsTitle', {
        defaultMessage: 'Output Errors',
      }),
      field: 'errors',
      render: (value: string) => formatMetric(value, '0'),
    },
    {
      name: i18n.translate('xpack.monitoring.apm.instances.lastEventTitle', {
        defaultMessage: 'Last Event',
      }),
      field: 'time_of_last_event',
      render: (value: number) =>
        i18n.translate('xpack.monitoring.apm.instances.lastEventValue', {
          defaultMessage: '{timeOfLastEvent} ago',
          values: {
            timeOfLastEvent: formatTimestampToDuration(+moment(value), 'since'),
          },
        }),
    },
    memoryField,
    {
      name: i18n.translate('xpack.monitoring.apm.instances.versionTitle', {
        defaultMessage: 'Version',
      }),
      field: 'version',
    },
  ];
}

interface Props {
  apms: {
    data: {
      apms: Array<{
        version: string;
      }>;
      cgroup: unknown;
      stats: unknown;
    };
    pagination: Pagination;
    sorting: Sorting;
    onTableChange: (e: TableChange) => void;
  };
  setupMode: SetupMode;
  alerts?: AlertsByName;
}
export function ApmServerInstances({ apms, setupMode, alerts }: Props) {
  const { pagination, sorting, onTableChange, data } = apms;

  let setupModeCallout = null;
  if (isSetupModeFeatureEnabled(SetupModeFeature.MetricbeatMigration)) {
    setupModeCallout = (
      <ListingCallOut setupModeData={setupMode.data} productName={APM_SYSTEM_ID} />
    );
  }

  const versions = uniq(data.apms.map((item) => item.version)).map((version) => {
    return { value: version };
  });

  return (
    <EuiPage>
      <EuiPageBody>
        <EuiScreenReaderOnly>
          <h1>
            <FormattedMessage
              id="xpack.monitoring.apm.instances.heading"
              defaultMessage="APM Instances"
            />
          </h1>
        </EuiScreenReaderOnly>
        <EuiPanel>
          <Status stats={data.stats} alerts={alerts} />
        </EuiPanel>
        <EuiSpacer size="m" />
        <EuiPanel>
          {setupModeCallout}
          <EuiMonitoringTable
            data-test-subj="apmInstancesTable"
            rows={data.apms}
            columns={getColumns(setupMode, data.cgroup)}
            sorting={sorting}
            pagination={pagination}
            setupMode={setupMode}
            productName={APM_SYSTEM_ID}
            search={{
              box: {
                incremental: true,
                placeholder: i18n.translate(
                  'xpack.monitoring.apm.instances.filterInstancesPlaceholder',
                  {
                    defaultMessage: 'Filter Instances…',
                  }
                ),
              },
              filters: [
                {
                  type: 'field_value_selection',
                  field: 'version',
                  name: i18n.translate('xpack.monitoring.apm.instances.versionFilter', {
                    defaultMessage: 'Version',
                  }),
                  options: versions,
                  multiSelect: 'or',
                },
              ],
            }}
            onTableChange={onTableChange}
            executeQueryOptions={{
              defaultFields: ['name'],
            }}
          />
        </EuiPanel>
      </EuiPageBody>
    </EuiPage>
  );
}
