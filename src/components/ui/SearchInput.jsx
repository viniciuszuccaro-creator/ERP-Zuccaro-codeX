import React from "react";
import { Search, X } from "lucide-react";

/** @type {React.ForwardRefExoticComponent<any>} */
const SearchInput = React.forwardRef(function SearchInput(
  /** @type {any} */ {
    value,
    onChange,
    placeholder = "Buscar...",
    className = "",
    shortcutHint = "",
    clearable = true,
    onKeyDown,
    ...props
  },
  ref,
) {
  const hasValue = Boolean(value && String(value).length > 0);

  const handleKeyDown = (e) => {
    if (e.key === "Escape" && hasValue && onChange) {
      e.preventDefault();
      onChange("");
    }
    if (typeof onKeyDown === "function") {
      onKeyDown(e);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5 pointer-events-none z-10" aria-hidden />
      <input
        ref={ref}
        type="text"
        placeholder={placeholder}
        value={value || ""}
        onChange={(e) => onChange && onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        spellCheck={false}
        className={`flex h-full min-h-[36px] w-full rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 pl-10 ${clearable || shortcutHint ? "pr-16" : ""}`}
        {...props}
      />
      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
        {clearable && hasValue && (
          <button
            type="button"
            onClick={() => onChange && onChange("")}
            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label="Limpar busca"
            data-action="limpar-busca"
          >
            <X className="w-4 h-4" aria-hidden />
          </button>
        )}
        {shortcutHint && !hasValue && (
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 bg-slate-100 border border-slate-300 rounded">
            {shortcutHint}
          </kbd>
        )}
      </div>
    </div>
  );
});

export default SearchInput;
