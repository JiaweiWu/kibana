/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { createStatefulTestConfig } from '../../default_configs/stateful.config.base';

export default createStatefulTestConfig({
  testFiles: [require.resolve('./oblt.ai_assistant.index.ts')],
  junit: {
    reportName: 'Stateful Observability - Deployment-agnostic API Integration Tests',
  },
  // @ts-expect-error
  kbnTestServer: {
    serverArgs: [
      `--logging.loggers=${JSON.stringify([
        {
          name: 'plugins.observabilityAIAssistant',
          level: 'all',
          appenders: ['default'],
        },
      ])}`,
    ],
  },
});
