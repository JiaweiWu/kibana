/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { HttpSetup } from '@kbn/core/public';
import { pick } from 'lodash';
import { RewriteResponseCase, AsApiContract } from '@kbn/actions-types';
import { Rule } from '@kbn/alerting-types';
import { RuleFormData } from '../../rule_form';
import { BASE_ALERTING_API_PATH } from '../constants';
import { transformRule } from '../utils';

export const UPDATE_FIELDS: Array<keyof RuleFormData> = [
  'actions',
  'name',
  'tags',
  'schedule',
  'params',
  'alertDelay',
];

export const rewriteUpdateBodyRequest: RewriteResponseCase<RuleFormData> = ({
  actions,
  alertDelay,
  ...res
}): any => ({
  ...res,
  actions: actions.map((action) => {
    const { id, params, uuid } = action;
    return {
      ...('group' in action ? { group: action.group } : {}),
      id,
      params,
      ...('frequency' in action
        ? {
            frequency: action.frequency
              ? {
                  notify_when: action.frequency!.notifyWhen,
                  throttle: action.frequency!.throttle,
                  summary: action.frequency!.summary,
                }
              : undefined,
          }
        : {}),
      ...('alertsFilter' in action &&
      Object.values(action.alertsFilter || {}).some((value) => value)
        ? { alerts_filter: action.alertsFilter }
        : {}),
      ...('useAlertDataForTemplate' in action &&
      typeof action.useAlertDataForTemplate !== 'undefined'
        ? { use_alert_data_for_template: action.useAlertDataForTemplate }
        : {}),
      ...(uuid && { uuid }),
    };
  }),
  ...(alertDelay ? { alert_delay: alertDelay } : {}),
});

export async function updateRule({
  http,
  rule,
  id,
}: {
  http: HttpSetup;
  rule: RuleFormData;
  id: string;
}): Promise<Rule> {
  const res = await http.put<AsApiContract<Rule>>(
    `${BASE_ALERTING_API_PATH}/rule/${encodeURIComponent(id)}`,
    {
      body: JSON.stringify(rewriteUpdateBodyRequest(pick(rule, UPDATE_FIELDS))),
    }
  );
  return transformRule(res);
}
