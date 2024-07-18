/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RuleActionsConnectorsModal } from './rule_actions_connectors_modal';
import { ActionConnector, ActionTypeModel } from '../../common';
import { ActionType } from '@kbn/actions-types';
import { TypeRegistry } from '../../common/type_registry';
import {
  getActionType,
  getActionTypeModel,
  getConnector,
} from '../../common/test_utils/actions_test_utils';

jest.mock('../hooks', () => ({
  useRuleFormState: jest.fn(),
  useRuleFormDispatch: jest.fn(),
}));

const { useRuleFormState, useRuleFormDispatch } = jest.requireMock('../hooks');

const mockConnectors: ActionConnector[] = [getConnector('1'), getConnector('2')];

const mockActionTypes: ActionType[] = [getActionType('1'), getActionType('2')];

const mockOnClose = jest.fn();

const mockOnSelectConnector = jest.fn();

const mockOnChange = jest.fn();

describe('ruleActionsConnectorsModal', () => {
  beforeEach(() => {
    const actionTypeRegistry = new TypeRegistry<ActionTypeModel>();
    actionTypeRegistry.register(getActionTypeModel('1', { id: 'actionType-1' }));
    actionTypeRegistry.register(getActionTypeModel('2', { id: 'actionType-2' }));

    useRuleFormState.mockReturnValue({
      plugins: {
        actionTypeRegistry,
      },
      formData: {
        actions: [],
      },
    });
    useRuleFormDispatch.mockReturnValue(mockOnChange);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('renders correctly', () => {
    render(
      <RuleActionsConnectorsModal
        connectors={mockConnectors}
        actionTypes={mockActionTypes}
        onClose={mockOnClose}
        onSelectConnector={mockOnSelectConnector}
      />
    );
    expect(screen.getByTestId('ruleActionsConnectorsModal'));
  });

  test('should render connectors and filters', () => {
    render(
      <RuleActionsConnectorsModal
        connectors={mockConnectors}
        actionTypes={mockActionTypes}
        onClose={mockOnClose}
        onSelectConnector={mockOnSelectConnector}
      />
    );

    expect(screen.getByText('connector-1')).toBeInTheDocument();
    expect(screen.getByText('connector-2')).toBeInTheDocument();

    expect(screen.getByTestId('ruleActionsConnectorsModalSearch')).toBeInTheDocument();
    expect(screen.getAllByTestId('ruleActionsConnectorsModalFilterButton').length).toEqual(3);

    const filterButtonGroup = screen.getByTestId('ruleActionsConnectorsModalFilterButtonGroup');
    expect(within(filterButtonGroup).getByText('actionType: 1')).toBeInTheDocument();
    expect(within(filterButtonGroup).getByText('actionType: 2')).toBeInTheDocument();
    expect(within(filterButtonGroup).getByText('All')).toBeInTheDocument();
  });

  test('should allow for searching of connectors', () => {
    render(
      <RuleActionsConnectorsModal
        connectors={mockConnectors}
        actionTypes={mockActionTypes}
        onClose={mockOnClose}
        onSelectConnector={mockOnSelectConnector}
      />
    );

    userEvent.type(screen.getByTestId('ruleActionsConnectorsModalSearch'), 'connector-1');
    expect(screen.getAllByTestId('ruleActionsConnectorsModalCard').length).toEqual(1);
    expect(screen.getByText('connector-1')).toBeInTheDocument();

    userEvent.clear(screen.getByTestId('ruleActionsConnectorsModalSearch'));

    userEvent.type(screen.getByTestId('ruleActionsConnectorsModalSearch'), 'actionType: 2');
    expect(screen.getAllByTestId('ruleActionsConnectorsModalCard').length).toEqual(1);
    expect(screen.getByText('connector-2')).toBeInTheDocument();

    userEvent.clear(screen.getByTestId('ruleActionsConnectorsModalSearch'));

    userEvent.type(screen.getByTestId('ruleActionsConnectorsModalSearch'), 'doesntexist');
    expect(screen.getByTestId('ruleActionsConnectorsModalEmpty')).toBeInTheDocument();

    userEvent.click(screen.getByTestId('ruleActionsConnectorsModalClearFiltersButton'));
    expect(screen.getAllByTestId('ruleActionsConnectorsModalCard').length).toEqual(2);
  });

  test('should allow for filtering of connectors', () => {
    render(
      <RuleActionsConnectorsModal
        connectors={mockConnectors}
        actionTypes={mockActionTypes}
        onClose={mockOnClose}
        onSelectConnector={mockOnSelectConnector}
      />
    );

    const filterButtonGroup = screen.getByTestId('ruleActionsConnectorsModalFilterButtonGroup');
    userEvent.click(within(filterButtonGroup).getByText('actionType: 1'));
    expect(screen.getAllByTestId('ruleActionsConnectorsModalCard').length).toEqual(1);
    expect(screen.getByText('connector-1')).toBeInTheDocument();

    userEvent.click(within(filterButtonGroup).getByText('actionType: 2'));
    expect(screen.getAllByTestId('ruleActionsConnectorsModalCard').length).toEqual(1);
    expect(screen.getByText('connector-2')).toBeInTheDocument();

    userEvent.click(within(filterButtonGroup).getByText('All'));
    expect(screen.getAllByTestId('ruleActionsConnectorsModalCard').length).toEqual(2);
  });

  test('should call onSelectConnector when connector is clicked', () => {
    render(
      <RuleActionsConnectorsModal
        connectors={mockConnectors}
        actionTypes={mockActionTypes}
        onClose={mockOnClose}
        onSelectConnector={mockOnSelectConnector}
      />
    );

    userEvent.click(screen.getByText('connector-1'));
    expect(mockOnSelectConnector).toHaveBeenLastCalledWith({
      actionTypeId: 'actionType-1',
      config: { config: 'config-1' },
      id: 'connector-1',
      isDeprecated: false,
      isPreconfigured: false,
      isSystemAction: false,
      name: 'connector-1',
      secrets: { secret: 'secret' },
    });

    userEvent.click(screen.getByText('connector-2'));
    expect(mockOnSelectConnector).toHaveBeenLastCalledWith({
      actionTypeId: 'actionType-2',
      config: { config: 'config-2' },
      id: 'connector-2',
      isDeprecated: false,
      isPreconfigured: false,
      isSystemAction: false,
      name: 'connector-2',
      secrets: { secret: 'secret' },
    });
  });

  test('should not render connector if action type doesnt exist', () => {
    render(
      <RuleActionsConnectorsModal
        connectors={mockConnectors}
        actionTypes={[getActionType('1')]}
        onClose={mockOnClose}
        onSelectConnector={mockOnSelectConnector}
      />
    );

    expect(screen.queryByText('connector2')).not.toBeInTheDocument();
  });

  test('should not render connector if hideInUi is true', () => {
    const actionTypeRegistry = new TypeRegistry<ActionTypeModel>();
    actionTypeRegistry.register(getActionTypeModel('1', { id: 'actionType-1' }));
    actionTypeRegistry.register(getActionTypeModel('2', { id: 'actionType-2', hideInUi: true }));

    useRuleFormState.mockReturnValue({
      plugins: {
        actionTypeRegistry,
      },
      formData: {
        actions: [],
      },
    });

    render(
      <RuleActionsConnectorsModal
        connectors={mockConnectors}
        actionTypes={mockActionTypes}
        onClose={mockOnClose}
        onSelectConnector={mockOnSelectConnector}
      />
    );

    expect(screen.queryByText('connector2')).not.toBeInTheDocument();
  });

  test('should not render connector if actionsParamsField doesnt exist', () => {
    const actionTypeRegistry = new TypeRegistry<ActionTypeModel>();
    actionTypeRegistry.register(getActionTypeModel('1', { id: 'actionType-1' }));
    actionTypeRegistry.register(
      getActionTypeModel('2', {
        id: 'actionType-2',
        actionParamsFields: null as unknown as React.LazyExoticComponent<any>,
      })
    );

    useRuleFormState.mockReturnValue({
      plugins: {
        actionTypeRegistry,
      },
      formData: {
        actions: [],
      },
    });

    render(
      <RuleActionsConnectorsModal
        connectors={mockConnectors}
        actionTypes={mockActionTypes}
        onClose={mockOnClose}
        onSelectConnector={mockOnSelectConnector}
      />
    );

    expect(screen.queryByText('connector-2')).not.toBeInTheDocument();
  });

  test('should not render connector if the action type is not enabled', () => {
    render(
      <RuleActionsConnectorsModal
        connectors={mockConnectors}
        actionTypes={[getActionType('1'), getActionType('2', { enabledInConfig: false })]}
        onClose={mockOnClose}
        onSelectConnector={mockOnSelectConnector}
      />
    );

    expect(screen.queryByText('connector-2')).not.toBeInTheDocument();
  });

  test('should render connector if the action is not enabled but its a preconfigured connector', () => {
    render(
      <RuleActionsConnectorsModal
        connectors={[getConnector('1'), getConnector('2', { isPreconfigured: true })]}
        actionTypes={[getActionType('1'), getActionType('2', { enabledInConfig: false })]}
        onClose={mockOnClose}
        onSelectConnector={mockOnSelectConnector}
      />
    );

    expect(screen.getByText('connector-2')).toBeInTheDocument();
  });

  test('should disable connector if it fails license check', () => {
    render(
      <RuleActionsConnectorsModal
        connectors={mockConnectors}
        actionTypes={[getActionType('1'), getActionType('2', { enabledInLicense: false })]}
        onClose={mockOnClose}
        onSelectConnector={mockOnSelectConnector}
      />
    );

    expect(screen.getByText('connector-2')).toBeDisabled();
  });

  test('should disable connector if its a selected system action', () => {
    const actionTypeRegistry = new TypeRegistry<ActionTypeModel>();
    actionTypeRegistry.register(getActionTypeModel('1', { id: 'actionType-1' }));
    actionTypeRegistry.register(
      getActionTypeModel('2', { isSystemActionType: true, id: 'actionType-2' })
    );

    useRuleFormState.mockReturnValue({
      plugins: {
        actionTypeRegistry,
      },
      formData: {
        actions: [{ actionTypeId: 'actionType-2' }],
      },
    });
    render(
      <RuleActionsConnectorsModal
        connectors={mockConnectors}
        actionTypes={[getActionType('1'), getActionType('2', { isSystemActionType: true })]}
        onClose={mockOnClose}
        onSelectConnector={mockOnSelectConnector}
      />
    );

    expect(screen.getByText('connector-2')).toBeDisabled();
  });
});
