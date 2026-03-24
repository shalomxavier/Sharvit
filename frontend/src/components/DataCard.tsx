import React from 'react';

interface DataCardProps {
  title: string;
  value: string | number;
  previousValue?: string | number;
  loading?: boolean;
  formatValue?: (value: string | number) => string;
  showTrend?: boolean;
  onClick?: () => void;
  subtitle?: React.ReactNode;
  titleClassName?: string;
  valueClassName?: string;
  subtitleClassName?: string;
}

const DataCard: React.FC<DataCardProps> = ({
  title,
  value,
  previousValue,
  loading = false,
  formatValue,
  showTrend = true,
  onClick,
  subtitle,
  titleClassName,
  valueClassName,
  subtitleClassName
}) => {
  const formattedValue = formatValue ? formatValue(value) : value.toString();
  const isInteractive = typeof onClick === 'function';

  if (loading) {
    return (
      <div className="rounded-lg p-6 shadow-md">
        <div className="animate-pulse">
          <div className="h-4 rounded w-1/2 mb-2 border"></div>
          <div className="h-8 rounded w-3/4 border"></div>
        </div>
      </div>
    );
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isInteractive) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick?.();
    }
  };

  const titleClasses = `text-sm font-medium mb-1 ${titleClassName ?? 'text-blue-500'}`.trim();
  const valueClasses = `text-2xl font-bold ${valueClassName ?? 'text-blue-600'}`.trim();

  return (
    <div
      className={`rounded-lg p-6 shadow-md hover:shadow-lg transition-shadow ${isInteractive ? 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-600' : ''}`}
      onClick={onClick}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onKeyDown={handleKeyDown}
      aria-label={isInteractive ? `${title} card` : undefined}
    >
      <h3 className={titleClasses}>{title}</h3>
      <div className="flex items-center">
        <span className={valueClasses}>{formattedValue}</span>
      </div>
      {subtitle && (
        <div className={`text-xs mt-2 ${subtitleClassName ?? 'text-gray-500'}`.trim()}>
          {subtitle}
        </div>
      )}
    </div>
  );
};

export default DataCard;
