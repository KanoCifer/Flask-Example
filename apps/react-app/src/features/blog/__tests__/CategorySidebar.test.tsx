import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CategorySidebar } from '@/features/blog/views';
import type { TagItem } from '@/types';

describe('CategorySidebar (React — tags)', () => {
  const sampleTags: TagItem[] = [
    { name: 'python', count: 3 },
    { name: 'go', count: 1 },
  ];

  it('renders "全部" button plus one button per tag', () => {
    const onSelect = vi.fn();
    render(
      <CategorySidebar
        tags={sampleTags}
        activeTag={null}
        onSelectTag={onSelect}
      />,
    );

    expect(screen.getByText('全部')).toBeTruthy();
    expect(screen.getByText('python')).toBeTruthy();
    expect(screen.getByText('go')).toBeTruthy();
  });

  it('shows total count on the "全部" button', () => {
    render(
      <CategorySidebar
        tags={sampleTags}
        activeTag={null}
        onSelectTag={() => {}}
      />,
    );

    // 3 + 1 = 4
    expect(screen.getByText('4')).toBeTruthy();
  });

  it('calls onSelectTag(null) when "全部" is clicked', () => {
    const onSelect = vi.fn();
    render(
      <CategorySidebar
        tags={sampleTags}
        activeTag="python"
        onSelectTag={onSelect}
      />,
    );

    fireEvent.click(screen.getByText('全部'));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('calls onSelectTag(name) when a tag is clicked', () => {
    const onSelect = vi.fn();
    render(
      <CategorySidebar
        tags={sampleTags}
        activeTag={null}
        onSelectTag={onSelect}
      />,
    );

    fireEvent.click(screen.getByText('python'));
    expect(onSelect).toHaveBeenCalledWith('python');
  });

  it('renders skeleton when isLoading', () => {
    render(
      <CategorySidebar
        tags={[]}
        activeTag={null}
        onSelectTag={() => {}}
        isLoading
      />,
    );

    // Skeleton renders 3 pulse bars
    const pulses = document.querySelectorAll('.animate-pulse');
    expect(pulses.length).toBe(3);
  });

  it('does not render tag buttons when tags is empty and not loading', () => {
    render(
      <CategorySidebar tags={[]} activeTag={null} onSelectTag={() => {}} />,
    );

    expect(screen.queryByText('python')).toBeNull();
    expect(screen.getByText('全部')).toBeTruthy();
  });
});
