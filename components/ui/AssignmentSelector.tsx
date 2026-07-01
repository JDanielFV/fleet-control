import React, { useEffect, useState } from "react";
import { db } from "../../lib/db";
import type { Driver, Vehicle } from "../../lib/db/types";

interface AssignmentSelectorProps {
  type: "driver" | "vehicle";
  onSelect: (id: string) => void;
  onCancel: () => void;
}

export const AssignmentSelector = ({ type, onSelect, onCancel }: AssignmentSelectorProps) => {
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadItems = async () => {
      setIsLoading(true);
      try {
        const data = type === "driver" 
          ? await db.getAvailableDrivers() 
          : await db.getAvailableVehicles();
        setItems(data);
      } catch (err) {
        console.error(`Error loading available ${type}s:`, err);
      } finally {
        setIsLoading(false);
      }
    };
    loadItems();
  }, [type]);

  return (
    <div className="flex flex-col h-full max-h-[70vh]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <h3 className="font-bold text-slate-900">
          {type === "driver" ? "Seleccionar Vehículo" : "Seleccionar Conductor"}
        </h3>
        <button 
          onClick={onCancel}
          className="text-slate-400 hover:text-slate-600 p-2"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-slate-400">
            Cargando disponibles...
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-10 text-slate-500 italic">
            No hay {type === "driver" ? "vehículos" : "conductores"} disponibles en este momento.
          </div>
        ) : (
          items.map((item) => (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50 transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800 group-hover:text-blue-700">
                  {type === "driver" 
                    ? `${item.brand} ${item.vehicle_name} (${item.plate_number})`
                    : `${item.first_name} ${item.paternal_last_name}`}
                </span>
                <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
                  ID: {item.id.slice(0, 4)}
                </span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
};
