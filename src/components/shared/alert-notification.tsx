import { ReactNode } from "react";
import { Info, CheckCircle } from "lucide-react";

const iconByType: Record<string, ReactNode> = {
  info: <Info className="h-6 w-6 shrink-0" />,
  success: <CheckCircle className="h-6 w-6 text-green-500 shrink-0" />,
};

const classesByType: Record<string, string> = {
  info: "bg-[#E8F2FE] text-slate-700",
  success: "bg-[#EBF5EB] text-slate-700",
};

export const AlertNotification = ({
  type = "info",
  children,
  className = "",
}: {
  type?: "info" | "success";
  children: ReactNode;
  className?: string;
}) => {
  return (
    <div className="mb-4">
      <div
        className={`flex items-start gap-3 p-4 rounded-lg ${classesByType[type]} ${className}`}
      >
        {iconByType[type]}
        <div>{children}</div>
      </div>
    </div>
  );
};
