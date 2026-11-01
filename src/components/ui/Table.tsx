import { cn } from "@/lib/utils";

export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function Thead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="border-b border-gray-200">
      {children}
    </thead>
  );
}

export function Th({ children, className, card }: {
  children?: React.ReactNode;
  className?: string;
  /** The column's place in a phone card: the title, the amount, or a small meta value */
  card?: "title" | "amount" | "meta";
}) {
  return (
    <th data-card={card} className={cn("whitespace-nowrap px-3 py-3 text-start text-sm font-medium text-gray-500 sm:px-4", className)}>
      {children}
    </th>
  );
}

export function Tbody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-gray-300/70">{children}</tbody>;
}

export function Tr({
  children,
  onClick,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        "hover:bg-gray-50/70 transition-colors",
        onClick && "cursor-pointer",
        className
      )}
    >
      {children}
    </tr>
  );
}

export function Td({ children, className, dir }: { children?: React.ReactNode; className?: string; dir?: string }) {
  return (
    <td dir={dir} className={cn("px-3 py-3 text-gray-800 sm:px-4 sm:py-3.5", className)}>{children}</td>
  );
}
