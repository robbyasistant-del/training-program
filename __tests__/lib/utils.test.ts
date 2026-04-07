import { cn } from '@/lib/utils';

describe('cn utility function', () => {
  it('should merge class names correctly', () => {
    const result = cn('class1', 'class2');
    expect(result).toBe('class1 class2');
  });

  it('should handle conditional classes', () => {
    const isActive = true;
    const result = cn('base-class', isActive && 'active-class');
    expect(result).toBe('base-class active-class');
  });

  it('should filter out falsy values', () => {
    const result = cn('class1', false && 'class2', null, undefined, 'class3');
    expect(result).toBe('class1 class3');
  });

  it('should merge tailwind classes correctly', () => {
    const result = cn('px-2 py-1', 'px-4');
    // tailwind-merge should merge px-2 and px-4, keeping px-4
    expect(result).toContain('px-4');
    expect(result).not.toContain('px-2');
  });

  it('should handle empty inputs', () => {
    const result = cn();
    expect(result).toBe('');
  });

  it('should handle array of classes', () => {
    const result = cn(['class1', 'class2'], 'class3');
    expect(result).toBe('class1 class2 class3');
  });

  it('should handle object syntax for conditional classes', () => {
    const result = cn('base', { active: true, disabled: false });
    expect(result).toBe('base active');
  });
});
