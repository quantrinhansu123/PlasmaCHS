import React, { useRef, useState } from 'react';
import { RotateCcw, GripVertical } from 'lucide-react';
import { clsx } from 'clsx';

const ColumnPicker = ({
  columnOrder,
  setColumnOrder,
  visibleColumns,
  setVisibleColumns,
  defaultColOrder,
  columnDefs,
}) => {
  const dragColIdx = useRef(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  return (
    <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-border z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right">
      <div className="px-4 py-2.5 border-b border-border bg-muted/5 flex items-center justify-between">
        <span className="text-[12px] font-bold text-foreground">Cột hiển thị</span>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground font-medium">{visibleColumns.length}/{columnOrder.length}</span>
          <button
            onClick={() => { setVisibleColumns(defaultColOrder); setColumnOrder(defaultColOrder); }}
            className="text-muted-foreground hover:text-primary transition-colors"
            title="Đặt lại"
          >
            <RotateCcw size={13} />
          </button>
        </div>
      </div>
      <div className="py-1 max-h-72 overflow-y-auto">
        {columnOrder.map((colId, idx) => (
          <div
            key={colId}
            draggable
            onDragStart={() => { dragColIdx.current = idx; }}
            onDragOver={(e) => { e.preventDefault(); setDragOverIdx(idx); }}
            onDrop={() => {
              if (dragColIdx.current === null || dragColIdx.current === idx) return;
              const next = [...columnOrder];
              const [removed] = next.splice(dragColIdx.current, 1);
              next.splice(idx, 0, removed);
              setColumnOrder(next);
              dragColIdx.current = null;
              setDragOverIdx(null);
            }}
            onDragEnd={() => { dragColIdx.current = null; setDragOverIdx(null); }}
            className={clsx(
              'flex items-center gap-2 px-3 py-2 transition-colors select-none',
              dragOverIdx === idx ? 'bg-primary/10 border-t-2 border-primary' : 'hover:bg-muted/20',
            )}
          >
            <GripVertical size={14} className="text-muted-foreground/30 cursor-grab shrink-0" />
            <label className="flex items-center gap-2.5 cursor-pointer flex-1">
              <input
                type="checkbox"
                className="rounded border-border text-primary focus:ring-primary/20 w-4 h-4 shrink-0"
                checked={visibleColumns.includes(colId)}
                onChange={() => setVisibleColumns(prev =>
                  prev.includes(colId)
                    ? prev.filter(id => id !== colId)
                    : [...prev, colId]
                )}
              />
              <span className="text-[13px] font-medium text-foreground">{columnDefs[colId].label}</span>
            </label>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ColumnPicker;
