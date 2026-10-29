import { Inbox } from "lucide-react";
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="text-center py-16">
      <div className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-primary-100 text-primary-600">
        <Inbox className="size-7" />
      </div>
      <h3 className="text-base font-medium text-gray-900 mb-1">{title}</h3>
      {description && <p className="text-sm text-gray-500 mb-4">{description}</p>}
      {action}
    </div>
  );
}
