import React from "react";
import { ROTULO_STATUS, COR_STATUS } from "../lib/hubApi";

export default function Status({ status }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${COR_STATUS[status] || "bg-slate-100 text-slate-700"}`}>
      {ROTULO_STATUS[status] || status}
    </span>
  );
}
