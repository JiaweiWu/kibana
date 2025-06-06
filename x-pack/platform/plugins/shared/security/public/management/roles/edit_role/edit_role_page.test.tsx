/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { act } from '@testing-library/react';
import type { ReactWrapper } from 'enzyme';
import React from 'react';

import type { BuildFlavor } from '@kbn/config';
import type { Capabilities } from '@kbn/core/public';
import { coreMock, scopedHistoryMock } from '@kbn/core/public/mocks';
import { analyticsServiceMock } from '@kbn/core-analytics-browser-mocks';
import { i18nServiceMock } from '@kbn/core-i18n-browser-mocks';
import { themeServiceMock } from '@kbn/core-theme-browser-mocks';
import { userProfileServiceMock } from '@kbn/core-user-profile-browser-mocks';
import { dataViewPluginMocks } from '@kbn/data-views-plugin/public/mocks';
import { KibanaFeature } from '@kbn/features-plugin/public';
import { KibanaContextProvider } from '@kbn/kibana-react-plugin/public';
import { REMOTE_CLUSTERS_PATH } from '@kbn/remote-clusters-plugin/public';
import { createRawKibanaPrivileges } from '@kbn/security-role-management-model/src/__fixtures__';
import type { Space } from '@kbn/spaces-plugin/public';
import { spacesManagerMock } from '@kbn/spaces-plugin/public/spaces_manager/mocks';
import { getUiApi } from '@kbn/spaces-plugin/public/ui_api';
import { mountWithIntl, nextTick } from '@kbn/test-jest-helpers';

import { EditRolePage } from './edit_role_page';
import { SimplePrivilegeSection } from './privileges/kibana/simple_privilege_section';
import { SpaceAwarePrivilegeSection } from './privileges/kibana/space_aware_privilege_section';
import { TransformErrorSection } from './privileges/kibana/transform_error_section';
import type { Role } from '../../../../common';
import { licenseMock } from '../../../../common/licensing/index.mock';
import { userAPIClientMock } from '../../users/index.mock';
import { indicesAPIClientMock, privilegesAPIClientMock, rolesAPIClientMock } from '../index.mock';

const spacesManager = spacesManagerMock.create();
const { getStartServices } = coreMock.createSetup();
const spacesApiUi = getUiApi({ spacesManager, getStartServices });

const buildFeatures = () => {
  return [
    new KibanaFeature({
      id: 'feature1',
      name: 'Feature 1',
      app: ['feature1App'],
      category: { id: 'foo', label: 'foo' },
      privileges: {
        all: {
          app: ['feature1App'],
          ui: ['feature1-ui'],
          savedObject: {
            all: [],
            read: [],
          },
        },
        read: {
          app: ['feature1App'],
          ui: ['feature1-ui'],
          savedObject: {
            all: [],
            read: [],
          },
        },
      },
    }),
    new KibanaFeature({
      id: 'feature2',
      name: 'Feature 2',
      app: ['feature2App'],
      category: { id: 'foo', label: 'foo' },
      privileges: {
        all: {
          app: ['feature2App'],
          ui: ['feature2-ui'],
          savedObject: {
            all: ['feature2'],
            read: ['config'],
          },
        },
        read: {
          app: ['feature2App'],
          ui: ['feature2-ui'],
          savedObject: {
            all: [],
            read: ['config'],
          },
        },
      },
    }),
  ] as KibanaFeature[];
};

const buildBuiltinESPrivileges = () => {
  return {
    cluster: ['all', 'manage', 'monitor'],
    index: ['all', 'read', 'write', 'index'],
  };
};

const buildUICapabilities = (canManageSpaces = true) => {
  return {
    catalogue: {},
    management: {},
    navLinks: {},
    spaces: {
      manage: canManageSpaces,
    },
  } as Capabilities;
};

const buildSpaces = () => {
  return [
    {
      id: 'default',
      name: 'Default',
      disabledFeatures: [],
      _reserved: true,
    },
    {
      id: 'space_1',
      name: 'Space 1',
      disabledFeatures: [],
    },
    {
      id: 'space_2',
      name: 'Space 2',
      disabledFeatures: ['feature2'],
    },
  ] as Space[];
};

const expectReadOnlyFormButtons = (wrapper: ReactWrapper<any, any>) => {
  expect(wrapper.find('button[data-test-subj="roleFormReturnButton"]')).toHaveLength(1);
  expect(wrapper.find('button[data-test-subj="roleFormSaveButton"]')).toHaveLength(0);
};

const expectSaveFormButtons = (wrapper: ReactWrapper<any, any>) => {
  expect(wrapper.find('button[data-test-subj="roleFormReturnButton"]')).toHaveLength(0);
  expect(wrapper.find('button[data-test-subj="roleFormSaveButton"]')).toHaveLength(1);
};

function getProps({
  action,
  role,
  canManageSpaces = true,
  spacesEnabled = true,
  canUseRemoteIndices = true,
  buildFlavor = 'traditional',
}: {
  action: 'edit' | 'clone';
  role?: Role;
  canManageSpaces?: boolean;
  spacesEnabled?: boolean;
  canUseRemoteIndices?: boolean;
  buildFlavor?: BuildFlavor;
}) {
  const rolesAPIClient = rolesAPIClientMock.create();
  rolesAPIClient.getRole.mockResolvedValue(role);

  const dataViews = dataViewPluginMocks.createStartContract();
  // `undefined` titles can technically happen via import/export or other manual manipulation
  dataViews.getTitles = jest.fn().mockResolvedValue(['foo*', 'bar*', undefined]);

  const indicesAPIClient = indicesAPIClientMock.create();

  const userAPIClient = userAPIClientMock.create();
  userAPIClient.getUsers.mockResolvedValue([]);

  const privilegesAPIClient = privilegesAPIClientMock.create();
  privilegesAPIClient.getAll.mockResolvedValue(createRawKibanaPrivileges(buildFeatures()));
  privilegesAPIClient.getBuiltIn.mockResolvedValue(buildBuiltinESPrivileges());

  const license = licenseMock.create();
  license.getFeatures.mockReturnValue({
    allowRoleDocumentLevelSecurity: true,
    allowRoleFieldLevelSecurity: true,
  } as any);

  const { fatalErrors } = coreMock.createSetup();
  const { http, docLinks, notifications, rendering } = coreMock.createStart();
  http.get.mockImplementation(async (path: any) => {
    if (path === '/api/spaces/space') {
      if (!spacesEnabled) {
        throw { response: { status: 404 } }; // eslint-disable-line no-throw-literal
      }
      return buildSpaces();
    }
    if (path === '/internal/security/_check_security_features') {
      return { canUseRemoteIndices };
    }
    if (path === REMOTE_CLUSTERS_PATH) {
      return [];
    }
  });
  const analyticsMock = analyticsServiceMock.createAnalyticsServiceStart();
  const i18nMock = i18nServiceMock.createStartContract();
  const themeMock = themeServiceMock.createStartContract();
  const userProfileMock = userProfileServiceMock.createStart();

  return {
    action,
    roleName: role?.name,
    license,
    http,
    dataViews,
    indicesAPIClient,
    privilegesAPIClient,
    rolesAPIClient,
    userAPIClient,
    getFeatures: () => Promise.resolve(buildFeatures()),
    notifications,
    docLinks,
    fatalErrors,
    uiCapabilities: buildUICapabilities(canManageSpaces),
    history: scopedHistoryMock.create(),
    spacesApiUi,
    buildFlavor,
    userProfile: userProfileMock,
    theme: themeMock,
    i18n: i18nMock,
    analytics: analyticsMock,
    rendering,
  };
}

describe('<EditRolePage />', () => {
  const coreStart = coreMock.createStart();

  beforeEach(() => {
    coreStart.application.capabilities = {
      ...coreStart.application.capabilities,
      roles: {
        save: true,
      },
    };
  });

  describe('with spaces enabled', () => {
    it('can render readonly view when not enough privileges', async () => {
      coreStart.application.capabilities = {
        ...coreStart.application.capabilities,
        roles: {
          save: false,
        },
      };

      const wrapper = mountWithIntl(
        <KibanaContextProvider services={coreStart}>
          <EditRolePage
            {...getProps({
              action: 'edit',
              role: {
                name: 'my custom role',
                metadata: {},
                elasticsearch: { cluster: ['all'], indices: [], run_as: ['*'] },
                kibana: [{ spaces: ['*'], base: ['all'], feature: {} }],
              },
            })}
          />
        </KibanaContextProvider>
      );

      await waitForRender(wrapper);

      expect(wrapper.find('input[data-test-subj="roleFormNameInput"]').prop('disabled')).toBe(true);
      expectReadOnlyFormButtons(wrapper);
    });

    it('can render a reserved role', async () => {
      const wrapper = mountWithIntl(
        <KibanaContextProvider services={coreStart}>
          <EditRolePage
            {...getProps({
              action: 'edit',
              role: {
                name: 'superuser',
                metadata: { _reserved: true },
                elasticsearch: { cluster: ['all'], indices: [], run_as: ['*'] },
                kibana: [{ spaces: ['*'], base: ['all'], feature: {} }],
              },
            })}
          />
        </KibanaContextProvider>
      );

      await waitForRender(wrapper);

      expect(wrapper.find('[data-test-subj="reservedRoleBadgeTooltip"]')).toHaveLength(1);
      expect(wrapper.find(SpaceAwarePrivilegeSection)).toHaveLength(1);
      expect(wrapper.find('[data-test-subj="userCannotManageSpacesCallout"]')).toHaveLength(0);
      expect(wrapper.find('input[data-test-subj="roleFormNameInput"]').prop('disabled')).toBe(true);
      expect(wrapper.find('IndexPrivileges[indexType="indices"]')).toHaveLength(1);
      expect(wrapper.find('IndexPrivileges[indexType="remote_indices"]')).toHaveLength(1);
      expectReadOnlyFormButtons(wrapper);
    });

    it('can render a user defined role', async () => {
      const wrapper = mountWithIntl(
        <KibanaContextProvider services={coreStart}>
          <EditRolePage
            {...getProps({
              action: 'edit',
              role: {
                name: 'my custom role',
                metadata: {},
                elasticsearch: { cluster: ['all'], indices: [], run_as: ['*'] },
                kibana: [{ spaces: ['*'], base: ['all'], feature: {} }],
              },
            })}
          />
        </KibanaContextProvider>
      );

      await waitForRender(wrapper);

      expect(wrapper.find('[data-test-subj="reservedRoleBadgeTooltip"]')).toHaveLength(0);
      expect(wrapper.find(SpaceAwarePrivilegeSection)).toHaveLength(1);
      expect(wrapper.find('[data-test-subj="userCannotManageSpacesCallout"]')).toHaveLength(0);
      expect(wrapper.find('input[data-test-subj="roleFormNameInput"]').prop('disabled')).toBe(true);
      expect(wrapper.find('IndexPrivileges[indexType="indices"]')).toHaveLength(1);
      expect(wrapper.find('IndexPrivileges[indexType="remote_indices"]')).toHaveLength(1);
      expectSaveFormButtons(wrapper);
    });

    it('can render when creating a new role', async () => {
      const wrapper = mountWithIntl(
        <KibanaContextProvider services={coreStart}>
          <EditRolePage {...getProps({ action: 'edit' })} />
        </KibanaContextProvider>
      );

      await waitForRender(wrapper);

      expect(wrapper.find(SpaceAwarePrivilegeSection)).toHaveLength(1);
      expect(wrapper.find('[data-test-subj="userCannotManageSpacesCallout"]')).toHaveLength(0);
      expect(wrapper.find('input[data-test-subj="roleFormNameInput"]').prop('disabled')).toBe(
        false
      );
      expect(wrapper.find('IndexPrivileges[indexType="indices"]')).toHaveLength(1);
      expect(wrapper.find('IndexPrivileges[indexType="remote_indices"]')).toHaveLength(1);
      expectSaveFormButtons(wrapper);
    });

    it('redirects back to roles when creating a new role without privileges', async () => {
      coreStart.application.capabilities = {
        ...coreStart.application.capabilities,
        roles: {
          save: false,
        },
      };

      const props = getProps({ action: 'edit' });
      const wrapper = mountWithIntl(
        <KibanaContextProvider services={coreStart}>
          <EditRolePage {...props} />
        </KibanaContextProvider>
      );

      await waitForRender(wrapper);

      expect(props.history.push).toHaveBeenCalledWith('/');
    });

    it('can render when cloning an existing role', async () => {
      const wrapper = mountWithIntl(
        <KibanaContextProvider services={coreStart}>
          <EditRolePage
            {...getProps({
              action: 'edit',
              role: {
                name: '',
                metadata: { _reserved: false },
                elasticsearch: {
                  cluster: ['all', 'manage'],
                  indices: [
                    {
                      names: ['foo*'],
                      privileges: ['all'],
                      field_security: { except: ['f'], grant: ['b*'] },
                    },
                  ],
                  run_as: ['elastic'],
                },
                kibana: [{ spaces: ['*'], base: ['all'], feature: {} }],
              },
            })}
          />
        </KibanaContextProvider>
      );

      await waitForRender(wrapper);

      expect(wrapper.find(SpaceAwarePrivilegeSection)).toHaveLength(1);
      expect(wrapper.find('[data-test-subj="userCannotManageSpacesCallout"]')).toHaveLength(0);
      expect(wrapper.find('input[data-test-subj="roleFormNameInput"]').prop('disabled')).toBe(
        false
      );
      expectSaveFormButtons(wrapper);
    });

    it('renders an auth error when not authorized to manage spaces', async () => {
      const wrapper = mountWithIntl(
        <KibanaContextProvider services={coreStart}>
          <EditRolePage
            {...getProps({
              action: 'edit',
              canManageSpaces: false,
              role: {
                name: 'my custom role',
                metadata: {},
                elasticsearch: { cluster: ['all'], indices: [], run_as: ['*'] },
                kibana: [{ spaces: ['*'], base: ['all'], feature: {} }],
              },
            })}
          />
        </KibanaContextProvider>
      );

      await waitForRender(wrapper);

      expect(wrapper.find('[data-test-subj="reservedRoleBadgeTooltip"]')).toHaveLength(0);

      expect(
        wrapper.find('EuiCallOut[data-test-subj="userCannotManageSpacesCallout"]')
      ).toHaveLength(1);

      expect(wrapper.find(SpaceAwarePrivilegeSection)).toHaveLength(1);
      expectSaveFormButtons(wrapper);
    });

    it('renders a partial read-only view when there is a transform error', async () => {
      const wrapper = mountWithIntl(
        <KibanaContextProvider services={coreStart}>
          <EditRolePage
            {...getProps({
              action: 'edit',
              canManageSpaces: false,
              role: {
                name: 'my custom role',
                metadata: {},
                elasticsearch: { cluster: ['all'], indices: [], run_as: ['*'] },
                kibana: [],
                _transform_error: ['kibana'],
              },
            })}
          />
        </KibanaContextProvider>
      );

      await waitForRender(wrapper);

      expect(wrapper.find(TransformErrorSection)).toHaveLength(1);
      expectReadOnlyFormButtons(wrapper);
    });
  });

  describe('with spaces disabled', () => {
    it('can render readonly view when not enough privileges', async () => {
      coreStart.application.capabilities = {
        ...coreStart.application.capabilities,
        roles: {
          save: false,
        },
      };

      const wrapper = mountWithIntl(
        <KibanaContextProvider services={coreStart}>
          <EditRolePage
            {...getProps({
              action: 'edit',
              spacesEnabled: false,
              role: {
                name: 'my custom role',
                metadata: {},
                elasticsearch: { cluster: ['all'], indices: [], run_as: ['*'] },
                kibana: [{ spaces: ['*'], base: ['all'], feature: {} }],
              },
            })}
          />
        </KibanaContextProvider>
      );

      await waitForRender(wrapper);

      expect(wrapper.find('input[data-test-subj="roleFormNameInput"]').prop('disabled')).toBe(true);
      expectReadOnlyFormButtons(wrapper);
    });

    it('can render a reserved role', async () => {
      const wrapper = mountWithIntl(
        <KibanaContextProvider services={coreStart}>
          <EditRolePage
            {...getProps({
              action: 'edit',
              spacesEnabled: false,
              role: {
                name: 'superuser',
                metadata: { _reserved: true },
                elasticsearch: { cluster: ['all'], indices: [], run_as: ['*'] },
                kibana: [{ spaces: ['*'], base: ['all'], feature: {} }],
              },
            })}
          />
        </KibanaContextProvider>
      );

      await waitForRender(wrapper);

      expect(wrapper.find('[data-test-subj="reservedRoleBadgeTooltip"]')).toHaveLength(1);
      expect(wrapper.find(SimplePrivilegeSection)).toHaveLength(1);
      expect(wrapper.find('[data-test-subj="userCannotManageSpacesCallout"]')).toHaveLength(0);
      expect(wrapper.find('input[data-test-subj="roleFormNameInput"]').prop('disabled')).toBe(true);
      expect(wrapper.find('IndexPrivileges[indexType="indices"]')).toHaveLength(1);
      expect(wrapper.find('IndexPrivileges[indexType="remote_indices"]')).toHaveLength(1);
      expectReadOnlyFormButtons(wrapper);
    });

    it('can render a user defined role', async () => {
      const wrapper = mountWithIntl(
        <KibanaContextProvider services={coreStart}>
          <EditRolePage
            {...getProps({
              action: 'edit',
              spacesEnabled: false,
              role: {
                name: 'my custom role',
                metadata: {},
                elasticsearch: { cluster: ['all'], indices: [], run_as: ['*'] },
                kibana: [{ spaces: ['*'], base: ['all'], feature: {} }],
              },
            })}
          />
        </KibanaContextProvider>
      );

      await waitForRender(wrapper);

      expect(wrapper.find('[data-test-subj="reservedRoleBadgeTooltip"]')).toHaveLength(0);
      expect(wrapper.find(SimplePrivilegeSection)).toHaveLength(1);
      expect(wrapper.find('[data-test-subj="userCannotManageSpacesCallout"]')).toHaveLength(0);
      expect(wrapper.find('input[data-test-subj="roleFormNameInput"]').prop('disabled')).toBe(true);
      expect(wrapper.find('IndexPrivileges[indexType="indices"]')).toHaveLength(1);
      expect(wrapper.find('IndexPrivileges[indexType="remote_indices"]')).toHaveLength(1);
      expectSaveFormButtons(wrapper);
    });

    it('can render a user defined role with description', async () => {
      const wrapper = mountWithIntl(
        <KibanaContextProvider services={coreStart}>
          <EditRolePage
            {...getProps({
              action: 'edit',
              spacesEnabled: false,
              role: {
                description: 'my custom role description',
                name: 'my custom role',
                metadata: {},
                elasticsearch: { cluster: ['all'], indices: [], run_as: ['*'] },
                kibana: [],
              },
            })}
          />
        </KibanaContextProvider>
      );

      await waitForRender(wrapper);

      expect(wrapper.find('input[data-test-subj="roleFormDescriptionInput"]').prop('value')).toBe(
        'my custom role description'
      );
      expect(
        wrapper.find('input[data-test-subj="roleFormDescriptionInput"]').prop('disabled')
      ).toBe(undefined);
      expectSaveFormButtons(wrapper);
    });

    it('can render a reserved role with description', async () => {
      const wrapper = mountWithIntl(
        <KibanaContextProvider services={coreStart}>
          <EditRolePage
            {...getProps({
              action: 'edit',
              spacesEnabled: false,
              role: {
                description: 'my reserved role description',
                name: 'my custom role',
                metadata: {
                  _reserved: true,
                },
                elasticsearch: { cluster: ['all'], indices: [], run_as: ['*'] },
                kibana: [],
              },
            })}
          />
        </KibanaContextProvider>
      );

      await waitForRender(wrapper);

      expect(wrapper.find('[data-test-subj="roleFormDescriptionTooltip"]')).toHaveLength(1);

      expect(wrapper.find('input[data-test-subj="roleFormDescriptionInput"]').prop('value')).toBe(
        'my reserved role description'
      );
      expect(
        wrapper.find('input[data-test-subj="roleFormDescriptionInput"]').prop('disabled')
      ).toBe(true);
    });

    it('can render when creating a new role', async () => {
      const wrapper = mountWithIntl(
        <KibanaContextProvider services={coreStart}>
          <EditRolePage {...getProps({ action: 'edit', spacesEnabled: false })} />
        </KibanaContextProvider>
      );

      await waitForRender(wrapper);

      expect(wrapper.find(SimplePrivilegeSection)).toHaveLength(1);
      expect(wrapper.find('[data-test-subj="userCannotManageSpacesCallout"]')).toHaveLength(0);
      expect(wrapper.find('input[data-test-subj="roleFormNameInput"]').prop('disabled')).toBe(
        false
      );
      expect(wrapper.find('IndexPrivileges[indexType="indices"]')).toHaveLength(1);
      expect(wrapper.find('IndexPrivileges[indexType="remote_indices"]')).toHaveLength(1);
      expectSaveFormButtons(wrapper);
    });

    it('redirects back to roles when creating a new role without privileges', async () => {
      coreStart.application.capabilities = {
        ...coreStart.application.capabilities,
        roles: {
          save: false,
        },
      };

      const props = getProps({ action: 'edit', spacesEnabled: false });
      const wrapper = mountWithIntl(
        <KibanaContextProvider services={coreStart}>
          <EditRolePage {...props} />
        </KibanaContextProvider>
      );

      await waitForRender(wrapper);

      expect(props.history.push).toHaveBeenCalledWith('/');
    });

    it('can render when cloning an existing role', async () => {
      const wrapper = mountWithIntl(
        <KibanaContextProvider services={coreStart}>
          <EditRolePage
            {...getProps({
              action: 'edit',
              spacesEnabled: false,
              role: {
                name: '',
                metadata: { _reserved: false },
                elasticsearch: {
                  cluster: ['all', 'manage'],
                  indices: [
                    {
                      names: ['foo*'],
                      privileges: ['all'],
                      field_security: { except: ['f'], grant: ['b*'] },
                    },
                  ],
                  run_as: ['elastic'],
                },
                kibana: [{ spaces: ['*'], base: ['all'], feature: {} }],
              },
            })}
          />
        </KibanaContextProvider>
      );

      await waitForRender(wrapper);

      expect(wrapper.find(SimplePrivilegeSection)).toHaveLength(1);
      expect(wrapper.find('[data-test-subj="userCannotManageSpacesCallout"]')).toHaveLength(0);
      expect(wrapper.find('input[data-test-subj="roleFormNameInput"]').prop('disabled')).toBe(
        false
      );
      expectSaveFormButtons(wrapper);
    });

    it('renders a partial read-only view when there is a transform error', async () => {
      const wrapper = mountWithIntl(
        <KibanaContextProvider services={coreStart}>
          <EditRolePage
            {...getProps({
              action: 'edit',
              spacesEnabled: false,
              canManageSpaces: false,
              role: {
                name: 'my custom role',
                metadata: {},
                elasticsearch: { cluster: ['all'], indices: [], run_as: ['*'] },
                kibana: [],
                _transform_error: ['kibana'],
              },
            })}
          />
        </KibanaContextProvider>
      );

      await waitForRender(wrapper);

      expect(wrapper.find(TransformErrorSection)).toHaveLength(1);
      expectReadOnlyFormButtons(wrapper);
    });
  });

  it('hides remote index privileges section when not supported', async () => {
    const wrapper = mountWithIntl(
      <KibanaContextProvider services={coreStart}>
        <EditRolePage {...getProps({ action: 'edit', canUseRemoteIndices: false })} />
      </KibanaContextProvider>
    );

    await waitForRender(wrapper);

    expect(wrapper.find('IndexPrivileges[indexType="indices"]')).toHaveLength(1);
    expect(wrapper.find('IndexPrivileges[indexType="remote_indices"]')).toHaveLength(0);
  });

  it('registers fatal error if features endpoint fails unexpectedly', async () => {
    const error = { response: { status: 500 } };
    const getFeatures = jest.fn().mockRejectedValue(error);
    const props = getProps({ action: 'edit' });
    const wrapper = mountWithIntl(
      <KibanaContextProvider services={coreStart}>
        <EditRolePage {...props} getFeatures={getFeatures} />
      </KibanaContextProvider>
    );

    await waitForRender(wrapper);
    expect(props.fatalErrors.add).toHaveBeenLastCalledWith(error);
    expect(wrapper.find(SpaceAwarePrivilegeSection)).toHaveLength(0);
  });

  it('can render if features call is not allowed', async () => {
    const error = { response: { status: 403 } };
    const getFeatures = jest.fn().mockRejectedValue(error);
    const props = getProps({ action: 'edit' });
    const wrapper = mountWithIntl(
      <KibanaContextProvider services={coreStart}>
        <EditRolePage {...props} getFeatures={getFeatures} />
      </KibanaContextProvider>
    );

    await waitForRender(wrapper);
    expect(props.fatalErrors.add).not.toHaveBeenCalled();
    expect(wrapper.find(SpaceAwarePrivilegeSection)).toHaveLength(1);
    expect(wrapper.find('[data-test-subj="userCannotManageSpacesCallout"]')).toHaveLength(0);
    expectSaveFormButtons(wrapper);
  });

  it('can render if index patterns are not available', async () => {
    const dataViews = dataViewPluginMocks.createStartContract();
    dataViews.getTitles = jest.fn().mockRejectedValue({ response: { status: 403 } });

    const wrapper = mountWithIntl(
      <KibanaContextProvider services={coreStart}>
        <EditRolePage {...{ ...getProps({ action: 'edit' }), dataViews }} />
      </KibanaContextProvider>
    );

    await waitForRender(wrapper);

    expect(wrapper.find(SpaceAwarePrivilegeSection)).toHaveLength(1);
    expect(wrapper.find('[data-test-subj="userCannotManageSpacesCallout"]')).toHaveLength(0);
    expectSaveFormButtons(wrapper);
  });

  it('can render for serverless buildFlavor', async () => {
    const dataViews = dataViewPluginMocks.createStartContract();
    dataViews.getTitles = jest.fn().mockRejectedValue({ response: { status: 403 } });

    const wrapper = mountWithIntl(
      <KibanaContextProvider services={coreStart}>
        <EditRolePage
          {...{
            ...getProps({
              action: 'edit',
              spacesEnabled: true,
              role: {
                name: 'my custom role',
                metadata: {},
                elasticsearch: { cluster: ['all'], indices: [], run_as: ['*'] },
                kibana: [{ spaces: ['*'], base: ['all'], feature: {} }],
              },
              buildFlavor: 'serverless',
            }),
            dataViews,
          }}
        />
      </KibanaContextProvider>
    );

    await waitForRender(wrapper);

    expect(wrapper.find('[data-test-subj="reservedRoleBadgeTooltip"]')).toHaveLength(0);
    expect(wrapper.find(SpaceAwarePrivilegeSection)).toHaveLength(1);
    expect(wrapper.find('[data-test-subj="userCannotManageSpacesCallout"]')).toHaveLength(0);
    expect(wrapper.find('input[data-test-subj="roleFormNameInput"]').prop('disabled')).toBe(true);
    expect(wrapper.find('ElasticsearchPrivileges').prop('buildFlavor')).toBe('serverless');
    expect(wrapper.find('IndexPrivileges[indexType="indices"]')).toHaveLength(1);
    expect(wrapper.find('IndexPrivileges[indexType="remote_indices"]')).toHaveLength(0);
    expectSaveFormButtons(wrapper);
  });

  it('render role with wildcard base privilege without edit/delete actions', async () => {
    const wrapper = mountWithIntl(
      <KibanaContextProvider services={coreStart}>
        <EditRolePage
          {...getProps({
            action: 'edit',
            role: {
              name: 'my custom role',
              metadata: {},
              elasticsearch: { cluster: ['all'], indices: [], run_as: ['*'] },
              kibana: [{ spaces: ['*'], base: ['*'], feature: {} }],
            },
          })}
        />
      </KibanaContextProvider>
    );

    await waitForRender(wrapper);

    expect(wrapper.find('[data-test-subj="privilegeEditAction-0"]')).toHaveLength(0);
    expect(wrapper.find('[data-test-subj="privilegeDeleteAction-0"]')).toHaveLength(0);
    expectReadOnlyFormButtons(wrapper);
  });

  describe('in create mode', () => {
    it('renders an error for existing role name', async () => {
      const props = getProps({ action: 'edit' });
      const wrapper = mountWithIntl(
        <KibanaContextProvider services={coreStart}>
          <EditRolePage {...props} />
        </KibanaContextProvider>
      );

      await waitForRender(wrapper);

      const nameInput = wrapper.find('input[name="name"]');
      nameInput.simulate('change', { target: { value: 'system_indices_superuser' } });
      nameInput.simulate('blur');

      await waitForRender(wrapper);

      expect(wrapper.find('EuiFormRow[data-test-subj="roleNameFormRow"]').props()).toMatchObject({
        error: 'A role with this name already exists.',
        isInvalid: true,
      });
      expectSaveFormButtons(wrapper);
      expect(wrapper.find('EuiButton[data-test-subj="roleFormSaveButton"]').props().disabled);
    });

    it('renders an error on save of existing role name', async () => {
      const props = getProps({ action: 'edit' });
      const wrapper = mountWithIntl(
        <KibanaContextProvider services={coreStart}>
          <EditRolePage {...props} />
        </KibanaContextProvider>
      );

      props.rolesAPIClient.saveRole.mockRejectedValue({
        body: {
          statusCode: 409,
          message: 'Role already exists and cannot be created: system_indices_superuser',
        },
      });

      await waitForRender(wrapper);

      const nameInput = wrapper.find('input[name="name"]');
      const saveButton = wrapper.find('button[data-test-subj="roleFormSaveButton"]');

      nameInput.simulate('change', { target: { value: 'system_indices_superuser' } });
      saveButton.simulate('click');

      await waitForRender(wrapper);

      expect(wrapper.find('EuiFormRow[data-test-subj="roleNameFormRow"]').props()).toMatchObject({
        error: 'A role with this name already exists.',
        isInvalid: true,
      });
      // A usual toast notification is not expected with this specific error
      expect(props.notifications.toasts.addDanger).toBeCalledTimes(0);
      expectSaveFormButtons(wrapper);
      expect(wrapper.find('EuiButton[data-test-subj="roleFormSaveButton"]').props().disabled);
    });

    it('does not render an error for new role name', async () => {
      const props = getProps({ action: 'edit' });
      const wrapper = mountWithIntl(
        <KibanaContextProvider services={coreStart}>
          <EditRolePage {...props} />
        </KibanaContextProvider>
      );

      props.rolesAPIClient.getRole.mockRejectedValue(new Error('not found'));

      await waitForRender(wrapper);

      const nameInput = wrapper.find('input[name="name"]');
      nameInput.simulate('change', { target: { value: 'system_indices_superuser' } });
      nameInput.simulate('blur');

      await waitForRender(wrapper);

      expect(wrapper.find('EuiFormRow[data-test-subj="roleNameFormRow"]').props()).toMatchObject({
        isInvalid: false,
      });
      expectSaveFormButtons(wrapper);
    });

    it('can render for serverless buildFlavor', async () => {
      const props = getProps({ action: 'edit', buildFlavor: 'serverless' });
      const wrapper = mountWithIntl(
        <KibanaContextProvider services={coreStart}>
          <EditRolePage {...props} />
        </KibanaContextProvider>
      );

      props.rolesAPIClient.getRole.mockRejectedValue(new Error('not found'));

      await waitForRender(wrapper);

      const nameInput = wrapper.find('input[name="name"]');
      nameInput.simulate('change', { target: { value: 'system_indices_superuser' } });
      nameInput.simulate('blur');

      await waitForRender(wrapper);

      expect(wrapper.find('EuiFormRow[data-test-subj="roleNameFormRow"]').props()).toMatchObject({
        isInvalid: false,
      });
      expect(wrapper.find('[data-test-subj="reservedRoleBadgeTooltip"]')).toHaveLength(0);
      expect(wrapper.find('[data-test-subj="userCannotManageSpacesCallout"]')).toHaveLength(0);
      expect(wrapper.find('input[data-test-subj="roleFormNameInput"]').prop('disabled')).toBe(
        false
      );
      expect(wrapper.find('ElasticsearchPrivileges').prop('buildFlavor')).toBe('serverless');
      expect(wrapper.find('IndexPrivileges[indexType="indices"]')).toHaveLength(1);
      expect(wrapper.find('IndexPrivileges[indexType="remote_indices"]')).toHaveLength(0);
      expectSaveFormButtons(wrapper);
    });

    it('does not render a notification on save of new role name', async () => {
      const props = getProps({ action: 'edit' });
      const wrapper = mountWithIntl(
        <KibanaContextProvider services={coreStart}>
          <EditRolePage {...props} />
        </KibanaContextProvider>
      );

      props.rolesAPIClient.getRole.mockRejectedValue(new Error('not found'));

      await waitForRender(wrapper);

      const nameInput = wrapper.find('input[name="name"]');
      const saveButton = wrapper.find('button[data-test-subj="roleFormSaveButton"]');

      nameInput.simulate('change', { target: { value: 'system_indices_superuser' } });
      saveButton.simulate('click');

      await waitForRender(wrapper);

      expect(wrapper.find('EuiFormRow[data-test-subj="roleNameFormRow"]').props()).toMatchObject({
        isInvalid: false,
      });
      expect(props.notifications.toasts.addDanger).toBeCalledTimes(0);
      expectSaveFormButtons(wrapper);
    });
  });
});

async function waitForRender(wrapper: ReactWrapper<any>) {
  await act(async () => {
    await nextTick();
    wrapper.update();
  });
}
