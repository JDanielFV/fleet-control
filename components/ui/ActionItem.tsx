import React from "react";

interface ActionItemProps {
  label: string;
  onClick: () => void;
  variant?: "primary" | "danger" | "secondary";
  icon?: React.ReactNode;
}

export const ActionItem = ({ label, onClick, variant = "primary", icon }: ActionItemProps) => {
  const variantClasses = {
    primary: "text-slate-700 hover:bg-slate-100",
    danger: "text-red-600 hover:bg-red-50",
    secondary: "text-slate-500 hover:bg-slate-50",
  };

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors duration-200 ${variantClasses[variant]}`}
    >
      {icon && <span className="text-xl">{icon}</span>}
      <span className="font-medium">{label}</span>
    </button>
  );
};
