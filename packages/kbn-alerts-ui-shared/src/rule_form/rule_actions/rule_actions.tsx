/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import React, { useCallback, useState } from 'react';
import { EuiButton, EuiSpacer, EuiFlexGroup, EuiFlexItem, EuiLoadingSpinner } from '@elastic/eui';
import { v4 as uuidv4 } from 'uuid';
import { RuleCreationValidConsumer } from '@kbn/rule-data-utils';
import { ADD_ACTION_TEXT } from '../translations';
import { ConnectorTypeModal } from '../../connector_type_modal';
import { useLoadActionTypes, useLoadConnectors } from '../../common/hooks';
import { useRuleFormDispatch, useRuleFormState } from '../hooks';
import { ActionConnector } from '../../common/types';
import { DEFAULT_FREQUENCY } from '../constants';
import { RuleActionItem } from './rule_action_item';

export interface RuleActionsProps {
  validConsumers?: RuleCreationValidConsumer[];
}

export const RuleActions = (props: RuleActionsProps) => {
  const { validConsumers } = props;

  const [isConnectorModalOpen, setIsConnectorModalOpen] = useState<boolean>(false);

  const {
    plugins: { http },
    formData: { actions },
    selectedRuleType,
  } = useRuleFormState();

  const dispatch = useRuleFormDispatch();

  const { data: connectors, isLoading: isLoadingConnectors } = useLoadConnectors({ http });

  const { data: actionTypes, isLoading: isLoadingActionTypes } = useLoadActionTypes({ http });

  const onModalOpen = useCallback(() => {
    setIsConnectorModalOpen(true);
  }, []);

  const onModalClose = useCallback(() => {
    setIsConnectorModalOpen(false);
  }, []);

  const onSelectConnector = useCallback(
    (connector: ActionConnector) => {
      const { id, actionTypeId } = connector;
      dispatch({
        type: 'addAction',
        payload: {
          id,
          actionTypeId,
          uuid: uuidv4(),
          params: {},
          group: selectedRuleType.defaultActionGroupId,
          frequency: DEFAULT_FREQUENCY,
        },
      });
      onModalClose();
    },
    [dispatch, onModalClose, selectedRuleType]
  );

  const isLoading = isLoadingConnectors || isLoadingActionTypes;

  if (isLoading) {
    return <EuiLoadingSpinner />;
  }

  return (
    <>
      <EuiFlexGroup direction="column">
        {actions.map((action, index) => {
          return (
            <EuiFlexItem>
              <RuleActionItem
                action={action}
                index={index}
                connectors={connectors || []}
                actionTypes={actionTypes || []}
                validConsumers={validConsumers}
              />
            </EuiFlexItem>
          );
        })}
      </EuiFlexGroup>
      <EuiSpacer />
      <EuiButton
        iconType="push"
        iconSide="left"
        onClick={onModalOpen}
        disabled={isLoading}
        isLoading={isLoading}
      >
        {ADD_ACTION_TEXT}
      </EuiButton>
      {isConnectorModalOpen && (
        <ConnectorTypeModal
          onClose={onModalClose}
          onSelectConnector={onSelectConnector}
          connectors={connectors || []}
          actionTypes={actionTypes || []}
        />
      )}
    </>
  );
};
