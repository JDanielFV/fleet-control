import React, { useState } from "react";

interface ConfirmationDialogProps {
  title: string;
  message: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

export const ConfirmationDialog = ({ title, message, onConfirm, onCancel }: ConfirmationDialogProps) => {
  const [reason, setReason] = useState("");

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-xl font-bold text-slate-900">{title}</h3>
          <p className="text-slate-500 mt-1">{message}</p>
        </div>
        <div className="p-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Motivo de la acción
          </label>
          <textarea
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none"
            rows={3}
            placeholder="Explique el motivo del retiro..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <div className="p-4 bg-slate-50 flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            disabled={!reason.trim()}
            onClick={() => onConfirm(reason)}
            className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
};
