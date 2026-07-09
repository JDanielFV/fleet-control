"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Check, ChevronDown } from "lucide-react";

interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}

export function SearchableSelect({ options, value, onValueChange, placeholder = "Seleccionar...", label }: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = search
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setHighlighted(0);
    }
  }, [open]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && filtered[highlighted]) {
      e.preventDefault();
      onValueChange(filtered[highlighted].value);
      setOpen(false);
      setSearch("");
    } else if (e.key === "Escape") {
      setOpen(false);
      setSearch("");
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="text-muted-foreground text-xs font-semibold block mb-1">{label}</label>
      )}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-input bg-background text-xs text-left cursor-pointer hover:border-primary/50 transition-colors"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={selected ? "text-foreground font-medium" : "text-muted-foreground"}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-xl shadow-xl overflow-hidden"
          >
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40">
              <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setHighlighted(0); }}
                onKeyDown={handleKeyDown}
                placeholder="Buscar..."
                className="flex-1 bg-transparent border-none text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-hidden"
                role="combobox"
                aria-autocomplete="list"
              />
            </div>
            <div
              className="max-h-48 overflow-y-auto py-1"
              role="listbox"
            >
              {filtered.length === 0 ? (
                <div className="px-3 py-4 text-xs text-muted-foreground text-center italic">
                  Sin resultados
                </div>
              ) : (
                filtered.map((opt, i) => (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={opt.value === value}
                    onClick={() => { onValueChange(opt.value); setOpen(false); setSearch(""); }}
                    onMouseEnter={() => setHighlighted(i)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left cursor-pointer transition-colors ${
                      i === highlighted ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted/30"
                    }`}
                  >
                    {opt.label}
                    {opt.value === value && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
