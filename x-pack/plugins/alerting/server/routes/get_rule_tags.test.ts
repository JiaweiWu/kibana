/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { httpServiceMock } from '@kbn/core/server/mocks';
import { licenseStateMock } from '../lib/license_state.mock';
import { verifyApiAccess } from '../lib/license_api_access';
import { mockHandlerArguments } from './_mock_handler_arguments';
import { rulesClientMock } from '../rules_client.mock';
import { getRuleTagsRoute } from './get_rule_tags';

const rulesClient = rulesClientMock.create();

jest.mock('../lib/license_api_access', () => ({
  verifyApiAccess: jest.fn(),
}));

jest.mock('../lib/rule_tags_aggregation', () => ({
  ...jest.requireActual('../lib/rule_tags_aggregation'),
  formatRuleTagsAggregationResult: jest.fn(),
}));

beforeEach(() => {
  jest.resetAllMocks();
});

const { formatRuleTagsAggregationResult } = jest.requireMock('../lib/rule_tags_aggregation');

describe('getRuleTagsRoute', () => {
  it('aggregates rule tags with proper parameters', async () => {
    const licenseState = licenseStateMock.create();
    const router = httpServiceMock.createRouter();

    getRuleTagsRoute(router, licenseState);

    const [config, handler] = router.get.mock.calls[0];

    expect(config.path).toMatchInlineSnapshot(`"/internal/alerting/rules/_tags"`);

    const aggregateResult = { ruleTags: ['a', 'b', 'c'] };

    formatRuleTagsAggregationResult.mockReturnValueOnce(aggregateResult);

    const [context, req, res] = mockHandlerArguments(
      { rulesClient },
      {
        query: {
          page: 5,
          perPage: 10,
          filter: 'test',
        },
      },
      ['ok']
    );

    expect(await handler(context, req, res)).toMatchInlineSnapshot(`
      Object {
        "body": Object {
          "rule_tags": Array [
            "a",
            "b",
            "c",
          ],
        },
      }
    `);
    expect(rulesClient.aggregate).toHaveBeenCalledTimes(1);
    expect(rulesClient.aggregate.mock.calls[0]).toMatchInlineSnapshot(`
      Array [
        Object {
          "aggs": Object {
            "tags": Object {
              "composite": Object {
                "size": 50,
                "sources": Array [
                  Object {
                    "tags": Object {
                      "terms": Object {
                        "field": "alert.attributes.tags",
                        "order": "asc",
                      },
                    },
                  },
                ],
              },
            },
          },
          "options": Object {
            "defaultSearchOperator": undefined,
            "filter": "test",
            "page": 5,
            "perPage": 10,
          },
        },
      ]
    `);
    expect(res.ok).toHaveBeenCalledWith({
      body: {
        rule_tags: ['a', 'b', 'c'],
      },
    });
  });

  it('ensures the license allows aggregating rule tags', async () => {
    const licenseState = licenseStateMock.create();
    const router = httpServiceMock.createRouter();

    getRuleTagsRoute(router, licenseState);

    const [, handler] = router.get.mock.calls[0];

    formatRuleTagsAggregationResult.mockReturnValueOnce({ ruleTags: ['a', 'b', 'c', 'd'] });

    const [context, req, res] = mockHandlerArguments(
      { rulesClient },
      {
        query: {
          page: 5,
          perPage: 10,
          filter: 'test',
        },
      }
    );

    await handler(context, req, res);

    expect(verifyApiAccess).toHaveBeenCalledWith(licenseState);
  });

  it('ensures the license check prevents aggregating rule tags', async () => {
    const licenseState = licenseStateMock.create();
    const router = httpServiceMock.createRouter();

    (verifyApiAccess as jest.Mock).mockImplementation(() => {
      throw new Error('OMG');
    });

    getRuleTagsRoute(router, licenseState);

    const [, handler] = router.get.mock.calls[0];

    const [context, req, res] = mockHandlerArguments(
      {},
      {
        query: {},
      },
      ['ok']
    );
    expect(handler(context, req, res)).rejects.toMatchInlineSnapshot(`[Error: OMG]`);

    expect(verifyApiAccess).toHaveBeenCalledWith(licenseState);
  });
});
