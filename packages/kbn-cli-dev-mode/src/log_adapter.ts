/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { Logger } from '@kbn/logging';
import { Log } from './log';

export const convertToLogger = (cliLog: Log): Logger => {
  const getErrorMessage = (msgOrError: string | (() => string) | Error): string => {
    return typeof msgOrError === 'function'
      ? msgOrError()
      : typeof msgOrError === 'string'
      ? msgOrError
      : msgOrError.message;
  };

  const adapter: Logger = {
    trace: (message) => cliLog.write(message),
    debug: (message) => cliLog.write(message),
    info: (message) => cliLog.write(message),
    warn: (msgOrError) => cliLog.warn('warning', getErrorMessage(msgOrError)),
    error: (msgOrError) => cliLog.bad('error', getErrorMessage(msgOrError)),
    fatal: (msgOrError) => cliLog.bad('fatal', getErrorMessage(msgOrError)),
    log: (record) => cliLog.write(record.message),
    isLevelEnabled: () => true,
    get: () => adapter,
  };
  return adapter;
};
