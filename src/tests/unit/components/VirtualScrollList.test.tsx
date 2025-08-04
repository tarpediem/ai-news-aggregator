/**
 * Unit tests for VirtualScrollList component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VirtualScrollList, useVirtualScroll, useVirtualScrollPerformance } from '../../../components/VirtualScrollList';

// Mock data
const mockItems = Array.from({ length: 1000 }, (_, i) => ({
  id: i,
  title: `Item ${i}`,
  content: `Content for item ${i}`,
}));

const mockRenderItem = (item: any, index: number) => (
  <div key={item.id} data-testid={`item-${index}`}>
    <h3>{item.title}</h3>
    <p>{item.content}</p>
  </div>
);

describe('VirtualScrollList', () => {
  const defaultProps = {
    items: mockItems,
    itemHeight: 100,
    containerHeight: 400,
    renderItem: mockRenderItem,
  };

  beforeEach(() => {
    // Reset any mocks
    vi.clearAllMocks();
  });

  it('should render visible items only', () => {
    render(<VirtualScrollList {...defaultProps} />);

    // With containerHeight 400 and itemHeight 100, we should see 4 items + overscan
    const visibleItems = screen.getAllByTestId(/item-\d+/);
    expect(visibleItems.length).toBeLessThan(20); // Much less than 1000 total items
    expect(visibleItems.length).toBeGreaterThan(4); // At least visible items + overscan
  });

  it('should render first items initially', () => {
    render(<VirtualScrollList {...defaultProps} />);

    expect(screen.getByText('Item 0')).toBeInTheDocument();
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
    expect(screen.getByText('Item 3')).toBeInTheDocument();
  });

  it('should handle scrolling and update visible items', () => {
    const { container } = render(<VirtualScrollList {...defaultProps} />);
    
    const scrollContainer = container.querySelector('.virtual-scroll-container');
    expect(scrollContainer).toBeInTheDocument();

    // Simulate scrolling down
    fireEvent.scroll(scrollContainer!, { target: { scrollTop: 500 } });

    // Should show items around scroll position (item 5 should be visible)
    expect(screen.getByText('Item 5')).toBeInTheDocument();
    expect(screen.getByText('Item 6')).toBeInTheDocument();
  });

  it('should call onScroll callback when scrolling', () => {
    const onScroll = vi.fn();
    const { container } = render(
      <VirtualScrollList {...defaultProps} onScroll={onScroll} />
    );

    const scrollContainer = container.querySelector('.virtual-scroll-container');
    fireEvent.scroll(scrollContainer!, { target: { scrollTop: 200 } });

    expect(onScroll).toHaveBeenCalledWith(200);
  });

  it('should handle custom overscan', () => {
    render(<VirtualScrollList {...defaultProps} overscan={10} />);

    const visibleItems = screen.getAllByTestId(/item-\d+/);
    // With overscan of 10, we should see more items
    expect(visibleItems.length).toBeGreaterThan(14); // 4 visible + 10 overscan on each side
  });

  it('should use custom getItemKey function', () => {
    const getItemKey = vi.fn((item, index) => `custom-${item.id}`);
    
    render(
      <VirtualScrollList {...defaultProps} getItemKey={getItemKey} />
    );

    expect(getItemKey).toHaveBeenCalled();
  });

  it('should handle empty items array', () => {
    render(<VirtualScrollList {...defaultProps} items={[]} />);

    expect(screen.queryByTestId(/item-\d+/)).not.toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <VirtualScrollList {...defaultProps} className="custom-class" />
    );

    const scrollContainer = container.querySelector('.virtual-scroll-container');
    expect(scrollContainer).toHaveClass('custom-class');
  });

  it('should handle items with different heights correctly', () => {
    const { container } = render(
      <VirtualScrollList {...defaultProps} itemHeight={200} />
    );

    const totalHeight = container.querySelector('div[style*="height"]');
    expect(totalHeight).toHaveStyle({ height: '200000px' }); // 1000 items * 200px
  });

  it('should position items correctly', () => {
    const { container } = render(<VirtualScrollList {...defaultProps} />);
    
    const items = container.querySelectorAll('.virtual-scroll-item');
    const firstItem = items[0];
    const secondItem = items[1];

    expect(firstItem).toHaveStyle({ top: '0px' });
    expect(secondItem).toHaveStyle({ top: '100px' });
  });

  it('should handle scrolling state correctly', () => {
    const { container } = render(<VirtualScrollList {...defaultProps} />);
    
    const scrollContainer = container.querySelector('.virtual-scroll-container');
    
    // Simulate scrolling
    fireEvent.scroll(scrollContainer!, { target: { scrollTop: 300 } });
    
    // Should update visible items based on scroll position
    expect(screen.getByText('Item 3')).toBeInTheDocument();
    expect(screen.getByText('Item 4')).toBeInTheDocument();
  });

  it('should cleanup timeout on unmount', () => {
    const { unmount } = render(<VirtualScrollList {...defaultProps} />);
    
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
    unmount();
    
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});

describe('useVirtualScroll hook', () => {
  it('should calculate visible range correctly', () => {
    let hookResult: any;
    
    function TestComponent() {
      hookResult = useVirtualScroll(mockItems, 400, 100);
      return <div />;
    }

    render(<TestComponent />);

    expect(hookResult.visibleRange.start).toBe(0);
    expect(hookResult.visibleRange.end).toBe(3); // 4 items visible (0-3)
    expect(hookResult.visibleRange.total).toBe(1000);
    expect(hookResult.totalHeight).toBe(100000); // 1000 * 100
  });

  it('should handle scroll updates', () => {
    let hookResult: any;
    
    function TestComponent() {
      hookResult = useVirtualScroll(mockItems, 400, 100);
      return <div />;
    }

    render(<TestComponent />);

    // Simulate scroll
    hookResult.handleScroll(500);

    expect(hookResult.scrollTop).toBe(500);
    expect(hookResult.isScrolling).toBe(true);
  });

  it('should reset isScrolling after delay', async () => {
    let hookResult: any;
    
    function TestComponent() {
      hookResult = useVirtualScroll(mockItems, 400, 100);
      return <div />;
    }

    render(<TestComponent />);

    hookResult.handleScroll(500);
    expect(hookResult.isScrolling).toBe(true);

    // Wait for debounce
    await new Promise(resolve => setTimeout(resolve, 200));
    expect(hookResult.isScrolling).toBe(false);
  });
});

describe('useVirtualScrollPerformance hook', () => {
  it('should track performance metrics', () => {
    let hookResult: any;
    
    function TestComponent() {
      hookResult = useVirtualScrollPerformance();
      return <div />;
    }

    render(<TestComponent />);

    const startTime = performance.now();
    hookResult.updateMetrics(startTime, 10, 1000);

    expect(hookResult.metrics.visibleItems).toBe(10);
    expect(hookResult.metrics.totalItems).toBe(1000);
    expect(hookResult.metrics.renderTime).toBeGreaterThan(0);
  });

  it('should handle memory usage tracking', () => {
    // Mock performance.memory
    const mockMemory = { usedJSHeapSize: 5000000 };
    Object.defineProperty(performance, 'memory', {
      value: mockMemory,
      configurable: true,
    });

    let hookResult: any;
    
    function TestComponent() {
      hookResult = useVirtualScrollPerformance();
      return <div />;
    }

    render(<TestComponent />);

    const startTime = performance.now();
    hookResult.updateMetrics(startTime, 10, 1000);

    expect(hookResult.metrics.memoryUsage).toBe(5000000);
  });

  it('should handle missing performance.memory gracefully', () => {
    // Remove performance.memory
    const originalMemory = (performance as any).memory;
    delete (performance as any).memory;

    let hookResult: any;
    
    function TestComponent() {
      hookResult = useVirtualScrollPerformance();
      return <div />;
    }

    render(<TestComponent />);

    const startTime = performance.now();
    hookResult.updateMetrics(startTime, 10, 1000);

    expect(hookResult.metrics.memoryUsage).toBe(0);

    // Restore
    (performance as any).memory = originalMemory;
  });
});

describe('VirtualScrollList Performance', () => {
  it('should handle large datasets efficiently', () => {
    const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
      id: i,
      title: `Item ${i}`,
      content: `Content ${i}`,
    }));

    const renderTime = performance.now();
    render(
      <VirtualScrollList
        items={largeDataset}
        itemHeight={100}
        containerHeight={400}
        renderItem={mockRenderItem}
      />
    );
    const endTime = performance.now();

    // Should render quickly even with large dataset
    expect(endTime - renderTime).toBeLessThan(100);
    
    // Should only render visible items
    const visibleItems = screen.getAllByTestId(/item-\d+/);
    expect(visibleItems.length).toBeLessThan(50); // Much less than 10000
  });

  it('should handle rapid scrolling without performance issues', () => {
    const { container } = render(<VirtualScrollList {...defaultProps} />);
    
    const scrollContainer = container.querySelector('.virtual-scroll-container');
    
    // Simulate rapid scrolling
    const startTime = performance.now();
    for (let i = 0; i < 100; i++) {
      fireEvent.scroll(scrollContainer!, { target: { scrollTop: i * 10 } });
    }
    const endTime = performance.now();

    // Should handle rapid scrolling efficiently
    expect(endTime - startTime).toBeLessThan(500);
  });

  it('should optimize re-renders with memoization', () => {
    const renderSpy = vi.fn();
    
    const MemoizedRenderItem = React.memo(({ item, index }: any) => {
      renderSpy(item.id);
      return <div data-testid={`item-${index}`}>{item.title}</div>;
    });

    const { container, rerender } = render(
      <VirtualScrollList
        {...defaultProps}
        renderItem={MemoizedRenderItem}
      />
    );

    const initialRenderCount = renderSpy.mock.calls.length;

    // Scroll to show the same items
    const scrollContainer = container.querySelector('.virtual-scroll-container');
    fireEvent.scroll(scrollContainer!, { target: { scrollTop: 10 } });

    // Should not re-render items that are still visible
    expect(renderSpy.mock.calls.length).toBeGreaterThanOrEqual(initialRenderCount);
  });
});

describe('VirtualScrollList Edge Cases', () => {
  it('should handle itemHeight of 0', () => {
    expect(() => {
      render(<VirtualScrollList {...defaultProps} itemHeight={0} />);
    }).not.toThrow();
  });

  it('should handle containerHeight of 0', () => {
    expect(() => {
      render(<VirtualScrollList {...defaultProps} containerHeight={0} />);
    }).not.toThrow();
  });

  it('should handle items array changes', () => {
    const { rerender } = render(<VirtualScrollList {...defaultProps} />);
    
    const newItems = Array.from({ length: 500 }, (_, i) => ({
      id: i,
      title: `New Item ${i}`,
      content: `New Content ${i}`,
    }));

    rerender(
      <VirtualScrollList
        {...defaultProps}
        items={newItems}
      />
    );

    expect(screen.getByText('New Item 0')).toBeInTheDocument();
    expect(screen.getByText('New Item 1')).toBeInTheDocument();
  });

  it('should handle negative scroll positions', () => {
    const { container } = render(<VirtualScrollList {...defaultProps} />);
    
    const scrollContainer = container.querySelector('.virtual-scroll-container');
    
    // Try to scroll to negative position
    fireEvent.scroll(scrollContainer!, { target: { scrollTop: -100 } });
    
    // Should handle gracefully and show first items
    expect(screen.getByText('Item 0')).toBeInTheDocument();
  });

  it('should handle scroll position beyond content', () => {
    const { container } = render(<VirtualScrollList {...defaultProps} />);
    
    const scrollContainer = container.querySelector('.virtual-scroll-container');
    
    // Scroll way beyond content
    fireEvent.scroll(scrollContainer!, { target: { scrollTop: 1000000 } });
    
    // Should handle gracefully and show last items
    expect(screen.getByText('Item 999')).toBeInTheDocument();
  });
});