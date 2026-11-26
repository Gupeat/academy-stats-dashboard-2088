import { Button, DateRangePicker, Radio, Select } from "tdesign-react";
import { addDays, isIsoDate } from "../domain/date";
import type { Category, Filters, Venue } from "../domain/types";

interface FilterBarProps {
  filters: Filters;
  venues: Venue[];
  categories: Category[];
  today: string;
  onChange: (patch: Partial<Filters>) => void;
  onReset: () => void;
}

const QUICK_RANGES = [30, 90, 180];

function quickValueOf(filters: Filters, today: string): string {
  for (const days of QUICK_RANGES) {
    if (filters.start === addDays(today, -(days - 1)) && filters.end === today) {
      return String(days);
    }
  }
  return "";
}

export function FilterBar({ filters, venues, categories, today, onChange, onReset }: FilterBarProps) {
  const quick = quickValueOf(filters, today);

  const venueOptions = [
    { label: "全部会所", value: "all" },
    ...venues.map((venue) => ({
      label: venue.status === "preparing" ? venue.name + "（筹备中）" : venue.name,
      value: venue.id,
    })),
  ];
  const categoryOptions = [
    { label: "全部类别", value: "all" },
    ...categories.map((category) => ({ label: category.name, value: category.id })),
  ];

  const handleQuickRange = (value: string | number | boolean) => {
    const days = Number(value);
    if (!Number.isFinite(days) || days <= 0) return;
    onChange({ start: addDays(today, -(days - 1)), end: today });
  };

  const handleRange = (value: Array<string | number | Date>) => {
    const next = value.map((item) => String(item));
    if (next.length === 2 && isIsoDate(next[0]) && isIsoDate(next[1])) {
      onChange({ start: next[0], end: next[1] });
    }
  };

  return (
    <div
      className="filter-bar panel"
      data-testid="filter-bar"
      data-range-start={filters.start}
      data-range-end={filters.end}
      data-venue={filters.venueId}
      data-category={filters.categoryId}
      data-quick={quick}
    >
      <div className="filter-bar__group filter-bar__group--range">
        <span className="filter-bar__label">时间段</span>
        <DateRangePicker
          value={[filters.start, filters.end]}
          valueType="YYYY-MM-DD"
          format="YYYY-MM-DD"
          clearable={false}
          allowInput={false}
          placeholder={["开始日期", "结束日期"]}
          onChange={(value) => handleRange(value as Array<string | number | Date>)}
        />
        <Radio.Group
          variant="default-filled"
          size="small"
          value={quick}
          onChange={handleQuickRange}
          className="quick-range"
        >
          {QUICK_RANGES.map((days) => (
            <Radio.Button key={days} value={String(days)}>
              {"近 " + days + " 天"}
            </Radio.Button>
          ))}
        </Radio.Group>
      </div>
      <div className="filter-bar__group" data-testid="venue-filter">
        <span className="filter-bar__label">会所</span>
        <Select
          className="filter-select"
          value={filters.venueId}
          options={venueOptions}
          onChange={(value) => onChange({ venueId: String(value) })}
          aria-label="会所筛选"
        />
      </div>
      <div className="filter-bar__group" data-testid="category-filter">
        <span className="filter-bar__label">课程类别</span>
        <Select
          className="filter-select"
          value={filters.categoryId}
          options={categoryOptions}
          onChange={(value) => onChange({ categoryId: String(value) })}
          aria-label="课程类别筛选"
        />
      </div>
      <div className="filter-bar__actions">
        <Button
          size="small"
          variant="outline"
          onClick={onReset}
        >
          重置筛选
        </Button>
      </div>
    </div>
  );
}
