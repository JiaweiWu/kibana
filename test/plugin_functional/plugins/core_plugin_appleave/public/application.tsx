/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React from 'react';
import { render, unmountComponentAtNode } from 'react-dom';
import {
  EuiPage,
  EuiPageBody,
  EuiPageSection,
  EuiPageHeader,
  EuiPageHeaderSection,
  EuiTitle,
} from '@elastic/eui';
import { KibanaRenderContextProvider } from '@kbn/react-kibana-context-render';
import { AppMountParameters, CoreStart } from '@kbn/core/public';

const App = ({ appName }: { appName: string }) => (
  <EuiPage>
    <EuiPageBody data-test-subj="chromelessAppHome">
      <EuiPageHeader>
        <EuiPageHeaderSection>
          <EuiTitle size="l">
            <h1>Welcome to {appName}!</h1>
          </EuiTitle>
        </EuiPageHeaderSection>
      </EuiPageHeader>
      <EuiPageSection>
        <EuiPageHeader>
          <EuiTitle>
            <h2>{appName} home page section title</h2>
          </EuiTitle>
        </EuiPageHeader>
        <EuiPageSection>{appName} page content</EuiPageSection>
      </EuiPageSection>
    </EuiPageBody>
  </EuiPage>
);

export const renderApp = (appName: string, { element }: AppMountParameters, core: CoreStart) => {
  render(
    <KibanaRenderContextProvider {...core}>
      <App appName={appName} />
    </KibanaRenderContextProvider>,
    element
  );
  return () => unmountComponentAtNode(element);
};
