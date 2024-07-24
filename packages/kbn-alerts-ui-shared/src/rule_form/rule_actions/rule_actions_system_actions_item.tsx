/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import React, { Suspense, useCallback, useMemo, useState } from 'react';
import { i18n } from '@kbn/i18n';
import { isEmpty, some } from 'lodash';
import { SavedObjectAttribute } from '@kbn/core-saved-objects-api-server';
import {
  EuiAccordion,
  EuiBadge,
  EuiBetaBadge,
  EuiButtonIcon,
  EuiFlexGroup,
  EuiFlexItem,
  EuiIcon,
  EuiPanel,
  EuiText,
  EuiToolTip,
  useEuiBackgroundColor,
  useEuiTheme,
} from '@elastic/eui';
import { ActionVariable, RuleActionParam, RuleSystemAction } from '@kbn/alerting-types';
import { css } from '@emotion/react';
import { ActionType } from '@kbn/actions-types';
import { useRuleFormDispatch, useRuleFormState } from '../hooks';
import { ActionConnector, RuleFormParamsErrors } from '../../common';
import {
  ACTION_ERROR_TOOLTIP,
  ACTION_WARNING_TITLE,
  TECH_PREVIEW_DESCRIPTION,
  TECH_PREVIEW_LABEL,
} from '../translations';
import { RuleActionsMessage } from './rule_actions_message';
import { validateParamsForWarnings } from '../validation';
import { getAvailableActionVariables } from '../../action_variables';

interface RuleActionsSystemActionsItemProps {
  action: RuleSystemAction;
  index: number;
  producerId: string;
  aadTemplateFields: ActionVariable[];
  connectors: ActionConnector[];
  actionTypes: ActionType[];
}

export const RuleActionsSystemActionsItem = (props: RuleActionsSystemActionsItemProps) => {
  const { action, index, aadTemplateFields, connectors, actionTypes, producerId } = props;

  const {
    plugins: { actionTypeRegistry, http },
    actionsParamsErrors = {},
    selectedRuleType,
  } = useRuleFormState();

  const [isOpen, setIsOpen] = useState(true);
  const [storedActionParamsForAadToggle, setStoredActionParamsForAadToggle] = useState<
    Record<string, SavedObjectAttribute>
  >({});
  const [warning, setWarning] = useState<string | null>(null);

  const subdued = useEuiBackgroundColor('subdued');
  const plain = useEuiBackgroundColor('plain');
  const { euiTheme } = useEuiTheme();

  const dispatch = useRuleFormDispatch();
  const actionTypeModel = actionTypeRegistry.get(action.actionTypeId);
  const actionType = actionTypes.find(({ id }) => id === action.actionTypeId)!;
  const connector = connectors.find(({ id }) => id === action.id)!;

  const actionParamsError = actionsParamsErrors[action.uuid!] || {};

  const availableActionVariables = useMemo(() => {
    const messageVariables = selectedRuleType.actionVariables;

    return messageVariables
      ? getAvailableActionVariables(messageVariables, undefined, undefined, true)
      : [];
  }, [selectedRuleType]);

  const showActionGroupErrorIcon = (): boolean => {
    return !isOpen && some(actionParamsError, (error) => !isEmpty(error));
  };

  const onDelete = (id: string) => {
    dispatch({ type: 'removeAction', payload: id });
  };

  const onStoredActionParamsChange = useCallback(
    (
      aadParams: Record<string, SavedObjectAttribute>,
      params: Record<string, SavedObjectAttribute>
    ) => {
      if (isEmpty(aadParams) && action.params.subAction) {
        setStoredActionParamsForAadToggle(params);
      } else {
        setStoredActionParamsForAadToggle(aadParams);
      }
    },
    [action]
  );

  const validateActionParams = useCallback(
    async (params: RuleActionParam) => {
      const res: { errors: RuleFormParamsErrors } = await actionTypeRegistry
        .get(action.actionTypeId)
        ?.validateParams(params);

      dispatch({
        type: 'setActionParamsError',
        payload: {
          uuid: action.uuid!,
          errors: res.errors,
        },
      });
    },
    [actionTypeRegistry, action, dispatch]
  );

  const onParamsChange = useCallback(
    (key: string, value: RuleActionParam) => {
      const newParams = {
        ...action.params,
        [key]: value,
      };

      dispatch({
        type: 'setActionParams',
        payload: {
          uuid: action.uuid!,
          value: newParams,
        },
      });
      setWarning(
        validateParamsForWarnings({
          value,
          publicBaseUrl: http.basePath.publicBaseUrl,
          actionVariables: availableActionVariables,
        })
      );
      validateActionParams(newParams);
      onStoredActionParamsChange(storedActionParamsForAadToggle, newParams);
    },
    [
      http,
      action,
      availableActionVariables,
      dispatch,
      validateActionParams,
      onStoredActionParamsChange,
      storedActionParamsForAadToggle,
    ]
  );

  return (
    <EuiAccordion
      data-test-subj="ruleActionsSystemActionsItem"
      initialIsOpen
      borders="all"
      style={{
        backgroundColor: subdued,
        borderRadius: euiTheme.border.radius.medium,
      }}
      id={action.id}
      onToggle={setIsOpen}
      buttonProps={{
        style: {
          width: '100%',
        },
      }}
      arrowProps={{
        css: css`
          margin-left: ${euiTheme.size.m};
        `,
      }}
      extraAction={
        <EuiButtonIcon
          data-test-subj="ruleActionsSystemActionsItemDeleteActionButton"
          style={{
            marginRight: euiTheme.size.l,
          }}
          aria-label={i18n.translate(
            'alertsUIShared.ruleActionsSystemActionsItem.deleteActionAriaLabel',
            {
              defaultMessage: 'delete action',
            }
          )}
          iconType="trash"
          color="danger"
          onClick={() => onDelete(action.uuid!)}
        />
      }
      buttonContentClassName="eui-fullWidth"
      buttonContent={
        <EuiPanel
          data-test-subj="ruleActionsSystemActionsItemAccordionButton"
          color="subdued"
          paddingSize="m"
        >
          <EuiFlexGroup alignItems="center">
            <EuiFlexItem grow={false}>
              {showActionGroupErrorIcon() ? (
                <EuiToolTip content={ACTION_ERROR_TOOLTIP}>
                  <EuiIcon
                    data-test-subj="action-group-error-icon"
                    type="warning"
                    color="danger"
                    size="l"
                  />
                </EuiToolTip>
              ) : (
                <Suspense fallback={null}>
                  <EuiIcon size="l" type={actionTypeModel.iconClass} />
                </Suspense>
              )}
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiText>{connector.name}</EuiText>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiText size="s" color="subdued">
                <strong>{actionType?.name}</strong>
              </EuiText>
            </EuiFlexItem>
            {warning && !isOpen && (
              <EuiFlexItem grow={false}>
                <EuiBadge data-test-subj="warning-badge" iconType="warning" color="warning">
                  {ACTION_WARNING_TITLE}
                </EuiBadge>
              </EuiFlexItem>
            )}
            {actionTypeModel.isExperimental && (
              <EuiFlexItem grow={false}>
                <EuiBetaBadge
                  alignment="middle"
                  data-test-subj="ruleActionsSystemActionsItemBetaBadge"
                  label={TECH_PREVIEW_LABEL}
                  tooltipContent={TECH_PREVIEW_DESCRIPTION}
                />
              </EuiFlexItem>
            )}
          </EuiFlexGroup>
        </EuiPanel>
      }
    >
      <EuiFlexGroup
        data-test-subj="ruleActionsSystemActionsItemAccordionContent"
        direction="column"
        style={{
          padding: euiTheme.size.l,
          backgroundColor: plain,
        }}
      >
        <EuiFlexItem>
          <RuleActionsMessage
            useDefaultMessage
            action={action}
            actionTypes={actionTypes}
            index={index}
            templateFields={aadTemplateFields}
            connector={connector}
            producerId={producerId}
            warning={warning}
            onParamsChange={onParamsChange}
          />
        </EuiFlexItem>
      </EuiFlexGroup>
    </EuiAccordion>
  );
};
