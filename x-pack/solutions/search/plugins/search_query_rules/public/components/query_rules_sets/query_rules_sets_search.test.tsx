/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { QueryRulesSetsSearch } from './query_rules_sets_search';
import React from 'react';

describe('QueryRulesSetsSearch', () => {
  const mockSetSearchKey = jest.fn();

  it('renders correctly', () => {
    render(<QueryRulesSetsSearch searchKey="" setSearchKey={mockSetSearchKey} />);
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
  });

  it('input value matches searchKey prop', () => {
    render(<QueryRulesSetsSearch searchKey="test" setSearchKey={mockSetSearchKey} />);
    expect(screen.getByRole('searchbox')).toHaveValue('test');
  });

  it('calls setSearchKey on input change', () => {
    render(<QueryRulesSetsSearch searchKey="" setSearchKey={mockSetSearchKey} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'new search' } });
    expect(mockSetSearchKey).toHaveBeenCalledWith('new search');
  });
});
