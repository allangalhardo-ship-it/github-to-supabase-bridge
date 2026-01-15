import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, ChevronUp } from "lucide-react";

export interface Column<T> {
  key: string;
  header: string;
  // Render function for table cell
  render?: (item: T) => React.ReactNode;
  // Whether to hide on mobile cards (shown in table)
  hideOnMobile?: boolean;
  // Priority for mobile display (lower = shown first, higher priority items become card header)
  mobilePriority?: number;
  // Alignment
  align?: "left" | "center" | "right";
  // Width class
  width?: string;
}

export interface MobileDataViewProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string;
  // Actions to show for each item
  renderActions?: (item: T) => React.ReactNode;
  // Custom mobile card header
  renderMobileHeader?: (item: T) => React.ReactNode;
  // Custom mobile card subtitle
  renderMobileSubtitle?: (item: T) => React.ReactNode;
  // Custom mobile card highlight (e.g., price, total)
  renderMobileHighlight?: (item: T) => React.ReactNode;
  // Card click handler
  onItemClick?: (item: T) => void;
  // Whether the item row should have special styling
  getRowClassName?: (item: T) => string;
  // Empty state message
  emptyMessage?: string;
  // Empty state action
  emptyAction?: React.ReactNode;
  className?: string;
}

export function MobileDataView<T>({
  data,
  columns,
  keyExtractor,
  renderActions,
  renderMobileHeader,
  renderMobileSubtitle,
  renderMobileHighlight,
  onItemClick,
  getRowClassName,
  emptyMessage = "Nenhum item encontrado",
  emptyAction,
  className,
}: MobileDataViewProps<T>) {
  const [expandedItems, setExpandedItems] = React.useState<Set<string>>(new Set());

  const toggleExpanded = (key: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Get mobile columns sorted by priority
  const mobileColumns = columns
    .filter((col) => !col.hideOnMobile)
    .sort((a, b) => (a.mobilePriority ?? 99) - (b.mobilePriority ?? 99));

  // Columns to show in expanded view (lower priority ones)
  const expandableColumns = mobileColumns.slice(2);

  if (data.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-muted-foreground mb-4">{emptyMessage}</p>
          {emptyAction}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Mobile Cards View */}
      <div className={cn("md:hidden space-y-3", className)}>
        {data.map((item) => {
          const key = keyExtractor(item);
          const isExpanded = expandedItems.has(key);
          const rowClassName = getRowClassName?.(item);

          return (
            <Card
              key={key}
              className={cn(
                "overflow-hidden transition-all w-full",
                onItemClick && "cursor-pointer hover:shadow-md",
                rowClassName
              )}
              onClick={() => onItemClick?.(item)}
            >
              <CardContent className="p-4 w-full overflow-hidden">
                {/* Header Row */}
                <div className="flex items-start justify-between gap-2 w-full overflow-hidden">
                  <div className="flex-1 min-w-0 overflow-hidden">
                    {/* Custom or Auto Header */}
                    {renderMobileHeader ? (
                      <div className="font-medium text-foreground min-w-0 max-w-full">
                        {renderMobileHeader(item)}
                      </div>
                    ) : mobileColumns[0]?.render ? (
                      <div className="font-medium text-foreground truncate max-w-full overflow-hidden">
                        {mobileColumns[0].render(item)}
                      </div>
                    ) : null}

                    {/* Subtitle */}
                    {renderMobileSubtitle ? (
                      <div className="text-sm text-muted-foreground mt-0.5 min-w-0 max-w-full">
                        {renderMobileSubtitle(item)}
                      </div>
                    ) : mobileColumns[1]?.render ? (
                      <div className="text-sm text-muted-foreground mt-0.5 truncate max-w-full">
                        {mobileColumns[1].render(item)}
                      </div>
                    ) : null}
                  </div>

                  {/* Highlight (price, total, etc) */}
                  {renderMobileHighlight && (
                    <div className="text-right shrink-0 whitespace-nowrap">
                      {renderMobileHighlight(item)}
                    </div>
                  )}
                </div>

                {/* Expandable Details */}
                {expandableColumns.length > 0 && (
                  <>
                    <button
                      type="button"
                      className="flex items-center gap-1 text-xs text-muted-foreground mt-3 hover:text-foreground transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpanded(key);
                      }}
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="h-3 w-3" />
                          Menos detalhes
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3 w-3" />
                          Mais detalhes
                        </>
                      )}
                    </button>

                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-border space-y-2">
                        {expandableColumns.map((col) => (
                          <div
                            key={col.key}
                            className="flex items-center justify-between gap-2 text-sm overflow-hidden"
                          >
                            <span className="text-muted-foreground shrink-0">{col.header}</span>
                            <span className="text-foreground truncate text-right">
                              {col.render?.(item) ?? "-"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* Actions */}
                {renderActions && (
                  <div
                    className="flex justify-end gap-1 mt-3 pt-3 border-t border-border flex-wrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {renderActions(item)}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Desktop Table View */}
      <Card className={cn("hidden md:block", className)}>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col) => (
                  <TableHead
                    key={col.key}
                    className={cn(
                      col.align === "center" && "text-center",
                      col.align === "right" && "text-right",
                      col.width
                    )}
                  >
                    {col.header}
                  </TableHead>
                ))}
                {renderActions && <TableHead className="w-32"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item) => {
                const key = keyExtractor(item);
                const rowClassName = getRowClassName?.(item);

                return (
                  <TableRow
                    key={key}
                    className={cn(
                      onItemClick && "cursor-pointer hover:bg-muted/50",
                      rowClassName
                    )}
                    onClick={() => onItemClick?.(item)}
                  >
                    {columns.map((col) => (
                      <TableCell
                        key={col.key}
                        className={cn(
                          col.align === "center" && "text-center",
                          col.align === "right" && "text-right"
                        )}
                      >
                        {col.render?.(item) ?? "-"}
                      </TableCell>
                    ))}
                    {renderActions && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          {renderActions(item)}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
