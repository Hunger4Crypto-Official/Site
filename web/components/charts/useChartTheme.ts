const DEFAULT_COLORS = [
  '#7DD3FC', '#F87171', '#34D399', '#FBBF24', '#A78BFA',
  '#FB7185', '#60A5FA', '#F472B6', '#10B981', '#F59E0B'
];

export const useChartTheme = (overrides?: string[]) => {
  const colors = overrides && overrides.length > 0 ? overrides : DEFAULT_COLORS;

  return {
    colors,
    tooltipStyle: {
      backgroundColor: '#1F2937',
      border: '1px solid #374151',
      borderRadius: '8px',
      color: '#E5E7EB'
    } as const,
    gridColor: '#374151',
    axisColor: '#9CA3AF'
  };
};
