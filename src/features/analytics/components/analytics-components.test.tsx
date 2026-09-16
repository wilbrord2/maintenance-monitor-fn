import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { parseTimeframe } from '../lib/timeframe';
import { ChartCard } from './chart-card';
import { TimeframeFilter } from './timeframe-filter';

const TODAY = '2026-09-15';

describe('ChartCard', () => {
  const baseProps = {
    title: 'Downtime by machine',
    chart: <div>chart marks</div>,
    table: (
      <table>
        <tbody>
          <tr>
            <td>Press 1 · 12 h</td>
          </tr>
        </tbody>
      </table>
    ),
    emptyTitle: 'No downtime recorded in this timeframe',
  };

  it('shows a loading state, then an empty state', () => {
    const { rerender } = renderWithProviders(<ChartCard {...baseProps} isLoading isEmpty />);
    expect(screen.getByRole('status', { name: '' })).toHaveTextContent('Loading chart');
    rerender(<ChartCard {...baseProps} isLoading={false} isEmpty />);
    expect(screen.getByText('No downtime recorded in this timeframe')).toBeInTheDocument();
  });

  it('offers a table view with every value', async () => {
    const { user } = renderWithProviders(<ChartCard {...baseProps} isLoading={false} isEmpty={false} />);
    expect(screen.getByText('chart marks')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Table' }));
    expect(screen.getByText('Press 1 · 12 h')).toBeInTheDocument();
    expect(screen.queryByText('chart marks')).not.toBeInTheDocument();
  });
});

describe('TimeframeFilter', () => {
  it('switches presets and validates custom ranges before applying', async () => {
    const onPreset = vi.fn();
    const onCustomRange = vi.fn();
    const { user } = renderWithProviders(
      <TimeframeFilter
        timeframe={parseTimeframe(new URLSearchParams(), TODAY)}
        today={TODAY}
        label="Last 30 days"
        onPreset={onPreset}
        onCustomRange={onCustomRange}
      />,
    );

    expect(screen.getByRole('radio', { name: '30 Days' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('Last 30 days')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: '7 Days' }));
    expect(onPreset).toHaveBeenCalledWith('7');

    await user.click(screen.getByRole('radio', { name: 'Custom range' }));
    const from = screen.getByLabelText('From');
    const to = screen.getByLabelText('To');
    await user.clear(from);
    await user.type(from, '2026-09-10');
    await user.clear(to);
    await user.type(to, '2026-09-01');
    expect(screen.getByText('The end date must be on or after the start date')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();

    await user.clear(to);
    await user.type(to, '2026-09-12');
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onCustomRange).toHaveBeenCalledWith('2026-09-10', '2026-09-12');
  });
});
